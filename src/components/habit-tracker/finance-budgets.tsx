'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, Plus, Edit3, Trash2, History, TrendingUp, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import { jakartaNowParts } from '@/lib/timezone';
import { formatRupiah } from './finance-types';
import type { BudgetItem, DashboardData } from './finance-types';

interface BudgetSnapshot {
  id: string;
  category: string;
  month: string;
  budgetAmount: number;
  spentAmount: number;
  rolloverIn: number;
  rolloverOut: number;
  effectiveBudget: number;
  percentage: number;
  status: string;
}

interface FinanceBudgetsProps {
  budgets: BudgetItem[];
  dashboardData: DashboardData | null;
  selectedMonth: string;
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
  onAddBudget: () => void;
  onEditBudget: (b: BudgetItem) => void;
  onDeleteBudget: (id: string) => void;
}

export default function FinanceBudgets({
  budgets,
  dashboardData,
  selectedMonth,
  getCategoryMeta,
  onAddBudget,
  onEditBudget,
  onDeleteBudget,
}: FinanceBudgetsProps) {
  const [showHistory, setShowHistory] = useState(false);
  // ONE-CLICK-6 (Task 4-b): tapping a budget card body deep-links to the
  // Transactions sub-tab with this category's filter pre-applied (single
  // call — store primitive handles tab + sub-tab + focus).
  const openFinanceFocus = useAppStore(s => s.openFinanceFocus);

  const handleCardActivate = (category: string) => {
    openFinanceFocus({ category });
  };

  // Fetch budget snapshot history via TanStack Query.
  // Enabled only when the history panel is open (lazy fetch).
  // Replaces the old manual useState + fetch + silent-catch pattern
  // that left users stuck on a loading spinner if the API failed.
  const { data: historyData = [], isLoading: historyLoading, isError: historyError } = useQuery<BudgetSnapshot[]>({
    queryKey: ['finance', 'budget-snapshots'],
    queryFn: async () => {
      const res = await fetch('/api/finance/budgets/snapshot');
      if (!res.ok) throw new Error('Failed to load budget history');
      return res.json();
    },
    enabled: showHistory,
    staleTime: 30_000,
  });

  const toggleHistory = () => {
    setShowHistory(!showHistory);
  };

  // Group history by month
  const historyByMonth = historyData.reduce((acc, snap) => {
    if (!acc[snap.month]) acc[snap.month] = [];
    acc[snap.month].push(snap);
    return acc;
  }, {} as Record<string, BudgetSnapshot[]>);

  const sortedMonths = Object.keys(historyByMonth).sort().reverse();

  return (
    <div className="space-y-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Atur budget pengeluaran per kategori per bulan</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={toggleHistory}>
            <History className="h-4 w-4" />
            {showHistory ? 'Tutup' : 'Riwayat'}
          </Button>
          <Button size="sm" onClick={onAddBudget}>
            <Plus className="h-4 w-4" />
            Tambah
          </Button>
        </div>
      </div>

      {/* History Panel — PREMIUM-UI ("Rutina Aurora"): bare div .premium-card
          (NOT shadcn Card — Card's unlayered .card-shadow-premium would
          flatten the multi-layer premium shadow, see worklog 2-c) + chip-icon
          header + .premium-list-item rows per kategori. */}
      {showHistory && (
        <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="chip-icon chip-amber h-8 w-8" aria-hidden="true">
              <History className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold tracking-tight">Riwayat Budget</h3>
          </div>
            {historyLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </div>
            ) : historyError ? (
              <div className="text-center py-4">
                <p className="text-xs text-destructive font-medium">Gagal memuat history budget</p>
                <p className="text-xs text-muted-foreground mt-1">Coba tutup dan buka kembali.</p>
              </div>
            ) : sortedMonths.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Belum ada history budget</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {sortedMonths.map(month => {
                  const snaps = historyByMonth[month];
                  const totalBudget = snaps.reduce((s, b) => s + b.effectiveBudget, 0);
                  const totalSpent = snaps.reduce((s, b) => s + b.spentAmount, 0);
                  const totalRollover = snaps.reduce((s, b) => s + b.rolloverIn, 0);
                  const totalPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

                  return (
                    <div key={month} className="rounded-xl border border-border/70 bg-muted/25 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="premium-label">{month}</span>
                        <div className="flex items-center gap-2 text-xs">
                          {totalRollover > 0 && (
                            <span className="text-success flex items-center gap-0.5">
                              <TrendingUp className="h-3 w-3" /> +{formatRupiah(totalRollover)}
                            </span>
                          )}
                          <span className={cn(
                            'font-semibold px-1.5 py-0.5 rounded-full',
                            totalPct > 100
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : totalPct >= 80
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          )}>
                            {totalPct}%
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                        <span>Terpakai: {formatRupiah(totalSpent)}</span>
                        <span>Budget: {formatRupiah(totalBudget)}</span>
                      </div>
                      <Progress value={Math.min(totalPct, 100)} className={cn('h-1.5', totalPct > 100 && '[&>div]:bg-rose-500')} />
                      {/* Per-category detail — .premium-list-item rows with
                          emoji squircle avatar (tint warna kategori). */}
                      <div className="mt-2 space-y-0.5">
                        {snaps.map(snap => {
                          const meta = getCategoryMeta(snap.category);
                          return (
                            <div key={snap.id} className="premium-list-item px-2! py-1.5!">
                              <span
                                className="h-7 w-7 rounded-lg grid place-items-center text-sm shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                                style={{ backgroundColor: `${meta.color}20` }}
                                aria-hidden="true"
                              >
                                {meta.emoji}
                              </span>
                              <span className="flex-1 min-w-0 text-xs font-medium truncate flex items-center gap-1">
                                {snap.category}
                                {snap.rolloverIn > 0 && (
                                  <span className="text-success text-[11px] shrink-0">(+{formatRupiah(snap.rolloverIn)})</span>
                                )}
                              </span>
                              <span className={cn(
                                'text-xs font-medium shrink-0 tabular-nums',
                                snap.percentage > 100 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'
                              )}>
                                {formatRupiah(snap.spentAmount)}/{formatRupiah(snap.effectiveBudget)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      )}

      {/* Budget Cards */}
      {budgets.length === 0 ? (
        /* PREMIUM-UI: empty state dengan orb ilustrasi + CTA gradient
           (pola goals.tsx / finance-transactions.tsx). */
        <div
          className="premium-card premium-card-sheen rounded-2xl premium-fade-up"
          style={{ animationDelay: '60ms' }}
        >
          <div className="premium-empty min-h-[20rem] sm:min-h-[22rem]">
            <div className="premium-empty-orb" aria-hidden="true">
              <Target className="h-9 w-9 text-primary" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight mt-2">
              Mulai Atur Budget Pertamamu
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Tentukan batas pengeluaran per kategori — progress, sisa, dan
              laju harianmu terpantau otomatis di sini.
            </p>
            <Button
              size="sm"
              className="mt-3"
              onClick={onAddBudget}
            >
              <Plus className="h-4 w-4" />
              Buat Budget Pertama
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map((b, idx) => {
            const meta = getCategoryMeta(b.category);
            const dashboardBudget = dashboardData?.budgetStatus.find(db2 => db2.id === b.id);
            const spent = dashboardBudget?.spent || 0;
            const pct = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
            const isOver = pct > 100;
            const isWarning = pct >= 80 && pct <= 100;
            const remaining = Math.max(0, b.amount - spent);

            // Calculate remaining days in the selected month
            // FIN-BUG-5 fix: use jakartaNowParts() instead of browser-local
            // `new Date()` components. For users in timezones behind Jakarta
            // (e.g. US/Pacific), near Jakarta midnight the browser's local
            // day was off-by-one, making daysLeft one too many.
            const [bYear, bMonth] = selectedMonth.split('-').map(Number);
            const totalDaysInMonth = new Date(bYear, bMonth, 0).getDate();
            const jp = jakartaNowParts();
            const isCurrentMonth = jp.year === bYear && jp.month === bMonth;
            const daysLeft = isCurrentMonth ? Math.max(1, totalDaysInMonth - jp.day + 1) : null;

            return (
              <div
                key={b.id}
                role="button"
                tabIndex={0}
                aria-label={`Lihat transaksi kategori ${b.category}`}
                onClick={() => handleCardActivate(b.category)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardActivate(b.category);
                  }
                }}
                className={cn(
                  'group premium-card premium-card-sheen premium-card-hover rounded-2xl p-4 sm:p-5 cursor-pointer anim-stagger',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  'hover:ring-1 hover:ring-primary/25',
                  isOver && 'ring-1 ring-rose-500/30 dark:ring-rose-500/40',
                  !isOver && isWarning && 'ring-1 ring-amber-500/30 dark:ring-amber-500/40'
                )}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {/* Top row: icon + name + actions */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="h-9 w-9 rounded-xl grid place-items-center text-lg shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                      style={{ backgroundColor: `${meta.color}20` }}
                      aria-hidden="true"
                    >
                      {meta.emoji}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold truncate flex items-center gap-1">
                        {b.category}
                        {/* 1-click hint: panah kecil muncul/saturasi saat hover */}
                        <ArrowUpRight
                          className="h-3 w-3 shrink-0 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
                          aria-hidden="true"
                        />
                      </h3>
                      <p className="text-xs text-muted-foreground capitalize">{b.period === 'monthly' ? 'Per Bulan' : 'Per Minggu'}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                    {/* stopPropagation: tombol aksi tidak boleh memicu
                        deep-link kartu (Task 4-b A.2). */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      aria-label={`Edit budget ${b.category}`}
                      onClick={(e) => { e.stopPropagation(); onEditBudget(b); }}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:text-destructive"
                      aria-label={`Hapus budget ${b.category}`}
                      onClick={(e) => { e.stopPropagation(); onDeleteBudget(b.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Budget vs spent */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <div>
                      <span className="premium-stat text-lg">{formatRupiah(spent)}</span>
                      <span className="text-xs text-muted-foreground ml-1">/ {formatRupiah(b.amount)}</span>
                    </div>
                    <span className={cn(
                      'text-xs font-semibold px-2 py-0.5 rounded-full',
                      isOver
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        : isWarning
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    )}>
                      {pct}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <Progress
                    value={Math.min(pct, 100)}
                    className={cn('h-2 anim-progress-fill', isOver && '[&>div]:bg-rose-500', isWarning && '[&>div]:bg-amber-500')}
                  />

                  {/* Footer: remaining + daily rate */}
                  <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 mt-1">
                    <span className={cn('text-xs font-medium', isOver ? 'text-rose-600 dark:text-rose-400' : 'text-primary')}>
                      {isOver
                        ? `⚠️ Lebih ${formatRupiah(spent - b.amount)}`
                        : `✓ Sisa ${formatRupiah(remaining)}`
                      }
                    </span>
                    {b.amount > 0 && daysLeft !== null && !isOver && remaining > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ~{formatRupiah(Math.round(remaining / daysLeft))}/hari ({daysLeft}h lagi)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
