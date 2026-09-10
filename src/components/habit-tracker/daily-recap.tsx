'use client';

// components/habit-tracker/daily-recap.tsx — rekap keuangan harian.
//
// REBUILD NOTE: file hasil recovery terpotong di tengah JSX (~baris 622) dan
// memakai bentuk API lama yang kaya (today/comparison/streaks/predictions/
// alerts/patterns/gamification/sparkline/dailyBudget dalam satu respons).
// Kontrak API rebuild hanya menyediakan:
//   GET /api/finance/daily-recap?date=yyyy-MM-dd → { transactions, totalExpense, totalIncome }
//   GET /api/finance/transactions?month=yyyy-MM  → { transactions, ... }
//   GET /api/settings                            → AppSettings (+ dailyBudgetTarget bila ada)
// sehingga komponen ini dirombak agar kontrak-compliant: statistik turunan
// (perbandingan, streak, proyeksi, pola jam, personality tag) dihitung
// client-side dari transaksi. Arsitektur sub-modul (SPLIT-PHASE2-UI) dan
// dialog budget harian dari partial dipertahankan.

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  TrendingUp,
  AlertTriangle,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  RefreshCw,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { jakartaDateString } from '@/lib/timezone';
import { formatRupiah, compactRupiahSafe, FALLBACK_EXPENSE } from './finance-types';
import type { Transaction, FinanceCategory } from './finance-types';
import { CountUpNumber } from './count-up';
import { CountUpRupiah } from './count-up-rupiah';
import { HelpInfoButton } from './help-calculation';
import { compactRupiahSafe as compactSafe, formatDateShort, formatTxTime } from './daily-recap-helpers';
import { MiniSparkline } from './daily-recap-sparkline';
import { ProgressRing } from './daily-recap-progress-ring';
import { HourlyHeatmap } from './daily-recap-hourly-heatmap';
import { BudgetDialog } from './daily-recap-budget-dialog';
import { CategoryInsightRow, AllTimeErrorChip, type AllTimeStat } from './daily-recap-category-insight';
import { ComparisonPill, AlertChip, StatTile, StreakChip } from './daily-recap-ui-chips';
import type { SparkPoint, CategoryStat, HourlyStat, RecapAlert, PersonalityTag, RecapComparison } from './daily-recap-types';

const DOW_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
// H3: Transaction.date menyimpan komponen UTC = jam dinding Jakarta — jam
// dibaca dari komponen UTC (timeZone 'UTC'). 'Asia/Jakarta' lama menggeser
// +7 (19.58 → 02) sehingga heatmap per-jam bergeser 7 jam.
const JAKARTA_HOUR_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  hour: '2-digit',
  hourCycle: 'h23',
});

// ── Main Component ───────────────────────────────────────────────────────

export default function DailyRecap() {
  const queryClient = useQueryClient();
  const today = jakartaDateString();
  const month = today.slice(0, 7);

  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  // Tab periode insight kategori: bulan berjalan atau all-time.
  const [insightPeriod, setInsightPeriod] = useState<'month' | 'alltime'>('month');

  // ── Data (kontrak) ─────────────────────────────────────────────────────
  const { data: dayRecap, isLoading, isError, refetch } = useQuery({
    queryKey: ['finance', 'daily-recap', today],
    queryFn: async () => {
      const res = await fetch(`/api/finance/daily-recap?date=${today}`);
      if (!res.ok) throw new Error('Gagal memuat rekap harian');
      return res.json() as Promise<{ transactions: Transaction[]; totalExpense: number; totalIncome: number }>;
    },
    staleTime: 30_000,
    retry: 1,
  });

  const { data: monthTransactions = [] } = useQuery<Transaction[]>({
    queryKey: ['finance', 'daily-recap-month', month],
    queryFn: async () => {
      const res = await fetch(`/api/finance/transactions?month=${month}`);
      if (!res.ok) return [];
      return (await res.json()).transactions ?? [];
    },
    staleTime: 30_000,
  });

  const { data: categories = [] } = useQuery<FinanceCategory[]>({
    queryKey: ['finance', 'categories'],
    queryFn: async () => {
      const res = await fetch('/api/finance/categories');
      if (!res.ok) return [];
      return res.json() as Promise<FinanceCategory[]>;
    },
    staleTime: 60_000,
  });

  // dailyBudgetTarget tidak ada di AppSettings kontrak — dibaca longgar;
  // bila API belum menyimpan field ini, ring disembunyikan dan dialog tetap
  // bisa dicoba (error API ditampilkan jujur lewat toast).
  const { data: settings } = useQuery<Record<string, unknown>>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) return {};
      return res.json() as Promise<Record<string, unknown>>;
    },
    staleTime: 60_000,
  });

  const todayTransactions = dayRecap?.transactions ?? [];
  const expense = dayRecap?.totalExpense ?? 0;
  const income = dayRecap?.totalIncome ?? 0;
  const net = income - expense;
  const transactionCount = todayTransactions.length;
  const expenseCount = todayTransactions.filter(t => t.type === 'expense').length;

  // ── All-time stats per kategori (on-demand, dari partial) ───────────────
  const allTimeCategories = useMemo(
    () => categoryStatsOf(todayTransactions, categories).map(c => c.name),
    [todayTransactions, categories]
  );
  const {
    data: allTimeStats,
    isError: allTimeIsError,
    refetch: refetchAllTime,
  } = useQuery<Record<string, AllTimeStat>>({
    queryKey: ['finance', 'category-alltime', allTimeCategories],
    queryFn: async () => {
      const res = await fetch('/api/finance/category-alltime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: allTimeCategories }),
      });
      if (!res.ok) throw new Error('Gagal memuat statistik all-time');
      return res.json() as Promise<Record<string, AllTimeStat>>;
    },
    enabled: insightPeriod === 'alltime' && allTimeCategories.length > 0,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  // ── Mutasi budget harian (dari partial — dipertahankan) ─────────────────
  const saveBudgetMutation = useMutation({
    mutationFn: async (target: number) => {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyBudgetTarget: target }),
      });
      if (!res.ok) throw new Error('Gagal menyimpan budget');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'daily-recap'] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Budget harian disimpan');
      setBudgetDialogOpen(false);
    },
    onError: () => {
      toast.error('Gagal menyimpan budget');
    },
  });

  function openBudgetDialog(currentTarget: number | null) {
    const formatted = currentTarget
      ? String(currentTarget).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
      : '';
    setBudgetInput(formatted);
    setBudgetDialogOpen(true);
  }

  function handleSaveBudget() {
    if (saveBudgetMutation.isPending) return;
    const digits = budgetInput.replace(/[^\d]/g, '');
    const target = digits ? parseInt(digits, 10) : 0;
    if (target > 100_000_000) {
      toast.error('Maksimal Rp 100.000.000');
      return;
    }
    saveBudgetMutation.mutate(target);
  }

  function handleRemoveBudget() {
    saveBudgetMutation.mutate(0);
  }

  // ── Statistik turunan (client-side) ────────────────────────────────────
  const categoryStats = useMemo(
    () => categoryStatsOf(todayTransactions, categories),
    [todayTransactions, categories]
  );

  const hourly = useMemo<HourlyStat[]>(() => {
    const map = new Map<number, HourlyStat>();
    for (const tx of todayTransactions) {
      if (tx.type !== 'expense') continue;
      const hour = Number(JAKARTA_HOUR_FMT.format(new Date(tx.date)));
      if (!Number.isFinite(hour)) continue;
      const cur = map.get(hour) ?? { hour, total: 0, count: 0 };
      cur.total += tx.amount || 0;
      cur.count += 1;
      map.set(hour, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.hour - b.hour);
  }, [todayTransactions]);

  const { daily7d, vsYesterday, vs7DayAverage, noSpendStreak, monthExpense, projection } = useMemo(() => {
    const expenseByDay = new Map<string, number>();
    let monthTotal = 0;
    for (const tx of monthTransactions) {
      if (tx.type !== 'expense') continue;
      // H3: YMD dari komponen UTC ISO (slice) — konvensi storage = jam dinding
      // Jakarta; jakartaDateKey lama menggeser +7 (pengeluaran ≥17:00 pindah
      // ke hari berikutnya → sparkline & vs-kemarin salah).
      const key = tx.date.slice(0, 10);
      expenseByDay.set(key, (expenseByDay.get(key) ?? 0) + (tx.amount || 0));
      monthTotal += tx.amount || 0;
    }
    // Sparkline 7 hari terakhir (label di dalam komponen).
    const spark: SparkPoint[] = [];
    const [y, m, d] = today.split('-').map(Number);
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(Date.UTC(y, m - 1, d - i));
      const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
      spark.push({
        date: key.slice(8, 10),
        label: key.slice(8, 10),
        dow: DOW_SHORT[dt.getUTCDay()],
        total: expenseByDay.get(key) ?? 0,
      });
    }
    // Perbandingan.
    const prev = (back: number) => {
      const dt = new Date(Date.UTC(y, m - 1, d - back));
      const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
      return expenseByDay.has(key) ? (expenseByDay.get(key) ?? 0) : null;
    };
    const cmp = (other: number | null): RecapComparison => {
      if (other === null || other === 0) return { changePct: null, direction: 'flat' };
      const pct = Math.round(((expense - other) / other) * 100);
      return { changePct: pct, direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
    };
    const yesterdayVal = prev(1);
    const last6 = [1, 2, 3, 4, 5, 6].map(prev).filter((v): v is number => v !== null);
    const avg6 = last6.length > 0 ? last6.reduce((s, v) => s + v, 0) / last6.length : null;
    // Streak no-spend: hitung mundur dari kemarin (hari ini ikut bila 0).
    let streak = expense === 0 ? 1 : 0;
    for (let back = 1; back <= 45; back++) {
      const v = prev(back);
      if (v === null) break; // di luar data bulan berjalan
      if (v === 0) streak += 1;
      else break;
    }
    // Proyeksi akhir bulan (sederhana, client-side).
    const daysInMonth = new Date(y, m, 0).getDate();
    const dayOfMonth = d;
    const projectionVal = dayOfMonth > 0 && monthTotal > 0
      ? Math.round((monthTotal / dayOfMonth) * daysInMonth)
      : 0;
    return {
      daily7d: spark,
      vsYesterday: cmp(yesterdayVal),
      vs7DayAverage: cmp(avg6 === null ? null : Math.round(avg6)),
      noSpendStreak: streak,
      monthExpense: monthTotal,
      projection: projectionVal,
    };
  }, [monthTransactions, today, expense]);

  const dailyBudget = useMemo(() => {
    const raw = settings?.dailyBudgetTarget;
    const target = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 0;
    if (!target) return null;
    const pct = Math.round((expense / target) * 100);
    return {
      target,
      spent: expense,
      remaining: target - expense,
      percentage: pct,
      status: (pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok') as 'ok' | 'warn' | 'over',
    };
  }, [settings, expense]);

  const personalityTag = useMemo<PersonalityTag>(() => {
    const avg7 = daily7d.reduce((s, p) => s + p.total, 0) / Math.max(1, daily7d.length);
    if (transactionCount === 0) {
      return { tag: 'Hari Tenang', emoji: '🌤️', description: 'Belum ada transaksi hari ini.' };
    }
    if (expense === 0) {
      return { tag: 'Hemat Total', emoji: '🍃', description: 'Nol pengeluaran hari ini — pertahankan!' };
    }
    if (avg7 > 0 && expense > avg7 * 2) {
      return { tag: 'Boros Hari Ini', emoji: '🔥', description: 'Pengeluaran lebih dari 2× rata-rata 7 hari.' };
    }
    if (avg7 > 0 && expense < avg7 * 0.7) {
      return { tag: 'Di Bawah Rata-rata', emoji: '🌿', description: 'Lebih hemat dari rata-rata 7 hari terakhir.' };
    }
    return { tag: 'Seimbang', emoji: '⚖️', description: 'Pengeluaran hari ini di kisaran rata-rata.' };
  }, [transactionCount, expense, daily7d]);

  const alerts = useMemo<RecapAlert[]>(() => {
    const out: RecapAlert[] = [];
    if (dailyBudget && dailyBudget.status === 'over') {
      out.push({
        tone: 'danger',
        text: `Over budget harian +${formatRupiah(Math.abs(dailyBudget.remaining))}`,
      });
    } else if (dailyBudget && dailyBudget.status === 'warn') {
      out.push({ tone: 'warning', text: `${dailyBudget.percentage}% dari budget harian terpakai` });
    }
    const avg7 = daily7d.reduce((s, p) => s + p.total, 0) / Math.max(1, daily7d.length);
    if (avg7 > 0 && expense > avg7 * 2) {
      out.push({ tone: 'warning', text: 'Pengeluaran >2× rata-rata 7 hari' });
    }
    return out;
  }, [dailyBudget, expense, daily7d]);

  // ── Error state ────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="premium-card rounded-2xl">
        <div className="p-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-destructive/10 text-destructive dark:bg-destructive/15 dark:text-destructive/80 shrink-0" aria-hidden="true">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold">Gagal memuat rekap harian</p>
            <p className="text-[11px] text-muted-foreground">Coba lagi dalam sejenak</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-7 text-xs px-2 shrink-0">
            <RefreshCw className="h-3 w-3" />
            Coba lagi
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !dayRecap) {
    return (
      <div className="premium-card rounded-2xl">
        <div className="p-4 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-40" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        </div>
      </div>
    );
  }

  const isEmpty = transactionCount === 0 && income === 0;

  return (
    <div className="premium-card premium-card-sheen rounded-2xl overflow-hidden anim-stagger contain-card">
      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-primary/[0.025] via-primary/[0.015] to-transparent px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-medium mb-1">Hari Ini</p>
            {isEmpty ? (
              <>
                <p className="text-xl sm:text-2xl font-bold tracking-tight text-success">Rp 0</p>
                <p className="text-xs text-muted-foreground mt-0.5">belum ada transaksi</p>
              </>
            ) : (
              <>
                <p className={cn(
                  'text-xl sm:text-3xl font-bold tracking-tight break-words',
                  expense > 0 ? 'text-foreground' : 'text-success'
                )}>
                  <CountUpRupiah amount={expense} />
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  total pengeluaran · <CountUpNumber value={expenseCount} /> transaksi
                </p>
              </>
            )}
          </div>

          {/* Ring budget harian — tap untuk edit (dialog dari partial). */}
          {dailyBudget ? (
            <button
              type="button"
              onClick={() => openBudgetDialog(dailyBudget.target)}
              className="flex flex-col items-center gap-1 shrink-0 group cursor-pointer rounded-lg p-1 -m-1 hover:bg-muted/40 transition-colors"
              aria-label={`Budget harian ${dailyBudget.percentage} persen, tap untuk edit`}
            >
              <ProgressRing percentage={dailyBudget.percentage} status={dailyBudget.status} size={48}>
                <div className="text-center">
                  <p className="text-[11px] font-bold leading-none">{dailyBudget.percentage}%</p>
                </div>
              </ProgressRing>
              <div className="flex items-center gap-0.5 text-[11px] text-muted-foreground text-center leading-tight">
                <span>dari {compactRupiahSafe(dailyBudget.target)}</span>
                <Pencil className="h-2 w-2 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openBudgetDialog(null)}
              className="flex flex-col items-center gap-1 shrink-0 group cursor-pointer rounded-lg p-1.5 -m-1 border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
              aria-label="Atur budget harian"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full text-muted-foreground group-hover:text-primary transition-colors" aria-hidden="true">
                <Target className="h-4 w-4" />
              </div>
              <span className="text-[11px] text-muted-foreground group-hover:text-primary transition-colors">
                Atur budget
              </span>
            </button>
          )}
        </div>

        {/* Comparison pills */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2">
          <ComparisonPill
            changePct={vsYesterday.changePct}
            direction={vsYesterday.direction}
            label="vs kemarin"
          />
          <ComparisonPill
            changePct={vs7DayAverage.changePct}
            direction={vs7DayAverage.direction}
            label="vs 7 hari"
          />
        </div>

        {/* Sparkline 7 hari */}
        <div className="mt-4">
          <MiniSparkline data={daily7d} />
        </div>
      </div>

      {/* ── ALERTS ─────────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <>
          <div className="border-t border-border" />
          <div className="px-4 py-2.5 sm:px-6 flex flex-wrap gap-2">
            {alerts.map((alert, i) => (
              <AlertChip key={i} alert={alert} />
            ))}
          </div>
        </>
      )}

      {/* ── 3 STAT TILES ───────────────────────────────────────────────── */}
      <div className="border-t border-border" />
      <div className="grid grid-cols-3 divide-x divide-border">
        <div className="px-2 py-2.5 sm:px-3">
          <StatTile
            label="Masuk"
            value={<span className="tabular-nums">{compactSafe(income)}</span>}
            icon={ArrowUpRight}
            iconClass="bg-success/10 text-success dark:bg-success/15 dark:text-success/80"
            valueClass="text-success dark:text-success/80"
          />
        </div>
        <div className="px-2 py-2.5 sm:px-3">
          <StatTile
            label="Keluar"
            value={<span className="tabular-nums">{compactSafe(expense)}</span>}
            icon={ArrowDownRight}
            iconClass="bg-destructive/10 text-destructive dark:bg-destructive/15 dark:text-destructive/80"
            valueClass="text-destructive dark:text-destructive/80"
          />
        </div>
        <div className="px-2 py-2.5 sm:px-3">
          <StatTile
            label="Bersih"
            value={<span className="tabular-nums">{compactSafe(net)}</span>}
            icon={Activity}
            iconClass={cn(
              'bg-muted/50',
              net >= 0 ? 'text-success dark:text-success/80' : 'text-destructive dark:text-destructive/80'
            )}
            valueClass={net >= 0 ? 'text-success dark:text-success/80' : 'text-destructive dark:text-destructive/80'}
          />
        </div>
      </div>

      {/* ── OVER BUDGET BAR ────────────────────────────────────────────── */}
      {dailyBudget && dailyBudget.status === 'over' && (
        <>
          <div className="border-t border-border" />
          <div className="px-4 py-2.5 sm:px-6 bg-destructive/10 dark:bg-destructive/15 anim-flash-red">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-destructive dark:text-destructive/80 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                Over budget
              </span>
              <span className="text-xs font-bold text-destructive dark:text-destructive/80">
                +{formatRupiah(Math.abs(dailyBudget.remaining))}
              </span>
            </div>
            <Progress value={Math.min(dailyBudget.percentage, 100)} className="h-1.5 bg-destructive/10 dark:bg-destructive/15" />
          </div>
        </>
      )}

      {/* ── INSIGHTS ───────────────────────────────────────────────────── */}
      <div className="border-t border-border" />
      <div className="px-4 py-3 sm:px-6 space-y-3">
        {/* Personality tag + streak */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
            <span className="text-sm" aria-hidden="true">{personalityTag.emoji}</span>
            <span className="text-xs font-semibold text-primary">{personalityTag.tag}</span>
          </div>
          <StreakChip days={noSpendStreak} />
        </div>
        <p className="text-xs text-muted-foreground italic">{personalityTag.description}</p>

        {/* Proyeksi akhir bulan (client-side) */}
        <div className="rounded-xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">Proyeksi Akhir Bulan</span>
                <HelpInfoButton section="proyeksi" label="Proyeksi" />
              </div>
              <p className="text-lg font-bold tabular-nums">{formatRupiah(projection)}</p>
              <p className="text-[11px] text-muted-foreground">
                s/d hari ini {compactSafe(monthExpense)} · rata²{' '}
                {compactSafe(Math.round(monthExpense / Math.max(1, Number(today.slice(8, 10)))))}/hari
              </p>
            </div>
          </div>
        </div>

        {/* Distribusi jam */}
        {hourly.length > 0 && (
          <div className="rounded-xl border border-border p-3">
            <HourlyHeatmap hourly={hourly} />
          </div>
        )}

        {/* Insight per kategori + tab periode */}
        {categoryStats.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold">Insight per Kategori</h4>
              <div className="premium-segment" role="group" aria-label="Periode insight kategori">
                <button
                  type="button"
                  className="premium-segment-item h-7 cursor-pointer"
                  data-active={insightPeriod === 'month' ? 'true' : 'false'}
                  aria-pressed={insightPeriod === 'month'}
                  onClick={() => setInsightPeriod('month')}
                >
                  Hari ini
                </button>
                <button
                  type="button"
                  className="premium-segment-item h-7 cursor-pointer"
                  data-active={insightPeriod === 'alltime' ? 'true' : 'false'}
                  aria-pressed={insightPeriod === 'alltime'}
                  onClick={() => setInsightPeriod('alltime')}
                >
                  All-time
                </button>
              </div>
            </div>
            {insightPeriod === 'alltime' && allTimeIsError && (
              <AllTimeErrorChip onRetry={() => refetchAllTime()} />
            )}
            <div className="space-y-1.5">
              {categoryStats.map(c => (
                <CategoryInsightRow
                  key={c.name}
                  insight={c}
                  period={insightPeriod}
                  allTime={allTimeStats?.[c.name]}
                  allTimeError={insightPeriod === 'alltime' && allTimeIsError}
                  onRetryAllTime={() => refetchAllTime()}
                />
              ))}
            </div>
          </div>
        )}

        {/* Transaksi hari ini */}
        {todayTransactions.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold">Transaksi Hari Ini</h4>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {todayTransactions.length} transaksi
              </span>
            </div>
            {todayTransactions.map(tx => {
              const isExpense = tx.type === 'expense';
              const meta = metaOf(tx.category, categories);
              return (
                <div key={tx.id} className="premium-list-item px-3! py-2.5!">
                  <span
                    className="h-9 w-9 rounded-xl grid place-items-center text-base shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                    style={{ backgroundColor: `${meta.color}20` }}
                    aria-hidden="true"
                  >
                    {meta.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{tx.description?.trim() || tx.category}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDateShort(tx.date)} · {formatTxTime(tx.date)}
                      {tx.sourceName ? ` · ${tx.sourceName}` : ''}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'text-xs font-semibold tabular-nums shrink-0',
                      isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    )}
                  >
                    {isExpense ? '−' : '+'}{formatRupiah(tx.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state hero (tanpa transaksi) */}
        {isEmpty && (
          <div className="text-center pt-2 pb-1 border-t border-border/40">
            <div className="text-2xl mb-1 anim-float-subtle" aria-hidden="true">🌤️</div>
            <p className="text-xs font-medium">Belum ada aktivitas hari ini</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Catat transaksi pertama untuk mulai melacak insight harianmu
            </p>
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-background/60 backdrop-blur-sm border border-border/50">
              <span className="text-xs" aria-hidden="true">{personalityTag.emoji}</span>
              <span className="text-[11px] font-medium">{personalityTag.tag}</span>
            </div>
          </div>
        )}
      </div>

      {/* Dialog budget (dari partial — dipertahankan) */}
      <BudgetDialog
        open={budgetDialogOpen}
        onOpenChange={setBudgetDialogOpen}
        budgetInput={budgetInput}
        setBudgetInput={setBudgetInput}
        onSave={handleSaveBudget}
        onRemove={handleRemoveBudget}
        isPending={saveBudgetMutation.isPending}
        hasExistingBudget={!!dailyBudget?.target}
      />
    </div>
  );
}

// ── Helper lokal ──────────────────────────────────────────────────────────

function metaOf(name: string, categories: FinanceCategory[]): { emoji: string; color: string } {
  const found = categories.find(c => c.name === name);
  if (found) return { emoji: found.emoji, color: found.color };
  const fallback = FALLBACK_EXPENSE.find(c => c.value === name);
  if (fallback) return { emoji: fallback.emoji, color: fallback.color };
  return { emoji: '📦', color: '#78716c' };
}

function categoryStatsOf(transactions: Transaction[], categories: FinanceCategory[]): CategoryStat[] {
  const map = new Map<string, { total: number; count: number; max: number }>();
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const cur = map.get(tx.category) ?? { total: 0, count: 0, max: 0 };
    cur.total += tx.amount || 0;
    cur.count += 1;
    cur.max = Math.max(cur.max, tx.amount || 0);
    map.set(tx.category, cur);
  }
  return Array.from(map.entries())
    .map(([name, v]) => {
      const meta = metaOf(name, categories);
      return {
        name,
        emoji: meta.emoji,
        color: meta.color,
        total: v.total,
        count: v.count,
        avg: v.count > 0 ? Math.round(v.total / v.count) : 0,
        max: v.max,
      };
    })
    .sort((a, b) => b.total - a.total);
}
