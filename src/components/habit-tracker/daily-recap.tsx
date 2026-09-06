'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { HelpInfoButton } from './help-calculation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  TrendingUp, TrendingDown, AlertTriangle, Target, Flame,
  Trophy, Sparkles, Clock, ArrowUpRight, ArrowDownRight,
  Activity, Brain, Award, RefreshCw, AlertCircle,
  Pencil,
} from 'lucide-react';
import { formatRupiah, compactRupiah } from './finance-types';
import { CountUpRupiah, CountUpNumber } from './count-up';
// Split-out sub-modules (SPLIT-PHASE2-UI):
import type { DailyRecap as DailyRecapData } from './daily-recap-types';
import { compactRupiahSafe, formatDateShort, formatTxTime } from './daily-recap-helpers';
import { MiniSparkline } from './daily-recap-sparkline';
import { ProgressRing } from './daily-recap-progress-ring';
import { HourlyHeatmap } from './daily-recap-hourly-heatmap';
import { BudgetDialog } from './daily-recap-budget-dialog';
import { CategoryInsightRow } from './daily-recap-category-insight';
import { ComparisonPill, AlertChip, StatTile } from './daily-recap-ui-chips';

// ── Main Component ───────────────────────────────────────────────────────

export default function DailyRecap() {
  const queryClient = useQueryClient();
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  // What-if slider state: 0-50% spending reduction for the rest of the month.
  // Local state (not persisted) — resets on page load. Computed client-side
  // from whatIfBase/daysElapsed/daysRemaining so there's no lag on drag.
  const [whatIfReduction, setWhatIfReduction] = useState(0);
  // Insight per kategori period tab: 'month' (current month) or 'alltime'.
  // Global state — all category rows show the same period. Default 'month'
  // because it's most relevant for daily context ("how am I doing this month?").
  // Local state (not persisted) — resets on page load.
  const [insightPeriod, setInsightPeriod] = useState<'month' | 'alltime'>('month');

  const { data: recap, isLoading, isError, refetch } = useQuery<DailyRecapData>({
    queryKey: ['finance', 'daily-recap'],
    queryFn: async () => {
      const res = await fetch('/api/finance/daily-recap');
      if (!res.ok) throw new Error('Failed to fetch daily recap');
      return res.json();
    },
    staleTime: 30_000,
    retry: 1,
  });

  // Lazy-load all-time per-category stats — ONLY fires when the user
  // switches to the "All-time" tab. This was moved out of the daily-recap
  // API for performance: the all-time query fetches ALL expense transactions
  // (potentially thousands), which was slowing down initial page load on
  // mobile/production. Now it loads on-demand.
  // The query is keyed by the category names (so it refetches if today's
  // categories change). staleTime 5min — all-time data doesn't change often.
  //
  // BUG-2 fix: capture isError + refetch so the UI can show an error state
  // with a retry button instead of getting stuck on "Memuat…" forever if
  // the POST fails (network error, 500, etc.).
  const allTimeCategories = recap?.today.categoryStats.map((c) => c.name) ?? [];
  const {
    data: allTimeStats,
    isError: allTimeIsError,
    refetch: refetchAllTime,
  } = useQuery<Record<string, { maxTransaction: number; avgTransaction: number; maxDaily: number; avgDaily: number }>>({
    queryKey: ['finance', 'category-alltime', allTimeCategories],
    queryFn: async () => {
      const res = await fetch('/api/finance/category-alltime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: allTimeCategories }),
      });
      if (!res.ok) throw new Error('Failed to load all-time stats');
      return res.json();
    },
    enabled: insightPeriod === 'alltime' && allTimeCategories.length > 0,
    staleTime: 5 * 60_000, // 5 min — all-time data is stable
    retry: 1,
  });

  // Mutation: save daily budget target via PUT /api/settings
  const saveBudgetMutation = useMutation({
    mutationFn: async (target: number) => {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyBudgetTarget: target }),
      });
      if (!res.ok) throw new Error('Failed to save budget');
      return res.json();
    },
    onSuccess: () => {
      // Invalidate both daily-recap (re-fetch with new budget) and settings
      queryClient.invalidateQueries({ queryKey: ['finance', 'daily-recap'] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Budget harian disimpan');
      setBudgetDialogOpen(false);
    },
    onError: () => {
      toast.error('Gagal menyimpan budget');
    },
  });

  // Mutation: save projection category selection via PUT /api/settings.
  // Sends the full array of selected category names (empty = all categories).
  // The API dedupes/sorts before storing, so we just send the raw selection.
  //
  // OPTIMISTIC UPDATE: the daily-recap query is heavy (30-day transaction
  // fetch + 15 metric computations). Without optimistic update, each dropdown
  // change caused a visible lag — the dropdown value wouldn't update until
  // the PUT + refetch round-trip completed (300-800ms). Now we immediately
  // patch the cached daily-recap's `projectionCategoryNames` so the dropdown
  // reflects the new selection instantly; the actual projection NUMBER
  // updates when the refetch completes (still server-side, still accurate).
  // On error, we roll back to the previous value.
  const saveProjectionCategoriesMutation = useMutation({
    mutationFn: async (categoryNames: string[]) => {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectionCategoryIds: categoryNames }),
      });
      if (!res.ok) throw new Error('Failed to save projection categories');
      return res.json();
    },
    onMutate: async (categoryNames: string[]) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic
      // update.
      await queryClient.cancelQueries({ queryKey: ['finance', 'daily-recap'] });
      // Snapshot the previous value for rollback.
      const previousRecap = queryClient.getQueryData<DailyRecapData>(['finance', 'daily-recap']);
      // Optimistically patch the cached recap's projectionCategoryNames +
      // projectionIsFiltered so the dropdown updates instantly.
      //
      // BUG-3 fix: Also reset whatIfBase to 0. The what-if slider computes
      // its result from `whatIfBase` (month-to-date spend of the CURRENT
      // basis). Without resetting it, the slider would use the STALE
      // whatIfBase (from the old filter) for 300-800ms until the refetch
      // completes — producing wrong numbers. Setting whatIfBase to 0
      // hides the slider via its `whatIfBase > 0` guard, so the user sees
      // a clean "loading" state instead of wrong numbers. The slider
      // reappears with the correct whatIfBase once the refetch completes.
      if (previousRecap) {
        queryClient.setQueryData<DailyRecapData>(['finance', 'daily-recap'], {
          ...previousRecap,
          predictions: {
            ...previousRecap.predictions,
            projectionCategoryNames: categoryNames,
            projectionIsFiltered: categoryNames.length > 0,
            whatIfBase: 0,
          },
        });
      }
      return { previousRecap };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'daily-recap'] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (_err, _vars, context) => {
      // Roll back to the previous cached value on error.
      if (context?.previousRecap) {
        queryClient.setQueryData(['finance', 'daily-recap'], context.previousRecap);
      }
      toast.error('Gagal menyimpan pilihan kategori');
    },
  });

  /**
   * Set the projection basis to a SINGLE category (single-select dropdown).
   * - Empty string = use all categories (default, "Semua" option).
   * - Non-empty = project based on that one category only.
   *
   * Single-select per the user's request — multi-select chips caused lag
   * (each toggle = PUT + heavy refetch) and were overkill for the use case
   * ("what's my month-end projection if I only consider Food spending?").
   *
   * BUG-3 fix: Reset whatIfReduction to 0 so the slider starts fresh on
   * the new basis. Without this, the slider would show a stale reduction
   * percentage (e.g., 20%) applied to the new basis — confusing.
   */
  function setProjectionCategory(categoryName: string) {
    if (saveProjectionCategoriesMutation.isPending) return;
    const next = categoryName ? [categoryName] : [];
    setWhatIfReduction(0);
    saveProjectionCategoriesMutation.mutate(next);
  }

  /** Open the budget dialog, pre-filling the input with the current target. */
  function openBudgetDialog(currentTarget: number | null) {
    // Format with thousand separators so the prefill matches what the
    // onChange handler would produce (was showing "100000" instead of "100.000").
    const formatted = currentTarget
      ? String(currentTarget).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
      : '';
    setBudgetInput(formatted);
    setBudgetDialogOpen(true);
  }

  /** Parse the formatted input ("100.000" → 100000) and save. */
  function handleSaveBudget() {
    // Guard against double-submit — Enter key + click, or rapid Enter presses,
    // could fire multiple concurrent mutations (race condition in PUT /api/settings).
    if (saveBudgetMutation.isPending) return;
    // Strip non-digits (handles "100.000", "100,000", " 100000 ")
    const digits = budgetInput.replace(/[^\d]/g, '');
    const target = digits ? parseInt(digits, 10) : 0;
    if (target > 100_000_000) {
      toast.error('Maksimal Rp 100.000.000');
      return;
    }
    saveBudgetMutation.mutate(target);
  }

  /** Remove the daily budget (set to 0 → ring hidden). */
  function handleRemoveBudget() {
    saveBudgetMutation.mutate(0);
  }

  // Error state — previously the skeleton rendered forever on API failure
  // because `isLoading` became false but `recap` stayed undefined.
  if (isError) {
    return (
      <Card className="overflow-hidden">
        <div className="p-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-destructive/10 text-destructive dark:bg-destructive/15 dark:text-destructive/80 shrink-0">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold">Gagal memuat rekap harian</p>
            <p className="text-[11px] text-muted-foreground">Coba lagi dalam sejenak</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-7 text-xs px-2 shrink-0"
          >
            <RefreshCw className="h-3 w-3" />
            Coba lagi
          </Button>
        </div>
      </Card>
    );
  }

  if (isLoading || !recap) {
    return (
      <Card className="overflow-hidden">
        <div className="p-4 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-40" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        </div>
      </Card>
    );
  }

  const { today, comparison, streaks, predictions, alerts, patterns, gamification, sparkline, dailyBudget } = recap;

  // ── Empty state: no transactions today ─────────────────────────────
  // Note: budget ring/button is still shown here so the user can set/view
  // their daily budget even on a no-transaction day (was previously hidden,
  // making the budget feature inaccessible until a transaction was logged).
  const isEmpty = today.transactionCount === 0 && today.income === 0;

  if (isEmpty) {
    return (
      <Card className="overflow-hidden anim-stagger contain-card">
        <div className="bg-gradient-to-br from-primary/[0.025] via-primary/[0.015] to-transparent px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground font-medium mb-1">Hari Ini</p>
              <p className="text-xl sm:text-2xl font-bold tracking-tight text-success">
                Rp 0
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                belum ada transaksi
              </p>
            </div>
            {/* Budget ring (or "Set budget" button) — same as non-empty state */}
            {dailyBudget && dailyBudget.target ? (
              <button
                type="button"
                onClick={() => openBudgetDialog(dailyBudget.target)}
                className="flex flex-col items-center gap-1 shrink-0 group cursor-pointer rounded-lg p-1 -m-1 hover:bg-muted/40 transition-colors"
                aria-label={`Budget harian ${dailyBudget.percentage}%, tap to edit`}
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
                <div className="flex items-center justify-center w-12 h-12 rounded-full text-muted-foreground group-hover:text-primary transition-colors">
                  <Target className="h-4 w-4" />
                </div>
                <span className="text-[11px] text-muted-foreground group-hover:text-primary transition-colors">
                  Set budget
                </span>
              </button>
            )}
          </div>
          <div className="text-center mt-3 pt-3 border-t border-border/40">
            <div className="text-2xl mb-1 anim-float-subtle">🌤️</div>
            <p className="text-xs font-medium">Belum ada aktivitas hari ini</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Catat transaksi pertama untuk mulai melacak insight harianmu
            </p>
            {patterns.personalityTag && (
              <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-background/60 backdrop-blur-sm border border-border/50">
                <span className="text-xs">{patterns.personalityTag.emoji}</span>
                <span className="text-[11px] font-medium">{patterns.personalityTag.tag}</span>
              </div>
            )}
          </div>
        </div>

        {/* Budget dialog (same as non-empty state) */}
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
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden anim-stagger contain-card">
      {/* ── HERO SECTION ─────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-primary/[0.025] via-primary/[0.015] to-transparent px-4 py-4 sm:px-6 sm:py-5">
        {/* Top row: label + date + budget ring */}
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <p className="text-xs text-muted-foreground font-medium">Hari Ini</p>
              {gamification.dailyBadge && (
                <Badge variant="secondary" className="text-[11px] py-0 px-1.5 gap-0.5">
                  <span>{gamification.dailyBadge.emoji}</span>
                  <span className="font-medium">{gamification.dailyBadge.name}</span>
                </Badge>
              )}
            </div>
            <p className={cn(
              'text-xl sm:text-3xl font-bold tracking-tight break-words',
              today.expense > 0 ? 'text-foreground' : 'text-success'
            )}>
              <CountUpRupiah amount={today.expense} />
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              total pengeluaran · <CountUpNumber value={today.expenseCount} /> transaksi
            </p>
          </div>

          {/* Budget ring — tap to edit (custom input dialog).
              If no budget set, show a "Set budget" button instead of the ring. */}
          {dailyBudget && dailyBudget.target ? (
            <button
              type="button"
              onClick={() => openBudgetDialog(dailyBudget.target)}
              className="flex flex-col items-center gap-1 shrink-0 group cursor-pointer rounded-lg p-1 -m-1 hover:bg-muted/40 transition-colors"
              aria-label={`Budget harian ${dailyBudget.percentage}%, tap to edit`}
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
              <div className="flex items-center justify-center w-12 h-12 rounded-full text-muted-foreground group-hover:text-primary transition-colors">
                <Target className="h-4 w-4" />
              </div>
              <span className="text-[11px] text-muted-foreground group-hover:text-primary transition-colors">
                Atur budget
              </span>
            </button>
          )}
        </div>

        {/* Comparison pills row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2">
          <ComparisonPill
            changePct={comparison.vsYesterday.changePct}
            direction={comparison.vsYesterday.direction}
            label="vs kemarin"
          />
          <ComparisonPill
            changePct={comparison.vs7DayAverage.changePct}
            direction={comparison.vs7DayAverage.direction}
            label="vs 7 hari"
          />
          {predictions.trendDirection.direction !== 'flat' && (
            <div className={cn(
              'flex items-center gap-1 text-xs font-medium min-w-0',
              predictions.trendDirection.direction === 'up' ? 'text-destructive' : 'text-success'
            )}>
              {predictions.trendDirection.direction === 'up' ? <TrendingUp className="h-3 w-3 shrink-0" /> : <TrendingDown className="h-3 w-3 shrink-0" />}
              <span className="truncate">Tren {predictions.trendDirection.direction === 'up' ? 'naik' : 'turun'}</span>
            </div>
          )}
        </div>

        {/* Sparkline — premium line chart with blue→purple gradient.
            Date labels (DD-Www) are rendered inside the component, one per
            data point, so we don't duplicate them here. */}
        <div className="mt-4">
          <MiniSparkline data={sparkline.daily7d} />
        </div>
      </div>

      {/* ── ALERTS (if any) ──────────────────────────────────────────── */}
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

      {/* ── 3 STAT TILES: income / expense / net ─────────────────────── */}
      <div className="border-t border-border" />
      <div className="grid grid-cols-3 divide-x divide-border">
        <div className="px-2 py-2.5 sm:px-3">
          <StatTile
            label="Masuk"
            value={<span className="tabular-nums">{compactRupiahSafe(today.income)}</span>}
            icon={ArrowUpRight}
            iconClass="bg-success/10 text-success dark:bg-success/15 dark:text-success/80"
            valueClass="text-success dark:text-success/80"
          />
        </div>
        <div className="px-2 py-2.5 sm:px-3">
          <StatTile
            label="Keluar"
            value={<span className="tabular-nums">{compactRupiahSafe(today.expense)}</span>}
            icon={ArrowDownRight}
            iconClass="bg-destructive/10 text-destructive dark:bg-destructive/15 dark:text-destructive/80"
            valueClass="text-destructive dark:text-destructive/80"
          />
        </div>
        <div className="px-2 py-2.5 sm:px-3">
          <StatTile
            label="Bersih"
            value={<span className="tabular-nums">{compactRupiahSafe(today.net)}</span>}
            icon={Activity}
            iconClass={cn(
              'bg-muted/50',
              today.net >= 0 ? 'text-success dark:text-success/80' : 'text-destructive dark:text-destructive/80'
            )}
            valueClass={today.net >= 0 ? 'text-success dark:text-success/80' : 'text-destructive dark:text-destructive/80'}
          />
        </div>
      </div>

      {/* ── BUDGET PROGRESS BAR (if set, and not already shown as ring) ── */}
      {dailyBudget && dailyBudget.target && dailyBudget.status === 'over' && (
        <>
          <div className="border-t border-border" />
          <div className="px-4 py-2.5 sm:px-6 bg-destructive/10 dark:bg-destructive/15 anim-flash-red">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-destructive dark:text-destructive/80 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
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

      {/* ── INSIGHTS GRID ────────────────────────────────────────────── */}
      <div className="border-t border-border" />
      <div className="px-4 py-3 sm:px-6 space-y-3">

        {/* Personality tag + streaks row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
            <span className="text-sm">{patterns.personalityTag.emoji}</span>
            <span className="text-xs font-semibold text-primary">{patterns.personalityTag.tag}</span>
          </div>
          {streaks.noSpendStreak > 0 && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 text-xs font-medium">
              <Sparkles className="h-3 w-3" />
              {streaks.noSpendStreak} hari no-spend
            </div>
          )}
          {streaks.smartSpenderStreak >= 2 && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success dark:bg-success/15 dark:text-success/80 text-xs font-medium">
              <Flame className="h-3 w-3" />
              {streaks.smartSpenderStreak}× hemat
            </div>
          )}
          {streaks.budgetStreak >= 2 && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <Target className="h-3 w-3" />
              {streaks.budgetStreak}× on budget
            </div>
          )}
          {gamification.comboMultiplier > 1 && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 text-warning dark:bg-warning/15 dark:text-warning/80 text-xs font-bold">
              🔥 {gamification.comboMultiplier}× Combo
            </div>
          )}
        </div>

        {/* Personality description */}
        <p className="text-xs text-muted-foreground italic">
          {patterns.personalityTag.description}
        </p>

        {/* ── PROYEKSI SECTION (enriched) ──────────────────────────────── */}
        {/* Mixed tone: data-driven (numbers) + actionable (recommendations)
            + gamified (compliance %) + playful (confidence emoji) */}
        <div className="rounded-xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 p-3 space-y-3">
          {/* BUG-3 complete fix: when the user changes the category dropdown,
              an optimistic update patches `projectionCategoryNames` +
              `projectionIsFiltered` (so the dropdown updates instantly) and
              `whatIfBase: 0` (so the slider hides). But the OTHER projection
              fields (monthEndProjection, projectionBurnRate, projectionConfidence,
              projectionFullProjection, topProjectedCategory, lastMonthAccuracy)
              are STALE — they still reflect the old category basis until the
              background refetch completes (300-800ms). Showing stale numbers
              next to an updated dropdown is confusing ("I switched to Transport,
              why does it still show Makanan's number?").

              Fix: while `saveProjectionCategoriesMutation.isPending`, render
              skeleton placeholders for the number + badges area. The dropdown
              stays visible (optimistic on categoryNames). When refetch
              completes, `isPending` flips to false and the real numbers
              appear — consistent with the dropdown's selected category. */}
          {/* Header: proyeksi + confidence */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">Proyeksi Akhir Bulan</span>
                <HelpInfoButton section="proyeksi" label="Proyeksi" />
              </div>
              {saveProjectionCategoriesMutation.isPending ? (
                <>
                  <Skeleton className="h-6 w-36 rounded-md" />
                  <Skeleton className="h-3 w-28 rounded-md mt-1" />
                </>
              ) : (
                <>
                  <p className="text-lg font-bold tabular-nums">{formatRupiah(predictions.monthEndProjection)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    rate {compactRupiahSafe(predictions.projectionBurnRate)}/hari
                    {/* "vs semua" comparison — only shown when the user has
                        filtered to specific categories, so they can see how
                        their selection compares to the all-categories projection. */}
                    {predictions.projectionIsFiltered && predictions.projectionFullProjection !== null && (
                      <span className="ml-1.5 text-muted-foreground/70">
                        · vs semua {compactRupiahSafe(predictions.projectionFullProjection)}
                      </span>
                    )}
                  </p>
                </>
              )}
            </div>
            {/* Confidence badge + Accuracy badge (Fase 3) */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              {saveProjectionCategoriesMutation.isPending ? (
                <>
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-3.5 w-20 rounded-full" />
                </>
              ) : (
                <>
                  {predictions.projectionConfidence && (
                    <div className={cn(
                      'px-2 py-1 rounded-full text-[11px] font-medium border',
                      predictions.projectionConfidence === 'high'
                        ? 'bg-success/10 text-success border-success/30 dark:bg-success/15 dark:text-success/80 dark:border-success/30'
                        : predictions.projectionConfidence === 'medium'
                        ? 'bg-warning/10 text-warning border-warning/30 dark:bg-warning/15 dark:text-warning/80 dark:border-warning/30'
                        : 'bg-destructive/10 text-destructive border-destructive/30 dark:bg-destructive/15 dark:text-destructive/80 dark:border-destructive/30'
                    )}>
                      {predictions.projectionConfidence === 'high' ? '🎯 Akurat' : predictions.projectionConfidence === 'medium' ? '⚖️ Cukup' : '🎲 Kasar'}
                    </div>
                  )}
              {/* Accuracy badge (Fase 3) — shows how accurate last month's
                  projection was. tier: accurate (≤10% off), close (≤25%), off (>25%).
                  Only shown when lastMonthAccuracy is non-null (needs ≥3 days
                  elapsed + last-month transaction data). */}
              {predictions.lastMonthAccuracy && (
                <div
                  className="px-2 py-1 rounded-full text-[11px] font-medium border flex items-center gap-0.5"
                  title={`Bulan lalu: proyeksi ${compactRupiahSafe(predictions.lastMonthAccuracy.projected)} vs aktual ${compactRupiahSafe(predictions.lastMonthAccuracy.actual)} (selisih ${predictions.lastMonthAccuracy.deviationPct}%)`}
                >
                  {predictions.lastMonthAccuracy.tier === 'accurate' && (
                    <span className="text-success dark:text-success/80 border-success/30 dark:border-success/30 inline-flex items-center gap-0.5">
                      <Award className="h-2.5 w-2.5" /> Proyektor Andal
                    </span>
                  )}
                  {predictions.lastMonthAccuracy.tier === 'close' && (
                    <span className="text-warning dark:text-warning/80 border-warning/30 dark:border-warning/30">
                      ±{predictions.lastMonthAccuracy.deviationPct}% bulan lalu
                    </span>
                  )}
                  {predictions.lastMonthAccuracy.tier === 'off' && (
                    <span className="text-muted-foreground border-border">
                      ±{predictions.lastMonthAccuracy.deviationPct}% bulan lalu
                    </span>
                  )}
                </div>
              )}
                </>
              )}
            </div>
          </div>

          {/* ── Category basis dropdown (single-select) ────────────────── */}
          {/* Lets the user pick ONE expense category to base the projection on,
              or "Semua" for all categories (default). Single-select dropdown
              per user request — multi-select chips caused lag (each toggle =
              PUT + heavy refetch) and were overkill for the use case.
              Only categories WITH transactions are listed (the API filters
              out empty categories). Persisted to AppSettings via PUT
              /api/settings. Optimistic update on the cached daily-recap
              makes the dropdown feel instant (projection NUMBER updates
              when the background refetch completes).
              NOTE: Radix Select doesn't support empty string "" as a value
              (treats it as undefined → shows placeholder). So we use the
              sentinel "__all__" for the "Semua kategori" option and convert
              to/from an empty array in the handler. */}
          {predictions.availableExpenseCategories.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide shrink-0">
                Dasar
              </span>
              <Select
                value={predictions.projectionCategoryNames[0] ?? '__all__'}
                onValueChange={(v) => setProjectionCategory(v === '__all__' ? '' : v)}
                disabled={saveProjectionCategoriesMutation.isPending}
              >
                <SelectTrigger className="h-7 text-[11px] px-2 py-0 min-w-0 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__" className="text-[11px]">
                    <span className="font-medium">Semua kategori</span>
                  </SelectItem>
                  {predictions.availableExpenseCategories.map((cat) => (
                    <SelectItem key={cat.name} value={cat.name} className="text-[11px]">
                      <span className="mr-1">{cat.emoji}</span>
                      <span className="truncate">{cat.name}</span>
                    </SelectItem>
                  ))}
                  {/* BUG-4 fix: Fallback SelectItem for a saved category that
                      is NOT in availableExpenseCategories. This happens when:
                      (a) the category was deleted from the FinanceCategory
                      table, or (b) the category has no transactions in the
                      last 30 days (so the API filtered it out). Without this
                      fallback, the dropdown value wouldn't match any option
                      and Radix Select would render blank — the user couldn't
                      see or reset their stale selection. We render it with a
                      "(no tx)" badge so the user knows it's inactive and can
                      switch to "Semua" or another category. */}
                  {(() => {
                    const saved = predictions.projectionCategoryNames[0];
                    if (!saved) return null;
                    const isInList = predictions.availableExpenseCategories.some(
                      (c) => c.name === saved
                    );
                    if (isInList) return null;
                    return (
                      <SelectItem value={saved} className="text-[11px]">
                        <span className="mr-1">📦</span>
                        <span className="truncate">{saved}</span>
                        <span className="ml-1 text-[9px] text-muted-foreground italic">(no tx)</span>
                      </SelectItem>
                    );
                  })()}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ── What-if slider (Fase 3) ────────────────────────────────── */}
          {/* Lets the user ask "if I cut spending by X% for the rest of the
              month, what's my new projection?". Computed CLIENT-SIDE from
              whatIfBase/daysElapsed/daysRemaining for instant feedback (no
              refetch on every slider drag). Only shown when there are
              remaining days in the month (on the last day, no what-if needed). */}
          {predictions.whatIfDaysRemaining > 0 && predictions.whatIfDaysElapsed > 0 && predictions.whatIfBase > 0 && (() => {
            // Compute the adjusted projection for the current slider value.
            // Formula: base + (base / daysElapsed) × (1 - reduction/100) × daysRemaining
            // = what the projection becomes if the user cuts the daily rate
            //   by `reduction`% for the rest of the month.
            const dailyRate = predictions.whatIfBase / predictions.whatIfDaysElapsed;
            const currentProjection = predictions.whatIfBase + dailyRate * predictions.whatIfDaysRemaining;
            const adjustedProjection = predictions.whatIfBase + dailyRate * (1 - whatIfReduction / 100) * predictions.whatIfDaysRemaining;
            const savings = Math.round(currentProjection - adjustedProjection);
            const adjustedRounded = Math.round(adjustedProjection);
            return (
              <div className="rounded-lg bg-background/60 px-2.5 py-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide shrink-0 flex items-center gap-0.5">
                    <Sparkles className="h-2.5 w-2.5" /> What if
                  </span>
                  <span className="text-[10px] font-medium tabular-nums text-muted-foreground shrink-0">
                    Hemat {whatIfReduction}%
                  </span>
                </div>
                <Slider
                  value={[whatIfReduction]}
                  onValueChange={(v) => setWhatIfReduction(v[0] ?? 0)}
                  min={0}
                  max={50}
                  step={5}
                  className="py-1 [&_[data-radix-slider-thumb]]:h-5 [&_[data-radix-slider-thumb]]:w-5 [&_[data-radix-slider-thumb]]:border-2"
                  aria-label="Persentase pengurangan pengeluaran what-if"
                />
                {/* Result: only show the adjusted number when reduction > 0
                    (at 0%, it would just repeat the current projection). */}
                {whatIfReduction > 0 ? (
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">Proyeksi jadi</span>
                    <span className="text-sm font-bold tabular-nums text-primary">
                      {formatRupiah(adjustedRounded)}
                    </span>
                    <span className="text-[10px] text-success font-medium shrink-0 ml-auto">
                      −{compactRupiahSafe(savings)}
                    </span>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground/60 italic">
                    Geser untuk simulasi hemat sisa {predictions.whatIfDaysRemaining} hari
                  </p>
                )}
              </div>
            );
          })()}

          {/* MOBILE-6 fix: Wrap smart recommendations (compliance + smart cap +
              countdown + top category + over budget) in a collapsible on mobile
              to reduce cognitive overload. On desktop, always expanded. */}
          {/* Budget compliance progress bar.
              Audit fix: relaxed guard from `dailyBudget && dailyBudget.target`
              to just `budgetCompliancePct !== null`. The API computes
              budgetCompliancePct from BOTH daily budget AND weekly budgets
              (whichever is set). Previously, users who only set weekly
              budgets (no daily budget) never saw the compliance % even
              though the server computed it every request. Now it shows
              whenever there's any budget target (daily or weekly). */}
          {predictions.budgetCompliancePct !== null && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-muted-foreground">Kemungkinan on budget</span>
                <span className={cn(
                  'text-[11px] font-bold tabular-nums',
                  predictions.budgetCompliancePct >= 70 ? 'text-success'
                  : predictions.budgetCompliancePct >= 40 ? 'text-warning'
                  : 'text-destructive'
                )}>
                  {predictions.budgetCompliancePct}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    predictions.budgetCompliancePct >= 70 ? 'bg-success'
                    : predictions.budgetCompliancePct >= 40 ? 'bg-warning'
                    : 'bg-destructive'
                  )}
                  style={{ width: `${predictions.budgetCompliancePct}%` }}
                />
              </div>
            </div>
          )}

          {/* Smart recommendation + countdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {predictions.smartCapTomorrow !== null && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background/60">
                <Target className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-[11px] text-muted-foreground">
                  Besok max <span className="font-semibold text-foreground">{compactRupiahSafe(predictions.smartCapTomorrow)}</span>
                </span>
              </div>
            )}
            {predictions.daysUntilBudgetOut !== null && predictions.daysUntilBudgetOut > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background/60">
                <Clock className="h-3.5 w-3.5 text-warning shrink-0" />
                <span className="text-[11px] text-muted-foreground">
                  Budget habis dalam <span className="font-semibold text-foreground">{predictions.daysUntilBudgetOut} hari</span>
                </span>
              </div>
            )}
          </div>

          {/* Top projected category — changes with the category filter, so
              hide during the refetch window (stale value would be misleading).
              The compliance bar / smart cap / countdown above are based on
              OVERALL spending (not filtered), so they stay visible. */}
          {!saveProjectionCategoriesMutation.isPending && predictions.topProjectedCategory && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background/60">
              <span className="text-sm shrink-0">{predictions.topProjectedCategory.emoji}</span>
              <span className="text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">{predictions.topProjectedCategory.name}</span> proyeksi{' '}
                <span className="font-semibold text-foreground">{compactRupiahSafe(predictions.topProjectedCategory.projected)}</span>
                {' '}({predictions.topProjectedCategory.pct}% dari total)
              </span>
            </div>
          )}

          {/* Over budget warning */}
          {predictions.budgetETA && predictions.budgetETA.willExceed && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-destructive/10 dark:bg-destructive/15 border border-destructive/30 dark:border-destructive/30">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
              <span className="text-[11px] text-destructive dark:text-destructive/80">
                Over budget <span className="font-bold">{formatRupiah(predictions.budgetETA.projectedOver)}</span>
              </span>
            </div>
          )}
        </div>

        {/* Top transaction (largest single expense today) — kept per user request.
            The "Spending tertinggi" (peak hour) row was removed because the
            hourly heatmap below already visualizes peak activity.
            Emoji is looked up from categoryStats (which carries the DB emoji). */}
        {today.topTransaction && (() => {
          const topCat = today.topTransaction.category;
          const meta = today.categoryStats.find((c) => c.name === topCat)
            ?? today.categories.find((c) => c.name === topCat);
          return (
            <div className="flex items-center gap-1.5 text-xs min-w-0">
              <Trophy className="h-3.5 w-3.5 text-warning shrink-0" />
              <span className="text-muted-foreground shrink-0">Terbesar:</span>
              {meta && <span className="text-sm shrink-0">{meta.emoji}</span>}
              <span className="font-medium truncate">{topCat}</span>
              <span className="text-muted-foreground shrink-0">·</span>
              <span className="font-medium shrink-0">{compactRupiahSafe(today.topTransaction.amount)}</span>
            </div>
          );
        })()}

        {/* Per-category deep insights — only categories with transactions today.
            Shows today's amount + delta vs avg daily, plus max/avg per-tx and
            per-day stats. Two period tabs: "Bulan ini" (current month) and
            "All-time" (all transactions ever). The 30-day stats still power
            the delta badge + anomaly z-score internally but aren't shown in
            the tab UI (redundant with "Bulan ini" for early-month users).
            Placed above the hourly heatmap because it's more actionable
            (category-level pattern vs time-of-day). */}
        {today.categoryStats.length > 0 && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1">
                <Brain className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Insight per kategori</span>
                <HelpInfoButton section="insight" label="Insight per kategori" />
              </div>
              {/* Period tab switcher — 2 compact pill buttons.
                  Global state (all rows show same period). Default 'month'. */}
              <div className="flex items-center gap-0.5 bg-muted/40 rounded-full p-0.5">
                <button
                  type="button"
                  onClick={() => setInsightPeriod('month')}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-[10px] font-medium transition-colors min-h-[36px] flex items-center',
                    insightPeriod === 'month'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Bulan ini
                </button>
                <button
                  type="button"
                  onClick={() => setInsightPeriod('alltime')}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-[10px] font-medium transition-colors min-h-[36px] flex items-center',
                    insightPeriod === 'alltime'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  All-time
                </button>
              </div>
            </div>
            <div className="rounded-lg bg-muted/20 px-2.5 py-0.5">
              {today.categoryStats.map((cat, idx) => {
                const pct = today.expense > 0 ? Math.round((cat.todayAmount / today.expense) * 100) : 0;
                // Merge lazy-loaded all-time stats into the category stats.
                // When insightPeriod === 'alltime' and allTimeStats has loaded,
                // replace the 0 placeholders with real data. Until loaded,
                // the row shows a loading state.
                const allTime = allTimeStats?.[cat.name];
                const mergedStats = allTime
                  ? {
                      ...cat,
                      allTimeMaxTransaction: allTime.maxTransaction,
                      allTimeAvgTransaction: allTime.avgTransaction,
                      allTimeMaxDaily: allTime.maxDaily,
                      allTimeAvgDaily: allTime.avgDaily,
                    }
                  : cat;
                return (
                  <CategoryInsightRow
                    key={cat.name}
                    stats={mergedStats}
                    pct={pct}
                    period={insightPeriod}
                    allTimeLoading={insightPeriod === 'alltime' && !allTimeStats && !allTimeIsError}
                    allTimeError={insightPeriod === 'alltime' && allTimeIsError}
                    onRetryAllTime={refetchAllTime}
                    staggerIndex={idx}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Hourly heatmap */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Aktivitas per jam</span>
              <HelpInfoButton section="heatmap" label="Aktivitas per jam" />
            </div>
            <span className="text-[11px] text-muted-foreground">48×30menit</span>
          </div>
          <HourlyHeatmap hourly={today.hourlyBreakdown} />
        </div>

        {/* Category pills section removed — redundant with "Insight per
            kategori" above, which shows the same name + today amount plus
            max/avg stats and delta. The pct (proportion of total expense)
            is now shown inline in each CategoryInsightRow to preserve that
            info without duplicating the category list. */}

        {/* Gamification: personal record */}
        {gamification.personalRecord && (
          <div className={cn(
            'rounded-lg p-2.5 border',
            gamification.personalRecord.isRecord
              ? 'bg-warning/10 border-warning/30 dark:bg-warning/15 dark:border-warning/30'
              : 'bg-muted/30 border-border/50'
          )}>
            <div className="flex items-center gap-2">
              <Award className={cn(
                'h-4 w-4 shrink-0',
                gamification.personalRecord.isRecord ? 'text-warning' : 'text-muted-foreground'
              )} />
              <div className="flex-1 min-w-0">
                {gamification.personalRecord.isRecord ? (
                  <>
                    <p className="text-xs font-bold text-warning dark:text-warning/80">
                      🏆 NEW RECORD! Pengeluaran terendah {gamification.personalRecord.totalDays} hari
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Peringkat #{gamification.personalRecord.rank} terendah dari {gamification.personalRecord.totalDays} hari
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Best/worst day reference */}
        {(patterns.bestDayThisMonth || patterns.worstDayThisMonth) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {patterns.bestDayThisMonth && (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-success shrink-0">🏆</span>
                <span className="text-muted-foreground shrink-0">Terbesar:</span>
                <span className="font-medium shrink-0">{formatDateShort(patterns.bestDayThisMonth.date)}</span>
                <span className="text-muted-foreground shrink-0">·</span>
                <span className="font-medium truncate">{compactRupiahSafe(patterns.bestDayThisMonth.amount)}</span>
              </div>
            )}
            {patterns.worstDayThisMonth && (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-destructive shrink-0">📉</span>
                <span className="text-muted-foreground shrink-0">Terkecil:</span>
                <span className="font-medium shrink-0">{formatDateShort(patterns.worstDayThisMonth.date)}</span>
                <span className="text-muted-foreground shrink-0">·</span>
                <span className="font-medium truncate">{compactRupiahSafe(patterns.worstDayThisMonth.amount)}</span>
              </div>
            )}
          </div>
        )}

        {/* Cash flow health + savings rate */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/30 p-2.5">
            <div className="flex items-center gap-1 mb-0.5">
              <Activity className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Arus kas</span>
              <HelpInfoButton section="cashflow" label="Arus kas" />
            </div>
            <p className={cn(
              'text-sm font-bold',
              patterns.cashFlowHealth.status === 'healthy' ? 'text-success'
              : patterns.cashFlowHealth.status === 'warning' ? 'text-warning'
              : 'text-destructive'
            )}>
              {patterns.cashFlowHealth.status === 'healthy' ? 'Sehat'
              : patterns.cashFlowHealth.status === 'warning' ? 'Hati-hati'
              : 'Boros'}
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 p-2.5">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Tingkat menabung</span>
            </div>
            <p className={cn(
              'text-sm font-bold',
              patterns.savingsRate >= 50 ? 'text-success'
              : patterns.savingsRate >= 0 ? 'text-warning'
              : 'text-destructive'
            )}>
              {patterns.savingsRate}%
            </p>
          </div>
        </div>

        {/* Category anomaly (if any anomaly detected) */}
        {patterns.categoryAnomaly.filter((c) => c.isAnomaly).length > 0 && (
          <div className="rounded-lg bg-warning/10 dark:bg-warning/15 border border-warning/30 dark:border-warning/30 p-2.5">
            <div className="flex items-center gap-1 mb-1">
              <AlertTriangle className="h-3 w-3 text-warning" />
              <span className="text-[11px] text-warning dark:text-warning/80 uppercase tracking-wide font-medium">Anomali terdeteksi</span>
            </div>
            {patterns.categoryAnomaly.filter((c) => c.isAnomaly).map((c) => (
              <p key={c.category} className="text-xs text-warning dark:text-warning/80">
                {c.category} {formatRupiah(c.amount)} — {c.zScore}σ di atas normal ({compactRupiah(c.avgAmount)})
              </p>
            ))}
          </div>
        )}

        {/* Today's transactions list (compact) */}
        {today.transactions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Transaksi hari ini</span>
              </div>
              {today.transactionCount > today.transactions.length && (
                <span className="text-[11px] text-muted-foreground">+{today.transactionCount - today.transactions.length} lainnya</span>
              )}
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar cv-auto">
              {today.transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-2 py-1 text-xs">
                  <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-12">
                    {formatTxTime(tx.date)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {tx.description || tx.category}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {tx.category} · {tx.source}
                    </p>
                  </div>
                  <span className={cn(
                    'font-semibold tabular-nums shrink-0',
                    tx.type === 'income' ? 'text-success' : 'text-destructive'
                  )}>
                    {tx.type === 'income' ? '+' : '−'}{compactRupiahSafe(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Daily Budget Edit Dialog (reusable component) ─────────────── */}
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
    </Card>
  );
}
