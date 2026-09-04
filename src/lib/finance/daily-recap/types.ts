// ── Types for the daily-recap API + extracted services ──────────────────
//
// This file is the single source of truth for the response shape of
// /api/finance/daily-recap. It also defines a few helper interfaces
// (TransactionRow / FinanceCategoryRow / AppSettingsRow) that mirror the
// Prisma `select` shapes used by the route, plus a DailyRecapContext
// interface that bundles the shared state threaded between the split-out
// service modules (alerts, patterns, projections, category-stats).

// ── Row types (mirror the Prisma `select` shapes used by the route) ──────

/**
 * A single expense/income row as fetched from the Transaction table.
 * We only select the columns we need — keeps the query payload small.
 */
export interface TransactionRow {
  id: string;
  type: string;
  amount: number;
  category: string;
  description: string | null;
  date: Date;
  source: string;
}

/** FinanceCategory row shape used for emoji/color resolution. */
export interface FinanceCategoryRow {
  name: string;
  type: string;
  emoji: string;
  color: string;
}

/** FinanceCategory map value: emoji + color + type per name. */
export interface FinanceCategoryMeta {
  emoji: string;
  color: string;
  type: string;
}

/** AppSettings row shape (only the fields the recap actually reads). */
export interface AppSettingsRow {
  dailyBudgetTarget: number;
  projectionCategoryIds: string | null;
}

// ── Response-shape types ─────────────────────────────────────────────────

export interface TodayTransaction {
  id: string;
  type: string;
  amount: number;
  category: string;
  description: string | null;
  // ISO string of the transaction date (real epoch). The client formats this
  // to a Jakarta wall-clock time via `toLocaleTimeString('id-ID', { timeZone:
  // 'Asia/Jakarta' })` — exactly the same code path as the Transactions tab
  // uses. Previously we sent only an integer `hour` here, which threw away
  // the minutes and made the time shown in the daily recap disagree with the
  // time shown in the Transactions tab for the same transaction.
  date: string;
  source: string;
}

export interface CategoryBreakdown {
  name: string;
  amount: number;
  count: number;
  emoji: string;
  color: string;
}

/**
 * Per-category deep stats for categories that have transactions today.
 * Computed from THREE time windows so the user can compare:
 *
 *   - 30-day (maxTransaction / avgTransaction / maxDaily / avgDaily):
 *     the original window. Still powers deltaVsAvgDaily (today vs 30-day
 *     avg) and the categoryAnomaly z-score. Kept for backwards compat.
 *   - Current month (monthMaxTransaction / monthAvgTransaction / ...):
 *     stats scoped to the current Jakarta month. More relevant for "how
 *     am I doing this month?" vs the 30-day rolling window.
 *   - All-time (allTimeMaxTransaction / allTimeAvgTransaction / ...):
 *     stats across ALL transactions ever recorded. Shows the historical
 *     peak — useful for "have I ever spent more than today in this category?"
 *
 * The UI shows a 2-tab switcher (Bulan ini / All-time) per the user's
 * request. The 30-day fields are not displayed in the tab UI but still
 * power the delta badge + anomaly detection internally.
 *
 * Two dimensions per window:
 *   - Per-transaction (maxTransaction): the largest single tx in this category.
 *   - Per-day (maxDaily): the largest day-total in this category.
 *   - avgTransaction / avgDaily: averages (per-day avg only counts days
 *     that have at least one tx — so the avg isn't diluted by no-activity
 *     days).
 *
 * deltaVsAvgDaily = todayAmount - avgDaily (30-day). Negative = below
 * average (good for expense), positive = above average (overspending).
 *
 * emoji/color come from the FinanceCategory table (with FALLBACK_EXPENSE
 * lookup for default-named categories that still have the placeholder 📦).
 */
export interface CategoryStats {
  name: string;
  todayAmount: number;
  todayCount: number;
  // 30-day window (existing — powers delta badge + anomaly z-score)
  maxTransaction: number;
  avgTransaction: number;
  maxDaily: number;
  avgDaily: number;
  deltaVsAvgDaily: number;
  emoji: string;
  color: string;
  // Current month window (new — for "Bulan ini" tab)
  monthMaxTransaction: number;
  monthAvgTransaction: number;
  monthMaxDaily: number;
  monthAvgDaily: number;
  // All-time window (new — for "All-time" tab)
  allTimeMaxTransaction: number;
  allTimeAvgTransaction: number;
  allTimeMaxDaily: number;
  allTimeAvgDaily: number;
}

export interface SourceBreakdown {
  name: string;
  amount: number;
}

export interface Alert {
  type: 'over_budget' | 'nearing_budget' | 'big_ticket' | 'unusual_activity' | 'recurring' | 'late_night' | 'first_tx_nudge';
  severity: 'info' | 'warning' | 'danger';
  message: string;
  data?: Record<string, unknown>;
}

export interface DailyRecapResponse {
  date: string; // yyyy-MM-dd (Jakarta)
  today: {
    income: number;
    expense: number;
    net: number;
    transactionCount: number;
    expenseCount: number; // count of expense tx only (for "N transaksi" label)
    transactions: TodayTransaction[];
    categories: CategoryBreakdown[];
    categoryStats: CategoryStats[];
    sources: SourceBreakdown[];
    hourlyBreakdown: number[]; // 48 elements, expense per 30-min bucket (index = hour*2 + (min>=30?1:0))
    peakHour: { hour: number; amount: number } | null;
    topTransaction: TodayTransaction | null;
  };
  comparison: {
    vsYesterday: {
      expense: number;
      changePct: number | null;
      direction: 'up' | 'down' | 'same' | 'unknown';
    };
    vs7DayAverage: {
      average: number;
      changePct: number | null;
      direction: 'up' | 'down' | 'same' | 'unknown';
    };
  };
  streaks: {
    noSpendStreak: number;
    smartSpenderStreak: number;
    budgetStreak: number;
  };
  predictions: {
    monthEndProjection: number;
    burnRate: number;
    trendDirection: { slope: number; direction: 'up' | 'down' | 'flat' };
    budgetETA: { daysLeft: number; willExceed: boolean; projectedOver: number } | null;
    smartCapTomorrow: number | null;
    // NEW: projection enrichment
    projectionConfidence: 'high' | 'medium' | 'low';
    budgetCompliancePct: number | null; // 0-100, probability of staying on budget
    daysUntilBudgetOut: number | null; // countdown days until budget runs out
    topProjectedCategory: { name: string; emoji: string; projected: number; pct: number } | null;
    // ── Category-basis selection (Fase 1) ───────────────────────────
    // The user can pick which expense categories feed the projection.
    // Empty array = all expense categories (default, pre-feature behaviour).
    // Non-empty = only those categories are counted in monthEndProjection,
    // projectionBurnRate, projectionConfidence, and topProjectedCategory.
    projectionCategoryNames: string[];
    projectionIsFiltered: boolean;
    // The burn rate used for the "rate X/hari" label under the projection.
    // When filtered, this is the avg daily spend of SELECTED categories only
    // (so the label stays consistent with the filtered projection number).
    // When unfiltered, equals burnRate.
    projectionBurnRate: number;
    // The all-categories projection, for the "vs semua" comparison label.
    // Null when not filtered (no comparison needed). Non-null only when the
    // user has selected specific categories — lets the UI show
    // "vs semua: Rp Y" so the user sees the delta their selection makes.
    projectionFullProjection: number | null;
    // All expense categories available for selection (name + emoji + color).
    // Used by the Daily Recap UI to render the toggle chips without a
    // separate fetch to /api/finance/categories.
    availableExpenseCategories: Array<{ name: string; emoji: string; color: string }>;
    // ── What-if scenario support (Fase 3) ───────────────────────────
    // Raw numbers needed for client-side what-if slider computation.
    // The slider lets the user ask "if I cut spending by X% for the rest
    // of the month, what's my new projection?". Computed client-side for
    // instant feedback (no refetch on every slider drag).
    //   whatIfBase = month-to-date spend of the CURRENT basis (filtered
    //     or all — matches the projection number shown above).
    //   whatIfDaysElapsed = day of month (1-31). Same as daysElapsed.
    //   whatIfDaysRemaining = days STRICTLY AFTER today (not counting
    //     today, since today's spend is already in whatIfBase).
    // Formula: adjustedProjection = whatIfBase + (whatIfBase / whatIfDaysElapsed)
    //          × (1 - reductionPct/100) × whatIfDaysRemaining
    whatIfBase: number;
    whatIfDaysElapsed: number;
    whatIfDaysRemaining: number;
    // ── Accuracy badge (Fase 3) ─────────────────────────────────────
    // How accurate was last month's projection (computed at the same day
    // of month as today)? Compares the projection that WOULD have been
    // made on this day last month vs the actual total for last month.
    // null if insufficient data (no last-month transactions, or
    // daysElapsed < 7 → projection too volatile to be meaningful).
    lastMonthAccuracy: {
      projected: number; // what the projection was on this day last month
      actual: number; // actual total spending for last month
      deviationPct: number; // |projected - actual| / actual × 100
      tier: 'accurate' | 'close' | 'off'; // ≤10% accurate, ≤25% close, else off
    } | null;
  };
  alerts: Alert[];
  patterns: {
    bestDayThisMonth: { date: string; amount: number } | null;
    worstDayThisMonth: { date: string; amount: number } | null;
    dayOfWeekPattern: Array<{ day: string; avgAmount: number; count: number }>;
    personalityTag: { tag: string; emoji: string; description: string };
    transactionDiversity: number;
    cashFlowHealth: { ratio: number; status: 'healthy' | 'warning' | 'danger' };
    savingsRate: number;
    categoryAnomaly: Array<{ category: string; zScore: number; amount: number; isAnomaly: boolean; avgAmount: number }>;
  };
  gamification: {
    dailyBadge: { id: string; name: string; emoji: string; description: string } | null;
    comboMultiplier: number;
    personalRecord: { isRecord: boolean; amount: number; rank: number; totalDays: number } | null;
  };
  sparkline: {
    daily7d: Array<{ date: string; amount: number; isToday: boolean }>;
    isTodayLowest: boolean;
    isTodayHighest: boolean;
  };
  dailyBudget: {
    target: number | null;
    spent: number;
    remaining: number;
    percentage: number;
    status: 'under' | 'on_track' | 'nearing' | 'over';
  } | null;
}

// ── Shared context threaded between service modules ──────────────────────
//
// The original route.ts had one big GET() handler with many local
// variables shared across inline computations. Splitting the handler into
// separate modules (alerts, patterns, projections, category-stats) requires
// passing that shared state between modules. Instead of 20+ positional
// params per function, we bundle them into this context object.
//
// The orchestrator (route.ts) builds the context incrementally as it
// computes each piece, then passes the relevant slices to each service
// function. Mutability: the context is treated as read-only by service
// modules — they return new objects, they don't mutate ctx.

export interface DailyRecapContext {
  // ── Time basics (Jakarta) ─────────────────────────────────────────
  todayStr: string; // yyyy-MM-dd
  todayParts: { year: number; month: number; day: number; hours: number };
  monthKey: string; // yyyy-MM
  yy: number;
  mm: number;
  daysInMonth: number;
  daysElapsed: number;

  // ── Raw transactions (already filtered to exclude transfer/adjustment)
  allRecentTx: TransactionRow[]; // last 30 days
  monthTx: TransactionRow[]; // this Jakarta month only
  txByDate: Map<string, TransactionRow[]>; // bucketed by Jakarta date key
  todayTx: TransactionRow[];
  yesterdayKey: string;
  yesterdayExpense: number;

  // ── Categories ────────────────────────────────────────────────────
  financeCategories: FinanceCategoryRow[];
  financeCategoryMap: Map<string, FinanceCategoryMeta>;
  metaFor: (name: string) => { emoji: string; color: string };

  // ── Today's aggregates (computed in the orchestrator) ────────────
  todayIncome: number;
  todayExpense: number;
  todayCategoryMap: Map<string, { amount: number; count: number }>;
  todaySourceMap: Map<string, number>;
  hourlyBreakdown: number[];
  todayTransactions: TodayTransaction[];
  todayCategories: CategoryBreakdown[];
  todaySources: SourceBreakdown[];
  peakHour: { hour: number; amount: number } | null;
  topTransaction: TodayTransaction | null;
  todayTxCount: number;

  // ── 7-day window ──────────────────────────────────────────────────
  daily7d: Array<{ date: string; amount: number; isToday: boolean }>;
  last7dExpenses: number[];
  avg7d: number;

  // ── Streaks ───────────────────────────────────────────────────────
  noSpendStreak: number;
  smartSpenderStreak: number;
  hasHistory: boolean;
  maxStreakLookback: number;

  // ── Budget ────────────────────────────────────────────────────────
  appSettings: AppSettingsRow | null;
  dailyTarget: number;
  dailyBudget: DailyRecapResponse['dailyBudget'];
  budgetStreak: number;
}
