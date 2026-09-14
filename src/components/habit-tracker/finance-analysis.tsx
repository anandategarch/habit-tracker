'use client';

// components/habit-tracker/finance-analysis.tsx — sub-tab "Analisis" Finance
// (MERGE Task 32, Opsi A): penggabungan sub-tab lama "Eksplorasi"
// (finance-explorer.tsx) dan "Kategori" (category-explorer.tsx) yang 70%-nya
// kembar — pemilih bulan, daftar kategori, total pengeluaran, konsep
// drill-down. Kini satu pintu, tab Finance 8 → 7 sub-tab.
//
// LEVEL 1 (warisan Eksplorasi): 4 kartu statistik bulan + insight + tombol
//   Auto-Suggest & Split Target Mingguan (buat budget dari pola belanja) +
//   daftar kategori (progress bar + persen).
// LEVEL 2 (warisan Kategori — analisis paling kaya): CategoryDetailView —
//   grafik harian + rata² 7 hari, banding bulan lalu, pola jam/hari, sumber
//   dana, histogram nominal, deteksi anomali, kepribadian kategori; PLUS 2
//   transplant dari Eksplorasi: ringkasan mingguan M1–M5 dan baris transaksi
//   yang bisa di-tap untuk membuka dialog edit.
//
// Bulan: GLOBAL store selectedMonth (bukan useState lokal) — memperbaiki bug
// "bulan nyangkut": dulu mengganti bulan di header saat berada di
// Eksplorasi/Kategori tidak mengubah daftar (state lokal tidak mengikuti
// store), dan 2 sub-tab bisa menampilkan 2 bulan berbeda sekaligus.
//
// Query key sengaja MENIRU kunci query finance.tsx (transaksi bulan dengan
// filter default, dashboard, budgets) supaya cache React Query terbagi:
// pindah Transaksi ↔ Analisis tidak mem-fetch ulang data yang sama (dulu
// explorer + category-explorer masing-masing fetch sendiri = 2× jaringan
// untuk data identik).

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  Compass,
  Lightbulb,
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
import { formatRupiah, compactRupiahSafe } from './finance-types';
import { CountUpRupiah } from './count-up-rupiah';
import { monthOptionLabel } from './category-explorer-helpers';
import { tintFromColor } from '@/lib/finance-helpers';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';
import type { Transaction, BudgetItem, DashboardData } from './finance-types';
import type { CategoryTotal } from './category-explorer-types';
import { CategoryDetailView } from './category-explorer-detail-view';

interface FinanceAnalysisProps {
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
  onEditTx: (tx: Transaction) => void;
}

const MIN_SUGGEST_AMOUNT = 1000;
const MAX_SUGGEST_CATEGORIES = 4;

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  // Date.UTC — konsisten konvensi UTC (aman lintas zona pengguna).
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function FinanceAnalysis({ getCategoryMeta, onEditTx }: FinanceAnalysisProps) {
  const queryClient = useQueryClient();
  // Bulan GLOBAL (lihat komentar file atas): 1 sumber kebenaran — pemilih
  // bulan di sini dan di header finance.tsx saling sinkron dua arah.
  const selectedMonth = useAppStore(s => s.selectedMonth);
  const setSelectedMonth = useAppStore(s => s.setSelectedMonth);
  // VERIFY-48 (48-b): pembuatan budget dari Analisis menyegarkan dashboard.
  const triggerRefresh = useAppStore(s => s.triggerRefresh);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [busy, setBusy] = useState<'auto' | 'split' | null>(null);

  const prevMonth = useMemo(() => shiftMonth(selectedMonth, -1), [selectedMonth]);

  const monthOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [];
    for (let i = -24; i <= 24; i++) {
      const ym = shiftMonth(selectedMonth, i);
      opts.push({ value: ym, label: monthOptionLabel(ym) });
    }
    return opts;
  }, [selectedMonth]);

  // ── Queries — kunci MIRROR finance.tsx supaya cache terbagi ─────────────
  // Bentuk kunci (termasuk urutan field objek filter default) HARUS identik
  // dengan query transaksi di finance.tsx agar React Query menganggapnya
  // query yang sama → satu fetch untuk banyak sub-tab.

  const monthQuery = useQuery<Transaction[]>({
    queryKey: ['finance', 'transactions', selectedMonth, { type: 'all', category: 'all', source: 'all', search: '' }, ''],
    queryFn: async () => {
      const res = await fetch(`/api/finance/transactions?month=${selectedMonth}`);
      if (!res.ok) throw new Error('Gagal memuat transaksi');
      return (await res.json()).transactions ?? [];
    },
    staleTime: 15_000,
    retry: 1,
  });

  // Bulan sebelumnya — bahan chip "vs bulan lalu" di detail kategori.
  const prevMonthQuery = useQuery<Transaction[]>({
    queryKey: ['finance', 'transactions', prevMonth, { type: 'all', category: 'all', source: 'all', search: '' }, ''],
    queryFn: async () => {
      const res = await fetch(`/api/finance/transactions?month=${prevMonth}`);
      if (!res.ok) return [];
      return (await res.json()).transactions ?? [];
    },
    staleTime: 15_000,
  });

  const dashboardQuery = useQuery<DashboardData>({
    queryKey: ['finance', 'dashboard', selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/finance/dashboard?month=${selectedMonth}`);
      if (!res.ok) throw new Error('Gagal memuat ringkasan');
      return res.json();
    },
    staleTime: 30_000,
    retry: 1,
  });

  const budgetsQuery = useQuery<BudgetItem[]>({
    queryKey: ['finance', 'budgets', selectedMonth],
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
  const prevTransactions = useMemo(
    () => (Array.isArray(prevMonthQuery.data) ? prevMonthQuery.data : []),
    [prevMonthQuery.data]
  );
  const dashboardData = dashboardQuery.data ?? null;
  const budgetList = useMemo(
    () => (Array.isArray(budgetsQuery.data) ? budgetsQuery.data : []),
    [budgetsQuery.data]
  );

  // ── Agregasi per kategori (pengeluaran) — bentuk CategoryTotal ─────────

  const categoryTotals = useMemo<CategoryTotal[]>(() => {
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
          percentage: grand > 0 ? Math.round((v.total / grand) * 100) : 0,
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
    return { created, errMessage, kind };
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
        // VERIFY-48 (48-b): budget baru mengubah budgetTotal/budgetSpent di
        // /api/dashboard (tile Anggaran Beranda + kartu Progres) — triggerRefresh.
        if (created > 0) { queryClient.invalidateQueries({ queryKey: ['finance'] }); triggerRefresh(); }
      } else {
        toast.success(`${created} budget bulanan dibuat dari pola belanja`);
        queryClient.invalidateQueries({ queryKey: ['finance'] });
        triggerRefresh();
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
      toast.info('Semua kategori utama sudah punya budget');
      return;
    }
    setBusy('split');
    try {
      // BUGHUNT-47 (47-b #5): "Split Target Mingguan" lama membuat budget
      // BULANAN sebesar total/4 — schema WeeklyBudget memang selalu bulanan
      // (tidak ada periode mingguan), janya progress membandingkan pemakaian
      // SEBULAN penuh vs angka ¼ bulan → budget baru langsung "Terlampaui"
      // ~400%. Tombol kini jujur: "Budget Hemat" = 75% dari pola bulan
      // berjalan (ruang hemat 25%), tetap dievaluasi bulanan.
      const rows = suggestTargets.map((t) => ({
        category: t.name,
        amount: Math.max(MIN_SUGGEST_AMOUNT, Math.round((t.total * 3) / 4)),
      }));
      const { created, errMessage } = await postBudgets('split', rows);
      if (errMessage) {
        toast.error(errMessage);
        // VERIFY-48 (48-b): sama dengan auto-suggest — dashboard ikut segar.
        if (created > 0) { queryClient.invalidateQueries({ queryKey: ['finance'] }); triggerRefresh(); }
      } else {
        toast.success(`Budget hemat (75% pola) untuk ${created} kategori dibuat`);
        queryClient.invalidateQueries({ queryKey: ['finance'] });
        triggerRefresh();
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setBusy(null);
    }
  };

  // ── Month picker (dipakai di kedua level; menulis ke store GLOBAL) ──────
  const monthPicker = (
    <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); }}>
      <SelectTrigger className="w-full sm:w-[180px] h-9" aria-label="Pilih bulan analisis">
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
          <p className="text-sm font-semibold">Gagal memuat data analisis</p>
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

  // ── LEVEL 2: detail kategori (analisis kaya warisan Kategori) ────────────
  const activeCategory = activeCat ? categoryTotals.find(c => c.name === activeCat) : null;
  if (activeCat && activeCategory) {
    return (
      <CategoryDetailView
        cat={activeCategory}
        transactions={transactions}
        prevTransactions={prevTransactions}
        selectedMonth={selectedMonth}
        monthOptions={monthOptions}
        onBack={() => setActiveCat(null)}
        onSelectMonth={setSelectedMonth}
        onEditTx={onEditTx}
      />
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
              Catat transaksi untuk mulai menganalisis pola belanjamu.
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
          <p className="premium-stat text-lg"><CountUpRupiah amount={grandTotal} /></p>
        </div>
      </div>

      {/* Kartu statistik bulan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger flex items-center gap-3" style={{ '--stagger': 0 } as CSSProperties}>
          <span className="chip-icon chip-rose h-9 w-9 shrink-0" aria-hidden="true">
            <TrendingDown className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="premium-label">Pengeluaran</p>
            <p className="premium-stat text-sm truncate">{compactRupiahSafe(dashboardData?.monthExpense ?? grandTotal)}</p>
          </div>
        </div>
        <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger flex items-center gap-3" style={{ '--stagger': 1 } as CSSProperties}>
          <span className="chip-icon chip-emerald h-9 w-9 shrink-0" aria-hidden="true">
            <Wallet className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="premium-label">Pemasukan</p>
            <p className="premium-stat text-sm truncate">{compactRupiahSafe(dashboardData?.monthIncome ?? 0)}</p>
          </div>
        </div>
        <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger flex items-center gap-3" style={{ '--stagger': 2 } as CSSProperties}>
          <span className="chip-icon chip-teal h-9 w-9 shrink-0" aria-hidden="true">
            <Clock className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="premium-label">Rata² Harian</p>
            <p className="premium-stat text-sm truncate">{compactRupiahSafe(dashboardData?.dailyAvg ?? 0)}</p>
          </div>
        </div>
        <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger flex items-center gap-3" style={{ '--stagger': 3 } as CSSProperties}>
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
        <div className="flex items-center gap-2 min-w-0">
          <span className="chip-icon h-7 w-7 chip-amber shrink-0" aria-hidden="true">
            <Lightbulb className="h-3.5 w-3.5" />
          </span>
          <p className="text-[11px] text-muted-foreground min-w-0">
            {dashboardData?.topCategory
              ? `Kategori terbesar: ${dashboardData.topCategory.category} (${formatRupiah(dashboardData.topCategory.amount)})`
              : `${categoryTotals.length} kategori dipakai bulan ini`}
            {typeof dashboardData?.noSpendDays === 'number' && dashboardData.noSpendDays > 0
              ? ` · ${dashboardData.noSpendDays} hari tanpa belanja`
              : ''}
          </p>
        </div>
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
            aria-label="Buat budget hemat 75 persen dari pola belanja"
          >
            <Split className={cn('h-3.5 w-3.5', busy === 'split' && 'animate-pulse')} />
            {busy === 'split' ? 'Menyusun…' : 'Budget Hemat'}
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
                  value={cat.percentage}
                  className="h-1.5 flex-1 anim-progress-fill"
                />
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {cat.percentage}% · {cat.count}×
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
