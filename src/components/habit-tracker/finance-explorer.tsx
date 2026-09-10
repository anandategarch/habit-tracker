'use client';

// components/habit-tracker/finance-explorer.tsx — sub-tab "Explorer" Finance:
// workspace drill-down analitik pengeluaran.
//
// Alur: pilih bulan (default dari store selectedMonth) → ringkasan bulan
// (kartu statistik premium-card) → daftar kategori (premium-list-item + mini
// insight share/count) → klik kategori → detail per-hari (chart batang
// harian) + ringkasan mingguan → daftar transaksi (premium-list-item, klik →
// onEditTx(tx) membuka dialog edit di root finance.tsx — Task 4-b A.5).
//
// Tombol aksi:
//  - "Auto-Suggest" — POST /api/finance/budgets untuk ≤4 kategori teratas
//    yang belum punya budget (nominal = total belanja bulan itu).
//  - "Split Target Mingguan" — sama, tetapi nominal = total/4 sebagai patokan
//    mingguan (period 'weekly').
//  Keduanya mengecek `res.ok` PER POST (6-b FIX-4 — toast sukses palsu saat
//  server-side error dilarang; error API ditampilkan toast Indonesia).
//
// Data: GET /api/finance/transactions?month= + /api/finance/dashboard?month=
// + /api/finance/budgets?month= (dedupe kategori yang sudah ber-budget).

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  RefreshCw,
  Split,
  TrendingDown,
  Wand2,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { formatRupiah, compactRupiahSafe, monthLabel } from './finance-types';
import { monthOptionLabel } from './category-explorer-helpers';
import { tintFromColor, formatDateShort, formatTxTime } from '@/lib/finance-helpers';
import { dateFromYMD } from '@/lib/timezone';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';
import type { Transaction, BudgetItem, DashboardData } from './finance-types';

interface FinanceExplorerProps {
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
  onEditTx: (tx: Transaction) => void;
}

interface CategoryTotalRow {
  name: string;
  emoji: string;
  color: string;
  total: number;
  count: number;
  pct: number;
}

const MIN_SUGGEST_AMOUNT = 1000;
const MAX_SUGGEST_CATEGORIES = 4;

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function FinanceExplorer({ getCategoryMeta, onEditTx }: FinanceExplorerProps) {
  const queryClient = useQueryClient();
  // Bulan default dari month picker global (store), dikelola lokal supaya
  // drill-down explorer tidak menggeser sub-tab lain (pola category-explorer).
  const storeMonth = useAppStore(s => s.selectedMonth);
  const [selectedMonth, setSelectedMonth] = useState(storeMonth);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [busy, setBusy] = useState<'auto' | 'split' | null>(null);

  const monthOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [];
    for (let i = -24; i <= 24; i++) {
      const ym = shiftMonth(selectedMonth, i);
      opts.push({ value: ym, label: monthOptionLabel(ym) });
    }
    return opts;
  }, [selectedMonth]);

  const monthQuery = useQuery<Transaction[]>({
    queryKey: ['finance', 'transactions', 'explorer', selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/finance/transactions?month=${selectedMonth}`);
      if (!res.ok) throw new Error('Gagal memuat transaksi');
      return (await res.json()).transactions ?? [];
    },
    staleTime: 15_000,
    retry: 1,
  });

  const dashboardQuery = useQuery<DashboardData>({
    queryKey: ['finance', 'dashboard', 'explorer', selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/finance/dashboard?month=${selectedMonth}`);
      if (!res.ok) throw new Error('Gagal memuat ringkasan');
      return res.json();
    },
    staleTime: 30_000,
    retry: 1,
  });

  const budgetsQuery = useQuery<BudgetItem[]>({
    queryKey: ['finance', 'budgets', 'explorer', selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/finance/budgets?month=${selectedMonth}`);
      if (!res.ok) return [];
      return (await res.json()).budgets ?? [];
    },
    staleTime: 30_000,
  });

  const transactions = useMemo(
    () => (Array.isArray(monthQuery.data) ? monthQuery.data : []),
    [monthQuery.data]
  );
  const dashboardData = dashboardQuery.data ?? null;
  const budgetList = useMemo(
    () => (Array.isArray(budgetsQuery.data) ? budgetsQuery.data : []),
    [budgetsQuery.data]
  );

  // ── Agregasi per kategori (pengeluaran) ─────────────────────────────────
  const categoryTotals = useMemo<CategoryTotalRow[]>(() => {
    const map = new Map<string, { total: number; count: number }>();
    let grand = 0;
    for (const tx of transactions) {
      if (tx.type !== 'expense') continue;
      const cur = map.get(tx.category) ?? { total: 0, count: 0 };
      cur.total += tx.amount || 0;
      cur.count += 1;
      map.set(tx.category, cur);
      grand += tx.amount || 0;
    }
    return Array.from(map.entries())
      .map(([name, v]) => {
        const meta = getCategoryMeta(name);
        return {
          name,
          emoji: meta.emoji,
          color: meta.color,
          total: v.total,
          count: v.count,
          pct: grand > 0 ? Math.round((v.total / grand) * 100) : 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [transactions, getCategoryMeta]);

  const grandTotal = useMemo(
    () => categoryTotals.reduce((s, c) => s + c.total, 0),
    [categoryTotals]
  );

  // Kandidat auto-suggest: kategori teratas yang belum ber-budget bulan itu.
  const suggestTargets = useMemo(() => {
    const existing = new Set(budgetList.map((b) => b.category));
    return categoryTotals
      .filter((c) => c.total >= MIN_SUGGEST_AMOUNT && !existing.has(c.name))
      .slice(0, MAX_SUGGEST_CATEGORIES);
  }, [categoryTotals, budgetList]);

  // ── Aksi: Auto-Suggest & Split Target Mingguan (6-b FIX-4) ─────────────
  const postBudgets = async (
    kind: 'auto' | 'split',
    rows: Array<{ category: string; amount: number }>,
  ) => {
    let created = 0;
    let errMessage: string | null = null;
    for (const row of rows) {
      const res = await fetch('/api/finance/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: row.category,
          amount: row.amount,
          month: selectedMonth,
        }),
      });
      if (res.ok) {
        created++;
      } else {
        // CEK res.ok PER POST — fetch hanya reject saat network error,
        // kegagalan server-side harus jadi toast error (bukan sukses palsu).
        const err = await res.json().catch(() => null);
        errMessage = err?.error || 'Gagal membuat budget';
      }
    }
    return { created, errMessage };
  };

  const handleAutoSuggest = async () => {
    if (busy) return;
    if (suggestTargets.length === 0) {
      toast.info('Semua kategori utama sudah punya budget bulan ini');
      return;
    }
    setBusy('auto');
    try {
      const rows = suggestTargets.map((t) => ({
        category: t.name,
        amount: Math.max(MIN_SUGGEST_AMOUNT, Math.round(t.total)),
      }));
      const { created, errMessage } = await postBudgets('auto', rows);
      if (errMessage) {
        toast.error(errMessage);
        if (created > 0) queryClient.invalidateQueries({ queryKey: ['finance'] });
      } else {
        toast.success(`${created} budget bulanan dibuat dari pola belanja`);
        queryClient.invalidateQueries({ queryKey: ['finance'] });
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setBusy(null);
    }
  };

  const handleSplitWeekly = async () => {
    if (busy) return;
    if (suggestTargets.length === 0) {
      toast.info('Semua kategori utama sudah punya target mingguan');
      return;
    }
    setBusy('split');
    try {
      const rows = suggestTargets.map((t) => ({
        category: t.name,
        amount: Math.max(MIN_SUGGEST_AMOUNT, Math.round(t.total / 4)),
      }));
      const { created, errMessage } = await postBudgets('split', rows);
      if (errMessage) {
        toast.error(errMessage);
        if (created > 0) queryClient.invalidateQueries({ queryKey: ['finance'] });
      } else {
        toast.success(`Target mingguan untuk ${created} kategori dibuat`);
        queryClient.invalidateQueries({ queryKey: ['finance'] });
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setBusy(null);
    }
  };

  // ── Detail kategori terpilih ─────────────────────────────────────────────
  const detail = useMemo(() => {
    if (!activeCat) return null;
    const catTx = transactions
      .filter((t) => t.category === activeCat)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const meta = getCategoryMeta(activeCat);

    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const byDay = new Map<number, { total: number; count: number }>();
    for (const tx of catTx) {
      // H3: YMD dari komponen UTC ISO (slice) — konvensi storage = jam dinding
      // Jakarta; jakartaDateKey lama menggeser +7 (bucket hari salah).
      const day = parseInt(tx.date.slice(8, 10), 10);
      const cur = byDay.get(day) ?? { total: 0, count: 0 };
      cur.total += tx.amount || 0;
      cur.count += 1;
      byDay.set(day, cur);
    }

    const daily = Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      return {
        day: d,
        label: d === 1 || d % 5 === 0 ? String(d) : '',
        total: byDay.get(d)?.total ?? 0,
        count: byDay.get(d)?.count ?? 0,
      };
    });

    // Bucket mingguan (kolom Senin-awal, konsisten heatmap).
    const firstDow = (dateFromYMD(`${selectedMonth}-01`).getUTCDay() + 6) % 7;
    const weekCount = Math.ceil((firstDow + daysInMonth) / 7);
    const weekly = Array.from({ length: weekCount }, (_, w) => {
      let total = 0;
      let count = 0;
      for (const [day, v] of byDay) {
        if (Math.floor((firstDow + day - 1) / 7) === w) {
          total += v.total;
          count += v.count;
        }
      }
      return { label: `M${w + 1}`, name: `Minggu ${w + 1}`, total, count };
    });

    const total = catTx.reduce((s, t) => s + (t.amount || 0), 0);
    return {
      meta,
      catTx,
      daily,
      weekly,
      total,
      count: catTx.length,
      avgPerTx: catTx.length > 0 ? Math.round(total / catTx.length) : 0,
      activeDays: byDay.size,
      topDay: Array.from(byDay.entries()).reduce(
        (max, [day, v]) => (v.total > max.total ? { day, total: v.total } : max),
        { day: 0, total: 0 }
      ),
    };
  }, [activeCat, transactions, selectedMonth, getCategoryMeta]);

  // ── Month picker (dipakai di kedua level) ────────────────────────────────
  const monthPicker = (
    <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); }}>
      <SelectTrigger className="w-full sm:w-[180px] h-9" aria-label="Pilih bulan explorer">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {monthOptions.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            <span className="capitalize">{o.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // ── Error state ──────────────────────────────────────────────────────────
  if (monthQuery.isError || dashboardQuery.isError) {
    return (
      <div className="premium-card rounded-2xl mt-4">
        <div className="premium-empty min-h-[16rem]">
          <div className="premium-empty-orb" aria-hidden="true">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold">Gagal memuat data explorer</p>
          <p className="text-xs text-muted-foreground">Coba lagi dalam sejenak</p>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs mt-1"
            onClick={() => { void monthQuery.refetch(); void dashboardQuery.refetch(); }}
          >
            <RefreshCw className="h-3 w-3" /> Coba lagi
          </Button>
        </div>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (monthQuery.isLoading || dashboardQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-44 rounded-md" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    );
  }

  // ── LEVEL 2: detail kategori ────────────────────────────────────────────
  if (activeCat && detail) {
    return (
      <div className="space-y-3 mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setActiveCat(null)}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Kembali
          </Button>
          {monthPicker}
        </div>

        {/* Header kategori */}
        <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger">
          <div className="flex items-center gap-3">
            <span
              className="h-12 w-12 rounded-2xl grid place-items-center text-xl shrink-0 ring-1 ring-black/5 dark:ring-white/10"
              style={{ backgroundColor: tintFromColor(detail.meta.color) }}
              aria-hidden="true"
            >
              {detail.meta.emoji}
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-bold truncate">{activeCat}</h3>
              <p className="text-[11px] text-muted-foreground">
                {monthLabel(selectedMonth)} · {detail.count} transaksi · {detail.activeDays} hari aktif
              </p>
            </div>
            <p className="ml-auto premium-stat text-lg shrink-0 text-rose-600 dark:text-rose-400">
              {compactRupiahSafe(detail.total)}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="chip-soft chip-soft-teal px-3 py-2 min-w-0">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Rata²/tx</p>
                <p className="text-sm font-bold tabular-nums">{compactRupiahSafe(detail.avgPerTx)}</p>
              </div>
            </div>
            <div className="chip-soft chip-soft-amber px-3 py-2 min-w-0">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Hari Teratas</p>
                <p className="text-sm font-bold tabular-nums">
                  {detail.topDay.day > 0 ? `Tgl ${detail.topDay.day}` : '—'}
                </p>
              </div>
            </div>
            <div className="chip-soft chip-soft-violet px-3 py-2 min-w-0">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Tertinggi</p>
                <p className="text-sm font-bold tabular-nums">{compactRupiahSafe(detail.topDay.total)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chart per-hari */}
        <div className="premium-card rounded-2xl p-4 sm:p-5">
          <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
            <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            Pengeluaran Harian
          </h3>
          <div className="w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={detail.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => compactRupiahSafe(v)}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value) => [formatRupiah(Number(value)), 'Pengeluaran']}
                  labelFormatter={() => `${activeCat} · ${monthLabel(selectedMonth)}`}
                />
                <Bar dataKey="total" fill={detail.meta.color} radius={[3, 3, 0, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Ringkasan mingguan */}
          <div className="mt-4">
            <p className="premium-label mb-2">Ringkasan Mingguan</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {detail.weekly.map((w, i) => {
                const maxWeek = Math.max(...detail.weekly.map((x) => x.total), 1);
                return (
                  <div key={w.name} className="premium-list-item flex-col! items-stretch! px-3! py-2.5!" style={{ '--stagger': i } as CSSProperties}>
                    <p className="text-[11px] font-semibold text-muted-foreground">{w.name}</p>
                    <p className="text-sm font-bold tabular-nums">{compactRupiahSafe(w.total)}</p>
                    <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden mt-1.5" aria-hidden="true">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${(w.total / maxWeek) * 100}%`, backgroundColor: detail.meta.color }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{w.count} transaksi</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Daftar transaksi (klik → edit) */}
        <div className="premium-card rounded-2xl p-2 sm:p-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5 px-2 py-1.5">
            <Wallet className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            Rincian Transaksi
          </h3>
          {detail.catTx.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              Belum ada transaksi {detail.meta.emoji} {activeCat} di {monthLabel(selectedMonth)}
            </p>
          ) : (
            <div className="space-y-1.5">
              {detail.catTx.map((tx, idx) => (
                <button
                  key={tx.id}
                  type="button"
                  className="premium-list-item w-full px-3! py-2.5! text-left cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  style={{ '--stagger': idx } as CSSProperties}
                  onClick={() => onEditTx(tx)}
                  aria-label={`Edit transaksi ${tx.description || tx.category}`}
                >
                  <span
                    className="h-9 w-9 rounded-xl grid place-items-center text-base shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                    style={{ backgroundColor: tintFromColor(detail.meta.color) }}
                    aria-hidden="true"
                  >
                    {detail.meta.emoji}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">
                      {tx.description || tx.category}
                    </span>
                    <span className="block text-[11px] text-muted-foreground truncate">
                      {formatDateShort(tx.date)} · {formatTxTime(tx.date)}
                      {tx.sourceName ? ` · ${tx.sourceName}` : ''}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums shrink-0',
                      tx.type === 'income'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    )}
                  >
                    {tx.type === 'income' ? '+' : '−'}{formatRupiah(tx.amount)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── LEVEL 1: ringkasan bulan + daftar kategori ───────────────────────────
  if (transactions.length === 0) {
    return (
      <div className="space-y-3 mt-4">
        {monthPicker}
        <div className="premium-card rounded-2xl">
          <div className="premium-empty min-h-[16rem]">
            <div className="premium-empty-orb" aria-hidden="true">
              <Compass className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold">Belum ada transaksi bulan ini</p>
            <p className="text-xs text-muted-foreground">
              Catat transaksi untuk mulai mengeksplorasi pola belanjamu.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-4">
      {/* Baris atas: month picker + total */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {monthPicker}
        <div className="text-right">
          <p className="premium-label">Total Pengeluaran</p>
          <p className="premium-stat text-lg">{formatRupiah(grandTotal)}</p>
        </div>
      </div>

      {/* Kartu statistik bulan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="premium-card premium-card-sheen rounded-2xl p-3 anim-stagger flex items-center gap-2.5" style={{ '--stagger': 0 } as CSSProperties}>
          <span className="chip-icon chip-rose h-9 w-9 shrink-0" aria-hidden="true">
            <TrendingDown className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="premium-label">Pengeluaran</p>
            <p className="premium-stat text-sm truncate">{compactRupiahSafe(dashboardData?.monthExpense ?? grandTotal)}</p>
          </div>
        </div>
        <div className="premium-card premium-card-sheen rounded-2xl p-3 anim-stagger flex items-center gap-2.5" style={{ '--stagger': 1 } as CSSProperties}>
          <span className="chip-icon chip-emerald h-9 w-9 shrink-0" aria-hidden="true">
            <Wallet className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="premium-label">Pemasukan</p>
            <p className="premium-stat text-sm truncate">{compactRupiahSafe(dashboardData?.monthIncome ?? 0)}</p>
          </div>
        </div>
        <div className="premium-card premium-card-sheen rounded-2xl p-3 anim-stagger flex items-center gap-2.5" style={{ '--stagger': 2 } as CSSProperties}>
          <span className="chip-icon chip-teal h-9 w-9 shrink-0" aria-hidden="true">
            <Clock className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="premium-label">Rata² Harian</p>
            <p className="premium-stat text-sm truncate">{compactRupiahSafe(dashboardData?.dailyAvg ?? 0)}</p>
          </div>
        </div>
        <div className="premium-card premium-card-sheen rounded-2xl p-3 anim-stagger flex items-center gap-2.5" style={{ '--stagger': 3 } as CSSProperties}>
          <span className="chip-icon chip-amber h-9 w-9 shrink-0" aria-hidden="true">
            <TrendingDown className="h-4 w-4 rotate-12" />
          </span>
          <div className="min-w-0">
            <p className="premium-label">Proyeksi Bulan</p>
            <p className="premium-stat text-sm truncate">{compactRupiahSafe(dashboardData?.projection ?? 0)}</p>
          </div>
        </div>
      </div>

      {/* Insight line + aksi budget */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground min-w-0">
          💡{' '}
          {dashboardData?.topCategory
            ? `Kategori terbesar: ${dashboardData.topCategory.category} (${formatRupiah(dashboardData.topCategory.amount)})`
            : `${categoryTotals.length} kategori dipakai bulan ini`}
          {typeof dashboardData?.noSpendDays === 'number' && dashboardData.noSpendDays > 0
            ? ` · ${dashboardData.noSpendDays} hari tanpa belanja`
            : ''}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs anim-press"
            onClick={() => { void handleAutoSuggest(); }}
            disabled={busy !== null}
          >
            <Wand2 className={cn('h-3.5 w-3.5', busy === 'auto' && 'animate-pulse')} />
            {busy === 'auto' ? 'Menyusun…' : 'Auto-Suggest'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs anim-press"
            onClick={() => { void handleSplitWeekly(); }}
            disabled={busy !== null}
          >
            <Split className={cn('h-3.5 w-3.5', busy === 'split' && 'animate-pulse')} />
            {busy === 'split' ? 'Memecah…' : 'Split Target Mingguan'}
          </Button>
        </div>
      </div>

      {/* Daftar kategori */}
      <div className="premium-card premium-card-sheen rounded-2xl p-2 sm:p-3 space-y-1.5 anim-stagger">
        {categoryTotals.map((cat, idx) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => setActiveCat(cat.name)}
            className="premium-list-item w-full px-3! py-2.5! text-left cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            style={{ '--stagger': idx } as CSSProperties}
            aria-label={`Lihat detail kategori ${cat.name}`}
          >
            <span
              className="h-10 w-10 rounded-xl grid place-items-center text-base shrink-0 ring-1 ring-black/5 dark:ring-white/10"
              style={{ backgroundColor: tintFromColor(cat.color) }}
              aria-hidden="true"
            >
              {cat.emoji}
            </span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{cat.name}</span>
                <span className="text-sm font-semibold tabular-nums shrink-0">
                  {compactRupiahSafe(cat.total)}
                </span>
              </span>
              <span className="flex items-center gap-2 mt-1">
                <Progress
                  value={cat.pct}
                  className="h-1.5 flex-1 anim-progress-fill"
                />
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {cat.pct}% · {cat.count}×
                </span>
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
