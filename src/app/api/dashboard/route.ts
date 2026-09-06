import { NextRequest, NextResponse } from 'next/server';
import {
  startOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
  differenceInCalendarDays,
} from '@/lib/date-utils';
// PERF-FIX (FIX-TIER3 / Fix 15): replaced `date-fns` with native Intl-based
// utility module. Output is identical for all patterns and helpers used
// here (yyyy-MM-dd, EEE, MMM dd + startOfDay/subDays/startOfWeek/endOfWeek/
// startOfMonth/endOfMonth/differenceInCalendarDays) — verified via test
// script in worklog FIX-TIER3 entry.
import { jakartaToday } from '@/lib/timezone';
import {
  type Period,
  getPeriodDays,
  buildHabitCreatedDates,
  buildDailyCompletionMap,
  fetchDashboardBaseData,
  fetchDashboardLogData,
  computeCompletionStats,
  buildWeeklyChart,
  buildMonthlyChart,
  buildStackedBarChart,
  buildWeeklyPatternChart,
  computeFinanceOverview,
  computeTimeTrackedSummary,
  computeLastDoneSummary,
} from '@/lib/dashboard';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period: Period = (searchParams.get('period') as Period) || 'all';

    // ── Date params (Jakarta timezone) ───────────────────────────────
    const today = jakartaToday();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const todayKey = format(today, 'yyyy-MM-dd');

    // ── Phase 1: parallel fetch of all independent queries ───────────
    // 6 queries run in parallel; each is wrapped in `safe()` so one
    // failure (e.g. missing table on a fresh DB) doesn't abort the
    // others. `select` clauses drop unused columns.
    const {
      diffOptions,
      habits,
      activeGoals,
      recentDailyLogs,
      monthTransactions,
      budgets,
    } = await fetchDashboardBaseData(today, monthStart, monthEnd);

    // Build XP map from database (graceful fallback if HabitOption table is empty)
    const xpMap: Record<string, number> = {};
    diffOptions.forEach(d => { xpMap[d.name] = d.xp; });
    if (Object.keys(xpMap).length === 0) {
      xpMap['Easy'] = 10;
      xpMap['Medium'] = 20;
      xpMap['Hard'] = 40;
    }

    const totalHabits = habits.length;

    // Pre-sort habit creation dates for O(log n) binary search lookups
    const habitCreatedDates = buildHabitCreatedDates(habits);

    // ── Determine period start date ──────────────────────────────────
    let periodStart: Date;
    if (period === 'all') {
      if (habits.length > 0) {
        const earliest = new Date(Math.min(...habits.map(h => h.createdAt.getTime())));
        periodStart = startOfDay(earliest);
      } else {
        periodStart = subDays(today, 30);
      }
    } else {
      const days = getPeriodDays(period);
      periodStart = subDays(today, days);
    }

    const periodDays = differenceInCalendarDays(today, periodStart) + 1; // inclusive

    // Determine chart days for display.
    // Cap at 365 to prevent unbounded loops when period='all' and user has
    // years of data (could otherwise loop thousands of times).
    const chartDays = Math.min(
      period === '7d' ? 7 : period === '1m' ? 30 : period === '3m' ? 90 : period === '6m' ? 180 : period === '1y' ? 365 : periodDays,
      365
    );

    const activeHabitIds = new Set(habits.map(h => h.id));
    // Pre-compute time-tracked + last-done habit ID lists for Phase 2.
    const timeHabitIds = habits.filter(h => h.trackTime).map(h => h.id);
    const lastDoneIds = habits.filter(h => h.trackLastDone).map(h => h.id);

    // ── Phase 2: parallel fetch of dependent queries ─────────────────
    // 3 queries run in parallel; time/latest are conditional (skipped
    // when there are no relevant habits) to avoid needless DB round-trips.
    const {
      allLogsRaw,
      allTimeLogs,
      latestLogs,
    } = await fetchDashboardLogData(
      periodStart, today, weekStart, weekEnd, timeHabitIds, lastDoneIds,
    );

    // Filter allLogs to only active habits (post-query, since the DB query
    // can't filter on a JS Set).
    const allLogs = allLogsRaw.filter(l => activeHabitIds.has(l.habitId));

    // Build the shared daily-completion map (dateStr → Set of habitIds
    // completed that day). Consumed by both completion-stats and the
    // chart builders — built once here to avoid re-iterating allLogs.
    const dailyCompletionMap = buildDailyCompletionMap(allLogs);

    // ── Per-period completion stats (today/week/month, streak, XP, ...) ──
    const stats = computeCompletionStats({
      habits,
      allLogs,
      xpMap,
      activeGoals,
      recentDailyLogs,
      today,
      todayKey,
      weekStart,
      weekEnd,
      monthStart,
      monthEnd,
      periodStart,
      periodDays,
      habitCreatedDates,
      dailyCompletionMap,
    });

    // ── Chart data (weekly / monthly / stacked-bar / weekly-pattern) ──
    const weeklyChartData = buildWeeklyChart(dailyCompletionMap, habitCreatedDates, today);
    const monthlyChartData = buildMonthlyChart(dailyCompletionMap, habitCreatedDates, today, chartDays);
    const stackedBarData = buildStackedBarChart(dailyCompletionMap, habitCreatedDates, today, chartDays, period);
    const weeklyPattern = buildWeeklyPatternChart(dailyCompletionMap, habitCreatedDates, today);

    // ── Finance overview (current month) ─────────────────────────────
    const financeOverview = computeFinanceOverview(monthTransactions, budgets);

    // ── Time-tracked habits summary (this week) ──────────────────────
    const timeTrackedSummary = computeTimeTrackedSummary(
      habits, allTimeLogs, weekStart, weekEnd, today, todayKey,
    );

    // ── Last-done habits summary ─────────────────────────────────────
    const lastDoneSummary = computeLastDoneSummary(habits, latestLogs, today);

    // ── Assemble response (shape MUST stay identical) ────────────────
    return NextResponse.json({
      totalHabits,
      completionRate: stats.completionRate,
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      successToday: stats.successToday,
      weeklyCompletion: stats.weeklyCompletion,
      monthlyCompletion: stats.monthlyCompletion,
      bestHabit: stats.bestHabit,
      worstHabit: stats.worstHabit,
      totalXP: stats.totalXP,
      currentLevel: stats.currentLevel,
      nextLevelXP: stats.nextLevelXP,
      currentLevelXP: stats.currentLevelXP,
      levelProgress: stats.levelProgress,
      goalProgress: stats.goalProgress,
      moodAverage: stats.moodAverage,
      sleepAverage: stats.sleepAverage,
      productivityScore: stats.productivityScore,
      weeklyChartData,
      monthlyChartData,
      categoryPerformance: stats.categoryPerformance,
      todayFocus: stats.todayFocus,
      period,
      // Detailed data
      habitDetailStats: stats.habitDetailStats,
      stackedBarData,
      weeklyPattern,
      // Finance
      financeOverview,
      // Time-tracked habits
      timeTrackedSummary,
      // Last done habits
      lastDoneSummary,
    }, {
      headers: {
        // CLIENT-DEBUG-1: previously `private, max-age=30, stale-while-revalidate=60`
        // which let the browser HTTP cache serve STALE EMPTY dashboard data for
        // up to 90s after a DB migration / disconnect. The SW is network-only
        // for /api/, but the SW's fetch() still goes through the HTTP cache
        // (because we don't pass `cache: 'no-store'`). After the Turso DB
        // migration, users who hit /api/dashboard during the empty-DB window
        // saw "no data" for ~90s even after the DB was fixed. `no-store`
        // disables all HTTP caching of this response — every request goes
        // to the origin. React Query's in-memory cache (staleTime 30s) still
        // provides client-side dedup, so DB load is not significantly higher.
        // BUG-SW-PERF BUG-1: Reverted PERF-FIX s-maxage=60 edge cache.
        // Reason: this endpoint serves per-user mutation-sensitive data
        // (habits, logs, daily logs). React Query's invalidateQueries()
        // after a habit-check mutation triggers an immediate refetch —
        // but the refetch hits the Vercel edge cache (still fresh within
        // s-maxage=60s) and returns the OLD response, so the user does
        // not see their habit-check reflected for up to ~120s (s-maxage
        // 60s + React Query staleTime 60s). For a single-user personal
        // tracker the stale-data UX is worse than the marginal cold-load
        // perf gain from edge caching. React Query's client-side cache
        // (staleTime=60s) already provides dedup + perceived perf.
        // Verified: Vercel edge cache HIT on 2nd request confirmed the
        // cache was active and serving stale data.
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('GET /api/dashboard error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 });
  }
}
