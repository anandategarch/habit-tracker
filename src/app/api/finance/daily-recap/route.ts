import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { jakartaDateString, jakartaDateKey, jakartaNowParts, jakartaMonthString } from '@/lib/timezone';

import {
  buildAlerts,
  buildCategoryStats,
  buildDailyRecapContext,
  buildPatterns,
  buildProjectionBasis,
  buildProjectionEnrichment,
  computeComparisons,
  computeDailyBudget,
  computeGamification,
  computeNoSpendStreak,
  computeSmartSpenderStreak,
  computeTodayAggregates,
} from '@/lib/finance/daily-recap';
import { resolveCategoryMeta } from '@/lib/finance/daily-recap/helpers';
import type {
  AppSettingsRow,
  DailyRecapResponse,
} from '@/lib/finance/daily-recap/types';

// ── Main Handler ─────────────────────────────────────────────────────────

export async function GET() {
  try {
    const todayStr = jakartaDateString();
    const todayParts = jakartaNowParts();
    const monthKey = jakartaMonthString();

    // ── Fetch transactions: today + last 7 days + this month ─────────
    // We need:
    //   - Today's transactions (full detail, for breakdown)
    //   - Last 7 days of expense totals (for avg, trend, sparkline)
    //   - This month's daily expense totals (for best/worst day, projection)
    //   - Yesterday's transactions (for recurring detection, hour pattern)
    // Single query is cheaper than 4 separate queries.
    // BUGHUNT-ROUND2 RECAP-WINDOW: the window was a plain rolling 30 days
    // (`Date.now() - 30d`). On day 31 of a 31-day month, transactions from
    // the 1st with an earlier time-of-day fell OUTSIDE the window and
    // silently vanished from monthExpenseSoFar / monthEndProjection /
    // bestDay / worstDay. Extend the window to also cover the FULL current
    // Jakarta month: min(30 days ago, Jakarta midnight of the 1st).
    const rolling30DaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const monthStartJakarta = new Date(`${monthKey}-01T00:00:00+07:00`);
    const fetchSince = new Date(
      Math.min(rolling30DaysAgo.getTime(), monthStartJakarta.getTime())
    );
    const allRecentTxRaw = await db.transaction.findMany({
      where: { date: { gte: fetchSince } },
      select: { id: true, type: true, amount: true, category: true, description: true, date: true, source: true },
      orderBy: { date: 'desc' },
    });

    // Filter out "Transfer Antar Sumber" + "Penyesuaian Saldo" from daily recap
    // stats. Transfers are internal movements between fund sources, not real
    // income/expense. They still appear in the Transactions tab (not filtered).
    const allRecentTx = allRecentTxRaw.filter(
      (t) => t.category !== 'Transfer Antar Sumber' && t.category !== 'Penyesuaian Saldo'
    );

    // ── Fetch FinanceCategory table for emoji/color resolution ──────
    // We need this so the API can return the correct emoji per category
    // (the client DailyRecap component doesn't have access to the parent
    // finance.tsx getCategoryMeta helper, so we resolve server-side).
    const financeCategories = await db.financeCategory.findMany({
      select: { name: true, type: true, emoji: true, color: true },
    });
    const financeCategoryMap = new Map<string, { emoji: string; color: string; type: string }>();
    for (const c of financeCategories) {
      financeCategoryMap.set(c.name, { emoji: c.emoji, color: c.color, type: c.type });
    }
    /** Resolve emoji/color for a category name (used by all category UI blocks). */
    const metaFor = (name: string) => resolveCategoryMeta(
      name,
      financeCategoryMap.get(name) ? { emoji: financeCategoryMap.get(name)!.emoji, color: financeCategoryMap.get(name)!.color } : undefined
    );

    // ── Bucket transactions by Jakarta date key ──────────────────────
    const txByDate = new Map<string, typeof allRecentTx>();
    for (const tx of allRecentTx) {
      const key = jakartaDateKey(tx.date);
      if (!txByDate.has(key)) txByDate.set(key, []);
      txByDate.get(key)!.push(tx);
    }
    const todayTx = txByDate.get(todayStr) ?? [];

    // ── Today's aggregates (income/expense, hourly 48-bucket, etc.) ──
    const todayAgg = computeTodayAggregates(todayTx, metaFor);
    const { todayExpense } = todayAgg;

    // ── Comparisons (7-day, yesterday, sparkline) ────────────────────
    const comparisons = computeComparisons(txByDate, todayStr, todayExpense);

    // ── Streaks + daily budget ───────────────────────────────────────
    const hasHistory = allRecentTx.length > 0;
    const maxStreakLookback = hasHistory ? 30 : 0;
    const appSettings = await db.appSettings.findFirst();
    const dailyTarget = appSettings?.dailyBudgetTarget ?? 0;
    const noSpendStreak = computeNoSpendStreak(txByDate, todayExpense, todayTx.length > 0, maxStreakLookback);
    const smartSpenderStreak = computeSmartSpenderStreak(txByDate, todayExpense, comparisons.avg7d, maxStreakLookback);
    const dailyBudgetResult = computeDailyBudget(dailyTarget, todayExpense, txByDate, maxStreakLookback);

    // ── Month filter + time constants ────────────────────────────────
    const [yy, mm] = monthKey.split('-').map(Number);
    // Filter transactions by Jakarta month string (NOT UTC epoch bounds).
    // Previously used `new Date(Date.UTC(yy, mm-1, 1))` .. `Date.UTC(yy, mm, 0)`
    // which is UTC midnight — but Jakarta is UTC+7, so transactions in Jakarta
    // between 00:00-06:59 on the 1st of the month have UTC epochs on the last
    // day of the *previous* month and were excluded. Cascading bug:
    // monthExpenseSoFar understated → monthEndProjection wrong → budgetETA wrong
    // → bestDay/worstDay/personalRecord all wrong.
    const monthTx = allRecentTx.filter((t) => jakartaDateKey(t.date).slice(0, 7) === monthKey);
    const daysInMonth = new Date(yy, mm, 0).getDate();
    const daysElapsed = todayParts.day; // day of month = days elapsed

    // ── Build shared context for service modules ─────────────────────
    const appSettingsRow: AppSettingsRow | null = appSettings
      ? { dailyBudgetTarget: appSettings.dailyBudgetTarget, projectionCategoryIds: appSettings.projectionCategoryIds }
      : null;
    const ctx = buildDailyRecapContext({
      todayStr, todayParts, monthKey, yy, mm, daysInMonth, daysElapsed,
      allRecentTx, monthTx, txByDate, todayTx,
      financeCategories, financeCategoryMap, metaFor,
      todayAggregates: todayAgg,
      comparisons,
      noSpendStreak, smartSpenderStreak, hasHistory, maxStreakLookback,
      appSettings: appSettingsRow, dailyTarget, dailyBudgetResult,
    });

    // ── Call service modules in dependency order ─────────────────────
    //   1. alerts — independent (uses db for recurring detection)
    //   2. patterns — builds catDayTotals + monthDailyTotals
    //   3. projectionBasis — builds projection intermediate maps
    //   4. categoryStats — uses catDayTotals from patterns
    //   5. projectionEnrichment — uses monthDailyTotals (patterns) +
    //      projectionBasis intermediate maps + categoryStats
    const [alerts, patternsResult, projectionBasis] = await Promise.all([
      buildAlerts(ctx),
      Promise.resolve(buildPatterns(ctx)),
      buildProjectionBasis(ctx),
    ]);
    const categoryStats = buildCategoryStats(ctx, patternsResult.catDayTotals);
    const projectionEnrichment = await buildProjectionEnrichment(
      ctx,
      projectionBasis,
      patternsResult.monthDailyTotals,
      categoryStats
    );

    // ── Gamification ─────────────────────────────────────────────────
    const gamification = computeGamification({
      todayExpense,
      todayHours: todayParts.hours,
      avg7d: comparisons.avg7d,
      budgetStreak: dailyBudgetResult.budgetStreak,
      smartSpenderStreak,
      dailyBudget: dailyBudgetResult.dailyBudget,
      monthDailyTotals: patternsResult.monthDailyTotals,
    });

    // ── Build response ───────────────────────────────────────────────
    const response: DailyRecapResponse = {
      date: todayStr,
      today: {
        income: todayAgg.todayIncome,
        expense: todayAgg.todayExpense,
        net: todayAgg.todayIncome - todayAgg.todayExpense,
        transactionCount: todayTx.length,
        expenseCount: todayAgg.todayTxCount,
        transactions: todayAgg.todayTransactions.slice(0, 20), // top 20 for UI
        categories: todayAgg.todayCategories,
        categoryStats,
        sources: todayAgg.todaySources,
        hourlyBreakdown: todayAgg.hourlyBreakdown,
        peakHour: todayAgg.peakHour,
        topTransaction: todayAgg.topTransaction,
      },
      comparison: {
        vsYesterday: {
          expense: comparisons.yesterdayExpense,
          changePct: comparisons.vsYesterdayChangePct,
          direction: comparisons.vsYesterdayDirection,
        },
        vs7DayAverage: {
          average: Math.round(comparisons.avg7d),
          changePct: comparisons.vs7dChangePct,
          direction: comparisons.vs7dDirection,
        },
      },
      streaks: {
        noSpendStreak,
        smartSpenderStreak,
        budgetStreak: dailyBudgetResult.budgetStreak,
      },
      predictions: {
        monthEndProjection: projectionBasis.monthEndProjection,
        burnRate: projectionBasis.burnRate,
        trendDirection: projectionBasis.trend,
        budgetETA: projectionBasis.budgetETA,
        smartCapTomorrow: projectionBasis.smartCapTomorrow,
        projectionConfidence: projectionEnrichment.projectionConfidence,
        budgetCompliancePct: projectionEnrichment.budgetCompliancePct,
        daysUntilBudgetOut: projectionEnrichment.daysUntilBudgetOut,
        topProjectedCategory: projectionEnrichment.topProjectedCategory,
        // ── Category-basis selection (Fase 1) ──
        projectionCategoryNames: projectionBasis.projectionCategoryNames,
        projectionIsFiltered: projectionBasis.projectionIsFiltered,
        // BUG-2 fix: projectionBurnRate is now the MTD rate for both
        // filtered and unfiltered cases (computed by projections.ts).
        // No longer falls back to the 7-day burnRate — that's only for
        // budget ETA metrics.
        projectionBurnRate: projectionBasis.projectionBurnRate,
        projectionFullProjection: projectionBasis.projectionIsFiltered ? projectionBasis.monthEndProjectionAll : null,
        availableExpenseCategories: projectionBasis.availableExpenseCategories,
        // ── What-if scenario raw numbers (Fase 3) ──
        whatIfBase: projectionEnrichment.whatIfBase,
        whatIfDaysElapsed: projectionEnrichment.whatIfDaysElapsed,
        whatIfDaysRemaining: projectionEnrichment.whatIfDaysRemaining,
        // ── Last month accuracy badge (Fase 3) ──
        lastMonthAccuracy: projectionEnrichment.lastMonthAccuracy,
      },
      alerts,
      patterns: patternsResult.patterns,
      gamification,
      sparkline: {
        daily7d: comparisons.daily7d,
        isTodayLowest: comparisons.isTodayLowest,
        isTodayHighest: comparisons.isTodayHighest,
      },
      dailyBudget: dailyBudgetResult.dailyBudget,
    };

    // BUG-SW-PERF BUG-1: Reverted PERF-FIX s-maxage=60 edge cache.
    // Reason: this endpoint serves per-user mutation-sensitive data
    // (today's transactions, expense breakdowns). React Query's
    // invalidateQueries() after a transaction POST triggers an immediate
    // refetch — but the refetch hits the Vercel edge cache (still fresh
    // within s-maxage=60s) and returns the OLD response, so the user
    // doesn't see their newly-added transaction for up to ~120s.
    // For a single-user personal finance tracker the stale-data UX is
    // worse than the marginal cold-load perf gain. React Query's
    // client-side cache (staleTime=60s) already provides dedup.
    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('GET /api/finance/daily-recap error:', error);
    return NextResponse.json({ error: 'Failed to fetch daily recap' }, { status: 500 });
  }
}
