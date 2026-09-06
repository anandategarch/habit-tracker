// ── Projection logic for the daily-recap API ────────────────────────────
//
// Two-stage module:
//   1. buildProjectionBasis() — synchronous, no DB:
//        - monthEndProjection (filtered or all-categories)
//        - projectionBurnRate, projectionConfidence inputs
//        - availableExpenseCategories (for the UI selector)
//        - budgetETA, smartCapTomorrow (overall budget countdown)
//        - trendDirection (7-day slope)
//        - intermediate maps: projectionMonthDailyTotals,
//          projectionCategoryMonthTotals (consumed by stage 2)
//
//   2. buildProjectionEnrichment() — async (DB hit for lastMonthAccuracy):
//        - projectionConfidence (CV of daily spending)
//        - budgetCompliancePct (always based on ALL-categories projection)
//        - daysUntilBudgetOut
//        - topProjectedCategory (per-category month projection)
//        - what-if scenario raw numbers
//        - lastMonthAccuracy badge

import { db } from '@/lib/db';
import { jakartaDateKey } from '@/lib/timezone';
import type {
  CategoryStats,
  DailyRecapContext,
  DailyRecapResponse,
  TransactionRow,
} from './types';
import { parseProjectionCategoryNames, trendSlope } from './helpers';

// ── Stage 1: projection basis ────────────────────────────────────────────

export interface ProjectionBasis {
  monthEndProjectionAll: number;
  projectionCategoryNames: string[];
  projectionIsFiltered: boolean;
  projectionCategorySet: Set<string>;
  projectionMonthTx: TransactionRow[];
  projectionMonthExpenseSoFar: number;
  projectionMonthEndProjection: number;
  monthEndProjection: number;
  projectionBurnRate: number;
  availableExpenseCategories: Array<{ name: string; emoji: string; color: string }>;
  projectionMonthDailyTotals: Map<string, number>;
  projectionCategoryMonthTotals: Map<string, number>;
  burnRate: number;
  trend: { slope: number; direction: 'up' | 'down' | 'flat' };
  budgetETA: DailyRecapResponse['predictions']['budgetETA'];
  totalMonthlyTarget: number;
  smartCapTomorrow: number | null;
  monthExpenseSoFar: number;
}

export async function buildProjectionBasis(ctx: DailyRecapContext): Promise<ProjectionBasis> {
  const {
    monthKey,
    daysInMonth,
    daysElapsed,
    allRecentTx,
    monthTx,
    appSettings,
    financeCategories,
    metaFor,
    avg7d,
    dailyTarget,
    last7dExpenses,
  } = ctx;

  // ── Month-to-date expense total (all categories) ─────────────────
  const monthExpenseSoFar = monthTx
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  // ── Month-end projection (all-categories) ────────────────────────
  // (spent so far this month / days elapsed) × total days
  // We use Jakarta month string (NOT UTC epoch bounds) — see the comment
  // in route.ts for the timezone-bug history.
  const monthEndProjectionAll = daysElapsed > 0
    ? Math.round((monthExpenseSoFar / daysElapsed) * daysInMonth)
    : 0;

  // ── Category-basis selection (Fase 1) ────────────────────────────
  // The user can pick which expense categories feed the projection.
  // Empty selection = all expense categories (default, pre-feature).
  // Non-empty = only those categories are counted in monthEndProjection,
  // projectionBurnRate, projectionConfidence, and topProjectedCategory.
  //
  // We compute BOTH the all-categories and filtered projections so the UI
  // can show a "vs semua: Rp Y" comparison when the user has filtered.
  const projectionCategoryNames = parseProjectionCategoryNames(
    appSettings?.projectionCategoryIds
  );
  const projectionIsFiltered = projectionCategoryNames.length > 0;
  const projectionCategorySet = new Set(projectionCategoryNames);

  // Filter this month's transactions to selected categories (if filtered).
  // When unfiltered, projectionMonthTx === monthTx (no copy needed).
  const projectionMonthTx = projectionIsFiltered
    ? monthTx.filter((t) => t.type === 'expense' && projectionCategorySet.has(t.category))
    : monthTx.filter((t) => t.type === 'expense');
  const projectionMonthExpenseSoFar = projectionMonthTx
    .reduce((s, t) => s + t.amount, 0);
  const projectionMonthEndProjection = daysElapsed > 0
    ? Math.round((projectionMonthExpenseSoFar / daysElapsed) * daysInMonth)
    : 0;

  // The main projection number the user sees: filtered if categories are
  // selected, otherwise the all-categories projection.
  const monthEndProjection = projectionIsFiltered
    ? projectionMonthEndProjection
    : monthEndProjectionAll;

  // BUG-2 fix: projectionBurnRate is now the MONTH-TO-DATE daily rate
  // (= monthExpenseSoFar / daysElapsed), NOT the 7-day average. This
  // makes the "rate X/hari" label consistent with the projection number:
  //   projectionBurnRate × daysInMonth ≈ monthEndProjection
  // Previously used the 7-day avg, which could differ wildly from the
  // MTD rate (e.g., label "68k/hari" × 31 days = 2.1M, but projection
  // showed 3.2M — confusing). The 7-day burnRate is still computed
  // separately below for budgetETA / smartCapTomorrow / daysUntilBudgetOut
  // (those are about recent spending behaviour, not the projection).
  const projectionBurnRate = daysElapsed > 0
    ? Math.round(
        (projectionIsFiltered ? projectionMonthExpenseSoFar : monthExpenseSoFar) / daysElapsed
      )
    : 0;

  // ── Available expense categories (for the UI dropdown selector) ──
  // ONLY includes categories that have at least one expense transaction
  // in the last 30 days — no point showing a category the user has never
  // spent on (it would produce a 0 projection). Sorted by name for
  // stable display order. Emoji/color resolved via metaFor() so default-
  // named categories get their fallback emoji even if the DB row still
  // has the 📦 placeholder.
  const categoriesWithTransactions = new Set<string>();
  for (const tx of allRecentTx) {
    if (tx.type === 'expense') categoriesWithTransactions.add(tx.category);
  }
  const availableExpenseCategories = financeCategories
    .filter((c) => c.type === 'expense' && categoriesWithTransactions.has(c.name))
    .map((c) => {
      const meta = metaFor(c.name);
      return { name: c.name, emoji: meta.emoji, color: meta.color };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // ── Filtered per-day totals (this month, selected categories only) ─
  // Used for projectionConfidence when filtered. When unfiltered, we
  // reuse the all-categories monthDailyTotals computed in patterns.ts
  // (no duplicated work). Computed here because projectionMonthTx is in
  // scope; monthDailyTotals isn't populated at this point.
  const projectionMonthDailyTotals = new Map<string, number>();
  if (projectionIsFiltered) {
    for (const tx of projectionMonthTx) {
      const key = jakartaDateKey(tx.date);
      projectionMonthDailyTotals.set(key, (projectionMonthDailyTotals.get(key) ?? 0) + tx.amount);
    }
  }

  // ── Filtered per-category month-to-date totals (selected cats only) ─
  // Used for topProjectedCategory when filtered — projects each selected
  // category's month-to-date spend to the full month. When unfiltered,
  // the existing categoryStats-based logic is used (unchanged).
  const projectionCategoryMonthTotals = new Map<string, number>();
  if (projectionIsFiltered) {
    for (const tx of projectionMonthTx) {
      projectionCategoryMonthTotals.set(
        tx.category,
        (projectionCategoryMonthTotals.get(tx.category) ?? 0) + tx.amount
      );
    }
  }

  // ── Burn rate = avg 7d (overall — used by budgetETA, smartCapTomorrow,
  // daysUntilBudgetOut which are about the OVERALL budget, not the
  // filtered projection)
  const burnRate = Math.round(avg7d);

  // ── Trend direction (7-day expense slope) ────────────────────────
  const trend = trendSlope(last7dExpenses);

  // ── Budget ETA: when will monthly budget run out? ────────────────
  // Monthly budget = dailyTarget × daysInMonth (if user set daily budget),
  // else fall back to weekly budgets (extrapolated to 4 weeks).
  let budgetETA: DailyRecapResponse['predictions']['budgetETA'] = null;
  let totalMonthlyTarget = 0;
  if (dailyTarget > 0) {
    // Daily budget set → monthly = daily × days in month
    totalMonthlyTarget = dailyTarget * daysInMonth;
  } else {
    // Fallback: weekly budgets (extrapolated to 4 weeks if partial)
    const weeklyBudgets = await db.weeklyBudget.findMany({
      where: { month: monthKey },
      orderBy: { week: 'asc' },
    });
    const setWeeks = weeklyBudgets.filter((b) => b.target > 0);
    if (setWeeks.length > 0) {
      totalMonthlyTarget = Math.round((setWeeks.reduce((s, b) => s + b.target, 0) / setWeeks.length) * 4);
    }
  }
  if (totalMonthlyTarget > 0 && burnRate > 0) {
    const remainingBudget = totalMonthlyTarget - monthExpenseSoFar;
    // If already over budget, daysLeft is meaningless — set to 0.
    const daysLeft = remainingBudget > 0 ? Math.floor(remainingBudget / burnRate) : 0;
    budgetETA = {
      daysLeft,
      willExceed: remainingBudget < 0,
      projectedOver: remainingBudget < 0 ? Math.abs(remainingBudget) : 0,
    };
  }

  // ── Smart cap for the rest of the month (avg daily budget remaining) ─
  // Labeled "Sisa/hari" in the UI.
  // Divisor = days STRICTLY AFTER today (not including today, since today's
  // spend is already in monthExpenseSoFar). If today is the last day of the
  // month, remainingDays = 0 → no cap shown (nothing left to budget for).
  // Also returns null if already over monthly budget (remainingBudget < 0)
  // — previously Math.max(0, negative) returned 0, which the UI showed as
  // "Sisa/hari: Rp 0" (misleading — reads as "zero per day" instead of
  // "you're over budget").
  let smartCapTomorrow: number | null = null;
  if (totalMonthlyTarget > 0) {
    const remainingBudget = totalMonthlyTarget - monthExpenseSoFar;
    const remainingDays = daysInMonth - daysElapsed; // strictly after today
    if (remainingDays > 0 && remainingBudget > 0) {
      smartCapTomorrow = Math.round(remainingBudget / remainingDays);
    }
  }

  return {
    monthEndProjectionAll,
    projectionCategoryNames,
    projectionIsFiltered,
    projectionCategorySet,
    projectionMonthTx,
    projectionMonthExpenseSoFar,
    projectionMonthEndProjection,
    monthEndProjection,
    projectionBurnRate,
    availableExpenseCategories,
    projectionMonthDailyTotals,
    projectionCategoryMonthTotals,
    burnRate,
    trend,
    budgetETA,
    totalMonthlyTarget,
    smartCapTomorrow,
    monthExpenseSoFar,
  };
}

// ── Stage 2: projection enrichment ──────────────────────────────────────

export interface ProjectionEnrichment {
  projectionConfidence: 'high' | 'medium' | 'low';
  budgetCompliancePct: number | null;
  daysUntilBudgetOut: number | null;
  topProjectedCategory: { name: string; emoji: string; projected: number; pct: number } | null;
  whatIfBase: number;
  whatIfDaysElapsed: number;
  whatIfDaysRemaining: number;
  lastMonthAccuracy: DailyRecapResponse['predictions']['lastMonthAccuracy'];
}

export async function buildProjectionEnrichment(
  ctx: DailyRecapContext,
  basis: ProjectionBasis,
  monthDailyTotals: Map<string, number>,
  categoryStats: CategoryStats[]
): Promise<ProjectionEnrichment> {
  const {
    yy,
    mm,
    daysInMonth,
    daysElapsed,
    metaFor,
  } = ctx;
  const {
    projectionIsFiltered,
    projectionMonthDailyTotals,
    projectionCategoryMonthTotals,
    monthEndProjectionAll,
    monthEndProjection,
    totalMonthlyTarget,
    burnRate,
    monthExpenseSoFar,
    projectionMonthExpenseSoFar,
    projectionCategorySet,
  } = basis;

  // ── Confidence: based on coefficient of variation (CV) of daily spend.
  // When the user has selected specific categories, we compute CV from the
  // filtered daily totals (so the confidence reflects the stability of the
  // SELECTED categories' spending, not all spending). When unfiltered, we
  // use the all-categories monthDailyTotals (unchanged from pre-feature).
  const confidenceSource = projectionIsFiltered
    ? projectionMonthDailyTotals
    : monthDailyTotals;
  const dailyExpenseValues = Array.from(confidenceSource.values());
  const expenseMean = dailyExpenseValues.length > 0
    ? dailyExpenseValues.reduce((a, b) => a + b, 0) / dailyExpenseValues.length
    : 0;
  const expenseVariance = dailyExpenseValues.length > 0
    ? dailyExpenseValues.reduce((s, v) => s + (v - expenseMean) ** 2, 0) / dailyExpenseValues.length
    : 0;
  const expenseSD = Math.sqrt(expenseVariance);
  const cv = expenseMean > 0 ? expenseSD / expenseMean : 1;
  const projectionConfidence: 'high' | 'medium' | 'low' =
    cv < 0.4 ? 'high' : cv < 0.8 ? 'medium' : 'low';

  // ── Budget compliance probability — ALWAYS based on the ALL-categories
  // projection vs the OVERALL monthly budget target. The budget applies to
  // total spending, so filtering categories must not inflate the compliance
  // percentage (which would falsely reassure the user). Previously used
  // `monthEndProjection` which is now the filtered value when categories
  // are selected — that was a bug; fixed to use `monthEndProjectionAll`.
  const budgetCompliancePct = totalMonthlyTarget > 0
    ? Math.max(0, Math.min(100, Math.round(100 - ((monthEndProjectionAll - totalMonthlyTarget) / totalMonthlyTarget) * 200)))
    : null;

  // ── Days until budget runs out — always based on OVERALL spending/burn
  // rate (budget applies to all spending, not the filtered subset).
  let daysUntilBudgetOut: number | null = null;
  if (totalMonthlyTarget > 0 && burnRate > 0) {
    const remBudget = totalMonthlyTarget - monthExpenseSoFar;
    daysUntilBudgetOut = remBudget > 0 ? Math.ceil(remBudget / burnRate) : 0;
  }

  // ── Top projected category.
  // When FILTERED: project each SELECTED category's month-to-date spend to
  //   the full month (more accurate than the todayAmount-based formula).
  //   Pct is relative to the filtered monthEndProjection.
  // When UNFILTERED: use the existing categoryStats-based logic (projects
  //   todayAmount to the month — unchanged from pre-feature behaviour).
  let topProjectedCategory: { name: string; emoji: string; projected: number; pct: number } | null = null;
  if (projectionIsFiltered) {
    if (daysElapsed > 0 && projectionCategoryMonthTotals.size > 0) {
      const projected = Array.from(projectionCategoryMonthTotals.entries())
        .map(([name, monthToDate]) => {
          const meta = metaFor(name);
          return {
            name,
            emoji: meta.emoji,
            projected: Math.round((monthToDate / daysElapsed) * daysInMonth),
          };
        })
        .filter((c) => c.projected > 0)
        .sort((a, b) => b.projected - a.projected);
      if (projected.length > 0) {
        topProjectedCategory = {
          ...projected[0],
          pct: monthEndProjection > 0 ? Math.round((projected[0].projected / monthEndProjection) * 100) : 0,
        };
      }
    }
  } else if (daysElapsed > 0 && categoryStats.length > 0) {
    const projected = categoryStats
      .map((c) => ({
        name: c.name,
        emoji: c.emoji,
        projected: Math.round((c.todayAmount / daysElapsed) * daysInMonth),
      }))
      .filter((c) => c.projected > 0)
      .sort((a, b) => b.projected - a.projected);
    if (projected.length > 0) {
      topProjectedCategory = {
        ...projected[0],
        pct: monthEndProjection > 0 ? Math.round((projected[0].projected / monthEndProjection) * 100) : 0,
      };
    }
  }

  // ── What-if scenario raw numbers (Fase 3) ─────────────────────────
  // Expose the month-to-date spend + day counts so the client can compute
  // "if I cut spending by X% for the rest of the month" instantly via a
  // slider, without a server round-trip on every drag.
  //   whatIfBase = the CURRENT basis's month-to-date spend (filtered if
  //     categories are selected, else all expense). Matches the number
  //     the projection above is based on.
  //   whatIfDaysElapsed = today's day of month (1-31). Same as daysElapsed.
  //   whatIfDaysRemaining = daysInMonth - daysElapsed (strictly AFTER
  //     today — today's spend is already in whatIfBase).
  const whatIfBase = projectionIsFiltered ? projectionMonthExpenseSoFar : monthExpenseSoFar;
  const whatIfDaysElapsed = daysElapsed;
  const whatIfDaysRemaining = daysInMonth - daysElapsed;

  // ── Last month accuracy badge (Fase 3) ────────────────────────────
  // Compares the projection that WOULD have been made on this same day
  // last month vs the ACTUAL total spending for last month. If the
  // projection was within ±10%, the user gets a "Proyektor Andal" badge.
  //
  // We fetch last month's expense transactions separately (the main
  // `allRecentTx` only covers 30 days, which may not include all of last
  // month if today is late in the current month). Small payload — we
  // only need amount + date + category per tx.
  //
  // Edge cases:
  //   - daysElapsed < 3 → too few days for even a noisy projection,
  //     don't show the badge. Return null.
  //   - No last-month transactions at all → return null.
  //   - BUG-5: Has last-month transactions BUT none in days 1-N of last
  //     month (lastMonthUpToSameDay = 0) → return null. Can't meaningfully
  //     compare a 0 baseline to actual spending (would show 100% deviation,
  //     which is misleading). This happens for users who start spending
  //     mid-month; the badge will appear once they're past their typical
  //     "start day" (e.g., if they usually start spending on the 10th,
  //     the badge appears from day 10 onwards).
  //   - If the user has filtered to specific categories, the accuracy is
  //     computed on the FILTERED set (same basis as the current projection).
  let lastMonthAccuracy: DailyRecapResponse['predictions']['lastMonthAccuracy'] = null;
  if (daysElapsed >= 3) {
    // BUG-7 fix: dedupe — lastMonthDate and lastMonthStart computed the
    // same expression (`new Date(yy, mm - 2, 1)`) twice. Use one var.
    const lastMonthStart = new Date(yy, mm - 2, 1); // first day of last month (local); mm is 1-based, mm-2 = last month
    const lastMonthKey = `${lastMonthStart.getFullYear()}-${String(lastMonthStart.getMonth() + 1).padStart(2, '0')}`;
    const daysInLastMonth = new Date(yy, mm - 1, 0).getDate();

    // Fetch last month's expense transactions. Use a date range that
    // covers the entire last month with a small buffer for timezone
    // (Jakarta is UTC+7, so transactions on the 1st of last month between
    // 00:00-06:59 Jakarta time have UTC epochs on the last day of the
    // month before — we subtract 1 day from the start to catch those).
    const lastMonthStartEpoch = lastMonthStart.getTime() - 24 * 60 * 60 * 1000; // -1 day buffer
    const lastMonthEnd = new Date(yy, mm - 1, 1); // first day of current month (local)
    const lastMonthTxRaw = await db.transaction.findMany({
      where: {
        date: { gte: new Date(lastMonthStartEpoch), lt: lastMonthEnd },
        type: 'expense',
      },
      select: { amount: true, date: true, category: true },
    });
    // Filter to last month by Jakarta date key (timezone-correct).
    let lastMonthTx = lastMonthTxRaw.filter(
      (t) => jakartaDateKey(t.date).slice(0, 7) === lastMonthKey
    );
    // If filtered, only count selected categories (same basis as current).
    if (projectionIsFiltered) {
      lastMonthTx = lastMonthTx.filter((t) => projectionCategorySet.has(t.category));
    }

    if (lastMonthTx.length > 0) {
      // BUG-6 fix: Cap daysElapsed to daysInLastMonth. When today's
      // day-of-month exceeds last month's total days (e.g., today is
      // Mar 31, last month Feb has 28 days), using raw daysElapsed as
      // the divisor would understate the projection — all of last
      // month's tx get summed (because every day ≤ 28 ≤ 31), but
      // divided by 31 instead of 28. Capping to daysInLastMonth makes
      // the divisor match the actual cutoff day, so the projection is
      // computed correctly (and equals the actual total when today's
      // day ≥ daysInLastMonth, giving 0% deviation as expected).
      const effectiveDaysElapsed = Math.min(daysElapsed, daysInLastMonth);

      // Last month's spend up to the SAME day of month as today
      // (capped to daysInLastMonth). E.g., if today is Aug 15, we sum
      // last month's (July) expenses from July 1 to July 15 (inclusive)
      // — same cutoff as the current month's projection uses.
      const lastMonthUpToSameDay = lastMonthTx
        .filter((t) => {
          const day = parseInt(jakartaDateKey(t.date).slice(8, 10), 10);
          return day <= effectiveDaysElapsed;
        })
        .reduce((s, t) => s + t.amount, 0);
      const lastMonthActual = lastMonthTx.reduce((s, t) => s + t.amount, 0);

      if (lastMonthActual > 0 && lastMonthUpToSameDay > 0) {
        const lastMonthProjected = Math.round(
          (lastMonthUpToSameDay / effectiveDaysElapsed) * daysInLastMonth
        );
        const deviationPct = Math.round(
          (Math.abs(lastMonthProjected - lastMonthActual) / lastMonthActual) * 100
        );
        const tier: 'accurate' | 'close' | 'off' =
          deviationPct <= 10 ? 'accurate' : deviationPct <= 25 ? 'close' : 'off';
        lastMonthAccuracy = {
          projected: lastMonthProjected,
          actual: lastMonthActual,
          deviationPct,
          tier,
        };
      }
    }
  }

  return {
    projectionConfidence,
    budgetCompliancePct,
    daysUntilBudgetOut,
    topProjectedCategory,
    whatIfBase,
    whatIfDaysElapsed,
    whatIfDaysRemaining,
    lastMonthAccuracy,
  };
}
