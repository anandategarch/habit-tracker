import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { jakartaDateString, jakartaDateKey, jakartaNowParts, jakartaMonthString } from '@/lib/timezone';

import {
  buildAlerts,
  buildCategoryStats,
  buildPatterns,
  buildProjectionBasis,
  buildProjectionEnrichment,
} from '@/lib/finance/daily-recap';
import { resolveCategoryMeta } from '@/lib/finance/daily-recap/helpers';
import type {
  CategoryBreakdown,
  DailyRecapContext,
  DailyRecapResponse,
  SourceBreakdown,
  TodayTransaction,
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
    // Single query covering 30 days is cheaper than 4 separate queries.

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const allRecentTxRaw = await db.transaction.findMany({
      where: { date: { gte: thirtyDaysAgo } },
      select: {
        id: true,
        type: true,
        amount: true,
        category: true,
        description: true,
        date: true,
        source: true,
      },
      orderBy: { date: 'desc' },
    });

    // Filter out "Transfer Antar Sumber" transactions from daily recap
    // stats. Transfers are internal movements between fund sources, not
    // real income/expense. Including them would inflate both income and
    // expense, making the daily recap misleading.
    // They still appear in the Transactions tab (not filtered there).
    const allRecentTx = allRecentTxRaw.filter(
      (t) => t.category !== 'Transfer Antar Sumber' && t.category !== 'Penyesuaian Saldo'
    );

    // ── Fetch FinanceCategory table for emoji/color resolution ──────
    // We need this so the API can return the correct emoji per category
    // (the client DailyRecap component doesn't have access to the parent
    // finance.tsx getCategoryMeta helper, so we resolve server-side).
    // Single query — cheap, returns only a few rows.
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

    // ── Today's aggregates ───────────────────────────────────────────
    let todayIncome = 0, todayExpense = 0;
    const todayCategoryMap = new Map<string, { amount: number; count: number }>();
    const todaySourceMap = new Map<string, number>();
    // 48-element array: each bucket = 30 minutes.
    //   index 0  = 00:00–00:29
    //   index 1  = 00:30–00:59
    //   index 2  = 01:00–01:29
    //   ...
    //   index 47 = 23:30–23:59
    // Bucket = hour*2 + (minute >= 30 ? 1 : 0).
    // Previously used 24 buckets (per hour), which rounded 08.30 down to
    // "08:00" in the heatmap — misleading. 30-minute granularity gives the
    // user a more accurate picture of when they actually spent (a 08.30
    // coffee now shows in its own bar, not lumped into "08:00").
    const hourlyBreakdown = new Array(48).fill(0);
    const todayTransactions: TodayTransaction[] = [];

    for (const tx of todayTx) {
      // Extract Jakarta hour + minute for the 30-min heatmap bucket.
      // We use Intl.DateTimeFormat to get timezone-correct components
      // (Asia/Jakarta), then compute bucket = hour*2 + (minute >= 30 ? 1 : 0).
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(tx.date);
      const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '0';
      const minStr = parts.find((p) => p.type === 'minute')?.value ?? '0';
      const hour = parseInt(hourStr, 10) % 24;
      const minute = parseInt(minStr, 10);
      const bucket = hour * 2 + (minute >= 30 ? 1 : 0);

      if (tx.type === 'income') {
        todayIncome += tx.amount;
      } else {
        todayExpense += tx.amount;
        hourlyBreakdown[bucket] += tx.amount;
        const cat = todayCategoryMap.get(tx.category) ?? { amount: 0, count: 0 };
        cat.amount += tx.amount;
        cat.count += 1;
        todayCategoryMap.set(tx.category, cat);
        todaySourceMap.set(tx.source, (todaySourceMap.get(tx.source) ?? 0) + tx.amount);
      }

      todayTransactions.push({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        description: tx.description,
        date: tx.date.toISOString(),
        source: tx.source,
      });
    }

    // Sort today's transactions by actual timestamp descending (newest first).
    // Previously sorted by integer hour only, which made transactions in the
    // same hour appear in nondeterministic order.
    todayTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const todayCategories: CategoryBreakdown[] = Array.from(todayCategoryMap.entries())
      .map(([name, v]) => {
        const meta = metaFor(name);
        return { name, amount: v.amount, count: v.count, emoji: meta.emoji, color: meta.color };
      })
      .sort((a, b) => b.amount - a.amount);

    const todaySources: SourceBreakdown[] = Array.from(todaySourceMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Peak hour — find the 30-min bucket with the highest spend, then
    // derive the actual hour (0-23) from it. `peakHour` is not currently
    // displayed in the UI (the heatmap visualizes peak activity), but we
    // keep it in the response for potential future use. Now scans all 48
    // buckets (was 24) since hourlyBreakdown is 48-element.
    let peakHour: { hour: number; amount: number } | null = null;
    for (let b = 0; b < 48; b++) {
      if (hourlyBreakdown[b] > 0 && (!peakHour || hourlyBreakdown[b] > peakHour.amount)) {
        peakHour = { hour: Math.floor(b / 2), amount: hourlyBreakdown[b] };
      }
    }

    // Top transaction (largest single expense today)
    const topTransaction = todayTransactions
      .filter((t) => t.type === 'expense')
      .sort((a, b) => b.amount - a.amount)[0] ?? null;

    // ── Last 7 days expense totals (including today) ─────────────────
    const daily7d: Array<{ date: string; amount: number; isToday: boolean }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = jakartaDateKey(d);
      const dayTx = txByDate.get(key) ?? [];
      const expense = dayTx
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0);
      daily7d.push({ date: key, amount: expense, isToday: key === todayStr });
    }

    const last7dExpenses = daily7d.map((d) => d.amount);
    const avg7d = last7dExpenses.reduce((a, b) => a + b, 0) / 7;

    // ── Yesterday ────────────────────────────────────────────────────
    const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayKey = jakartaDateKey(yesterdayDate);
    const yesterdayTx = txByDate.get(yesterdayKey) ?? [];
    const yesterdayExpense = yesterdayTx
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);

    // ── Comparison ───────────────────────────────────────────────────
    const vsYesterdayChangePct = yesterdayExpense > 0
      ? Math.round(((todayExpense - yesterdayExpense) / yesterdayExpense) * 100)
      : null;
    const vsYesterdayDirection: 'up' | 'down' | 'same' | 'unknown' =
      vsYesterdayChangePct === null ? 'unknown'
      : vsYesterdayChangePct > 0 ? 'up'
      : vsYesterdayChangePct < 0 ? 'down'
      : 'same';

    const vs7dChangePct = avg7d > 0
      ? Math.round(((todayExpense - avg7d) / avg7d) * 100)
      : null;
    const vs7dDirection: 'up' | 'down' | 'same' | 'unknown' =
      vs7dChangePct === null ? 'unknown'
      : vs7dChangePct > 0 ? 'up'
      : vs7dChangePct < 0 ? 'down'
      : 'same';

    // ── Streaks ──────────────────────────────────────────────────────
    // Walk backwards from today (or yesterday if today has spending) to count
    // consecutive days meeting the streak criteria.
    //
    // Edge case: if the user has NO transaction history at all (fresh install),
    // we don't want to claim a 365-day streak. So we cap at the earliest day
    // we have data for (via `txByDate` having any entry, or 30 days max).

    // Has the user ever recorded any transaction in the last 30 days?
    const hasHistory = allRecentTx.length > 0;
    const maxStreakLookback = hasHistory ? 30 : 0;

    // No-spend streak: consecutive days with 0 expense (today counts only if 0).
    // Require today to have at least one tracked transaction — otherwise a day
    // where the user simply didn't log anything would falsely count as a
    // no-spend day.
    let noSpendStreak = 0;
    if (todayExpense === 0 && todayTx.length > 0 && maxStreakLookback > 0) {
      noSpendStreak = 1;
      for (let i = 1; i <= maxStreakLookback; i++) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = jakartaDateKey(d);
        const dayTx = txByDate.get(key);
        // No data for this day = user didn't track, don't count as no-spend
        if (!dayTx) break;
        const exp = dayTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        if (exp === 0) noSpendStreak++;
        else break;
      }
    }

    // Smart spender streak: consecutive days where expense < avg7d
    // (only count if today has spending — a no-spend day breaks this streak)
    let smartSpenderStreak = 0;
    if (todayExpense > 0 && todayExpense < avg7d && maxStreakLookback > 0) {
      smartSpenderStreak = 1;
      for (let i = 1; i <= maxStreakLookback; i++) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = jakartaDateKey(d);
        const dayTx = txByDate.get(key);
        if (!dayTx) break;
        const exp = dayTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        if (exp > 0 && exp < avg7d) smartSpenderStreak++;
        else break;
      }
    }

    // ── Daily budget (from AppSettings.dailyBudgetTarget) ───────────
    // User sets a single daily target via the progress ring tap → dialog
    // in the Daily Recap UI. Stored in AppSettings (1 value for all days).
    // 0 = not set → dailyBudget stays null → ring hidden in UI.
    let dailyBudget: DailyRecapResponse['dailyBudget'] = null;
    let budgetStreak = 0;
    const appSettings = await db.appSettings.findFirst();
    const dailyTarget = appSettings?.dailyBudgetTarget ?? 0;
    if (dailyTarget > 0) {
      const spent = todayExpense;
      const remaining = dailyTarget - spent;
      const percentage = dailyTarget > 0 ? Math.round((spent / dailyTarget) * 100) : 0;
      const status: 'under' | 'on_track' | 'nearing' | 'over' =
        spent > dailyTarget ? 'over'
        : percentage >= 80 ? 'nearing'
        : percentage >= 50 ? 'on_track'
        : 'under';
      dailyBudget = { target: dailyTarget, spent, remaining, percentage, status };

      // Budget streak: consecutive days under daily target
      if (spent <= dailyTarget && maxStreakLookback > 0) {
        budgetStreak = 1;
        for (let i = 1; i <= maxStreakLookback; i++) {
          const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
          const key = jakartaDateKey(d);
          const dayTx = txByDate.get(key);
          if (!dayTx) break;
          const exp = dayTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
          if (exp <= dailyTarget) budgetStreak++;
          else break;
        }
      }
    }

    // ── Time/month constants used by service modules ─────────────────
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
    const todayTxCount = todayTx.filter((t) => t.type === 'expense').length;

    // ── Build shared context for service modules ─────────────────────
    const ctx: DailyRecapContext = {
      todayStr,
      todayParts,
      monthKey,
      yy,
      mm,
      daysInMonth,
      daysElapsed,
      allRecentTx,
      monthTx,
      txByDate,
      todayTx,
      yesterdayKey,
      yesterdayExpense,
      financeCategories,
      financeCategoryMap,
      metaFor,
      todayIncome,
      todayExpense,
      todayCategoryMap,
      todaySourceMap,
      hourlyBreakdown,
      todayTransactions,
      todayCategories,
      todaySources,
      peakHour,
      topTransaction,
      todayTxCount,
      daily7d,
      last7dExpenses,
      avg7d,
      noSpendStreak,
      smartSpenderStreak,
      hasHistory,
      maxStreakLookback,
      appSettings: appSettings
        ? {
            dailyBudgetTarget: appSettings.dailyBudgetTarget,
            projectionCategoryIds: appSettings.projectionCategoryIds,
          }
        : null,
      dailyTarget,
      dailyBudget,
      budgetStreak,
    };

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

    // Daily badge
    let dailyBadge: { id: string; name: string; emoji: string; description: string } | null = null;
    if (todayExpense === 0 && todayParts.hours >= 12) {
      dailyBadge = { id: 'no_spend', name: 'No-Spend Day', emoji: '💎', description: 'Hari tanpa pengeluaran' };
    } else if (dailyBudget?.status === 'under' && dailyBudget.percentage <= 50) {
      dailyBadge = { id: 'budget_master', name: 'Budget Master', emoji: '🎯', description: 'Spending di bawah 50% budget harian' };
    } else if (smartSpenderStreak >= 5) {
      dailyBadge = { id: 'streak_master', name: 'Streak Master', emoji: '🔥', description: `${smartSpenderStreak} hari hemat berturut` };
    } else if (todayExpense > 0 && todayExpense < avg7d * 0.5) {
      dailyBadge = { id: 'frugal', name: 'Frugal Star', emoji: '⭐', description: 'Spending kurang dari setengah rata-rata' };
    }

    // Combo multiplier: 3+ days under budget = combo
    const comboMultiplier = Math.max(1, budgetStreak >= 3 ? Math.floor(budgetStreak / 3) + 1 : 1);

    // Personal record: is today the lowest expense in 30 days?
    // Use `filter(... < todayExpense).length + 1` for rank instead of
    // `indexOf` — indexOf returns the first index of a duplicate value, so
    // if two days had the same amount, the rank was wrong.
    const all30dExpenses = Array.from(patternsResult.monthDailyTotals.values()).sort((a, b) => a - b);
    const isRecord = todayExpense > 0 && all30dExpenses.length >= 3 && todayExpense === all30dExpenses[0];
    const personalRecord = isRecord
      ? { isRecord: true, amount: todayExpense, rank: 1, totalDays: all30dExpenses.length }
      : todayExpense > 0 && all30dExpenses.length >= 3
      ? (() => {
          // Rank = number of days with strictly less expense + 1.
          const lowerCount = all30dExpenses.filter((e) => e < todayExpense).length;
          return { isRecord: false, amount: todayExpense, rank: lowerCount + 1, totalDays: all30dExpenses.length };
        })()
      : null;

    // ── Sparkline ────────────────────────────────────────────────────
    const sorted7d = [...daily7d].sort((a, b) => a.amount - b.amount);
    const isTodayLowest = todayExpense > 0 && sorted7d[0].isToday;
    const isTodayHighest = todayExpense > 0 && sorted7d[sorted7d.length - 1].isToday;

    // ── Build response ───────────────────────────────────────────────
    const response: DailyRecapResponse = {
      date: todayStr,
      today: {
        income: todayIncome,
        expense: todayExpense,
        net: todayIncome - todayExpense,
        transactionCount: todayTx.length,
        expenseCount: todayTxCount,
        transactions: todayTransactions.slice(0, 20), // top 20 for UI
        categories: todayCategories,
        categoryStats,
        sources: todaySources,
        hourlyBreakdown,
        peakHour,
        topTransaction,
      },
      comparison: {
        vsYesterday: {
          expense: yesterdayExpense,
          changePct: vsYesterdayChangePct,
          direction: vsYesterdayDirection,
        },
        vs7DayAverage: {
          average: Math.round(avg7d),
          changePct: vs7dChangePct,
          direction: vs7dDirection,
        },
      },
      streaks: {
        noSpendStreak,
        smartSpenderStreak,
        budgetStreak,
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
      gamification: {
        dailyBadge,
        comboMultiplier,
        personalRecord,
      },
      sparkline: {
        daily7d,
        isTodayLowest,
        isTodayHighest,
      },
      dailyBudget,
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
