import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { jakartaDateString, jakartaDateKey, jakartaNowParts, jakartaMonthString } from '@/lib/timezone';

// ── Types ────────────────────────────────────────────────────────────────

interface TodayTransaction {
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

interface CategoryBreakdown {
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
interface CategoryStats {
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

interface SourceBreakdown {
  name: string;
  amount: number;
}

interface Alert {
  type: 'over_budget' | 'nearing_budget' | 'big_ticket' | 'unusual_activity' | 'recurring' | 'late_night' | 'first_tx_nudge';
  severity: 'info' | 'warning' | 'danger';
  message: string;
  data?: Record<string, unknown>;
}

interface DailyRecapResponse {
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

// ── Helpers ──────────────────────────────────────────────────────────────

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/** Compute linear regression slope of daily amounts. Positive = uptrend. */
function trendSlope(values: number[]): { slope: number; direction: 'up' | 'down' | 'flat' } {
  if (values.length < 2) return { slope: 0, direction: 'flat' };
  const n = values.length;
  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (values[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  // Threshold: slope > 1% of mean = significant
  const threshold = Math.max(1000, meanY * 0.01);
  return {
    slope,
    direction: slope > threshold ? 'up' : slope < -threshold ? 'down' : 'flat',
  };
}

/** Compute z-score for anomaly detection. */
function zScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/** Standard deviation (population). */
function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Fallback emoji/color for default-named categories that still have the
 * placeholder 📦 emoji in the DB. Mirrors the FALLBACK_EXPENSE list in
 * finance-types.ts so the API and the client resolveEmoji() helper stay
 * in sync. (We don't import from finance-types to keep the API module
 * server-only — finance-types is a client-shared file.)
 */
const FALLBACK_CATEGORY_META: Record<string, { emoji: string; color: string }> = {
  'Makanan & Minuman': { emoji: '🍽️', color: '#ef4444' },
  'Transportasi': { emoji: '🚗', color: '#f97316' },
  'Belanja': { emoji: '🛍️', color: '#eab308' },
  'Hiburan': { emoji: '🎮', color: '#a855f7' },
  'Kesehatan': { emoji: '🏥', color: '#ec4899' },
  'Pendidikan': { emoji: '📚', color: '#3b82f6' },
  'Tagihan & Utilitas': { emoji: '📋', color: '#6366f1' },
  'Tabungan & Investasi': { emoji: '🏦', color: '#14b8a6' },
  'Gaji': { emoji: '💰', color: '#22c55e' },
  'Freelance': { emoji: '💻', color: '#06b6d4' },
  'Investasi': { emoji: '📈', color: '#f59e0b' },
  'Bisnis': { emoji: '🏢', color: '#8b5cf6' },
};

const DEFAULT_EMOJI = '📦';
const DEFAULT_COLOR = '#78716c';

/**
 * Resolve a category's display emoji/color.
 * - If the FinanceCategory row has a non-default emoji, use it.
 * - Else, look up the fallback map by name (covers default-named categories
 *   that the user never customized).
 * - Else, fall back to 📦 / #78716c.
 */
function resolveCategoryMeta(
  name: string,
  dbRow?: { emoji: string; color: string }
): { emoji: string; color: string } {
  if (dbRow && dbRow.emoji !== DEFAULT_EMOJI) {
    return { emoji: dbRow.emoji, color: dbRow.color || DEFAULT_COLOR };
  }
  const fallback = FALLBACK_CATEGORY_META[name];
  if (fallback) return fallback;
  if (dbRow) return { emoji: dbRow.emoji || DEFAULT_EMOJI, color: dbRow.color || DEFAULT_COLOR };
  return { emoji: DEFAULT_EMOJI, color: DEFAULT_COLOR };
}

/**
 * Parse the projectionCategoryIds JSON string from AppSettings into an
 * array of category names. Returns [] on any failure — empty means
 * "use all expense categories" (the default, pre-feature behaviour).
 * Duplicates are removed so downstream Set lookups stay cheap.
 *
 * BUG-1 fix: Truncate to AT MOST ONE category. Fase 1 was originally
 * multi-select chips (could store ["A","B","C"]), but the UI is now a
 * single-select dropdown. Without truncation, legacy multi-category data
 * would make the dropdown show only the first category while the API
 * silently filtered by all of them — inconsistent and confusing. We
 * truncate to [first] so the dropdown always reflects the actual filter.
 * Empty array (all categories) passes through unchanged.
 */
function parseProjectionCategoryNames(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const names = parsed.filter((v): v is string => typeof v === 'string' && v.length > 0);
    const unique = Array.from(new Set(names));
    return unique.length > 0 ? [unique[0]] : [];
  } catch {
    return [];
  }
}

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
    const allRecentTx = await db.transaction.findMany({
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

    // ── Predictions ──────────────────────────────────────────────────
    // Month-end projection: (spent so far this month / days elapsed) × total days
    const [yy, mm] = monthKey.split('-').map(Number);
    // Filter transactions by Jakarta month string (NOT UTC epoch bounds).
    // Previously used `new Date(Date.UTC(yy, mm-1, 1))` .. `Date.UTC(yy, mm, 0)`
    // which is UTC midnight — but Jakarta is UTC+7, so transactions in Jakarta
    // between 00:00-06:59 on the 1st of the month have UTC epochs on the last
    // day of the *previous* month and were excluded. Cascading bug:
    // monthExpenseSoFar understated → monthEndProjection wrong → budgetETA wrong
    // → bestDay/worstDay/personalRecord all wrong.
    const monthTx = allRecentTx.filter((t) => jakartaDateKey(t.date).slice(0, 7) === monthKey);
    const monthExpenseSoFar = monthTx
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    const daysInMonth = new Date(yy, mm, 0).getDate();
    const daysElapsed = todayParts.day; // day of month = days elapsed
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

    // Available expense categories for the UI dropdown selector.
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

    // Filtered per-day totals (this month, selected categories only).
    // Used for projectionConfidence when filtered. When unfiltered, we
    // reuse the all-categories monthDailyTotals computed later (no
    // duplicated work). Computed here because projectionMonthTx is in
    // scope; monthDailyTotals isn't populated yet at this point.
    const projectionMonthDailyTotals = new Map<string, number>();
    if (projectionIsFiltered) {
      for (const tx of projectionMonthTx) {
        const key = jakartaDateKey(tx.date);
        projectionMonthDailyTotals.set(key, (projectionMonthDailyTotals.get(key) ?? 0) + tx.amount);
      }
    }

    // Filtered per-category month-to-date totals (selected categories only).
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

    // Burn rate = avg 7d (overall — used by budgetETA, smartCapTomorrow,
    // daysUntilBudgetOut which are about the OVERALL budget, not the
    // filtered projection)
    const burnRate = Math.round(avg7d);

    // Trend direction (7-day expense slope)
    const trend = trendSlope(last7dExpenses);

    // Budget ETA: when will monthly budget run out?
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

    // Smart cap for the rest of the month (avg daily budget remaining).
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

    // ── Alerts ───────────────────────────────────────────────────────
    const alerts: Alert[] = [];

    if (dailyBudget) {
      if (dailyBudget.status === 'over') {
        alerts.push({
          type: 'over_budget',
          severity: 'danger',
          message: `Over budget harian ${formatRupiahShort(Math.abs(dailyBudget.remaining))}`,
          data: { over: Math.abs(dailyBudget.remaining) },
        });
      } else if (dailyBudget.status === 'nearing') {
        alerts.push({
          type: 'nearing_budget',
          severity: 'warning',
          message: `Hampir habis budget — sisa ${formatRupiahShort(dailyBudget.remaining)}`,
          data: { remaining: dailyBudget.remaining },
        });
      }
    }

    if (topTransaction && todayExpense > 0 && topTransaction.amount / todayExpense >= 0.3) {
      alerts.push({
        type: 'big_ticket',
        severity: 'info',
        message: `${topTransaction.category} ${formatRupiahShort(topTransaction.amount)} = ${Math.round((topTransaction.amount / todayExpense) * 100)}% spending hari ini`,
        data: { amount: topTransaction.amount, category: topTransaction.category },
      });
    }

    // Unusual activity: 2× normal transaction count
    const avgTxCount7d = daily7d.reduce((s, d) => {
      const dayTx = txByDate.get(d.date) ?? [];
      return s + dayTx.filter((t) => t.type === 'expense').length;
    }, 0) / 7;
    const todayTxCount = todayTx.filter((t) => t.type === 'expense').length;
    if (avgTxCount7d > 0 && todayTxCount >= avgTxCount7d * 2 && todayTxCount >= 4) {
      alerts.push({
        type: 'unusual_activity',
        severity: 'info',
        message: `Aktivitas ${Math.round(todayTxCount / avgTxCount7d)}× normal — ${todayTxCount} transaksi vs rata-rata ${avgTxCount7d.toFixed(1)}`,
        data: { count: todayTxCount, avg: avgTxCount7d },
      });
    }

    // Late night spending: tx between 22:00-04:00 Jakarta time.
    // We need to re-extract the hour from the ISO date string since the
    // `TodayTransaction` type no longer carries an `hour` field (it now
    // carries the full ISO date for accurate minute-precision display).
    const lateNightTx = todayTransactions.filter((t) => {
      if (t.type !== 'expense') return false;
      const h = parseInt(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          hour12: false,
        }).format(new Date(t.date)),
        10
      ) % 24;
      return h >= 22 || h < 5; // aligned with heatmap coloring (h < 5)
    });
    if (lateNightTx.length > 0) {
      const lateNightTotal = lateNightTx.reduce((s, t) => s + t.amount, 0);
      // Format the first late-night tx's time as "HH.MM" (Indonesian).
      const firstTime = new Date(lateNightTx[0].date).toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
      });
      alerts.push({
        type: 'late_night',
        severity: 'info',
        message: `🌙 Late night spending: ${formatRupiahShort(lateNightTotal)} jam ${firstTime}`,
        data: { total: lateNightTotal, count: lateNightTx.length },
      });
    }

    // First transaction nudge: no tx by 14:00
    if (todayTxCount === 0 && todayParts.hours >= 14) {
      alerts.push({
        type: 'first_tx_nudge',
        severity: 'info',
        message: `Belum ada transaksi hari ini — catat pengeluaran pertamamu`,
      });
    }

    // Recurring detected: same description + similar amount (±10%) in ≥3
    // different months.
    //
    // Two bugs fixed here:
    //   1. `allRecentTx` only covers 30 days, so a 30-day window can span at
    //      most 3 calendar months (and only when today is day 1-2 of a month
    //      following a 28-31 day month). For ~93% of the month, ≥3 months was
    //      unreachable — feature was dead code. Fix: fetch a wider 95-day
    //      window specifically for recurring detection.
    //   2. The comment promised "similar amount (±10%)" but the code only
    //      checked description equality. Fix: add the ±10% amount check.
    if (todayTransactions.length > 0) {
      // Fetch 95 days of history for recurring detection (3+ months coverage).
      // Separate query — small payload since we only need description+amount+date.
      const ninetyFiveDaysAgo = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000);
      const recurringHistoryTx = await db.transaction.findMany({
        where: { date: { gte: ninetyFiveDaysAgo }, type: 'expense' },
        select: { description: true, amount: true, date: true },
      });

      for (const tx of todayTransactions) {
        if (tx.type !== 'expense' || !tx.description) continue;
        const matchingMonths = new Set<string>();
        for (const old of recurringHistoryTx) {
          if (!old.description) continue;
          if (old.description !== tx.description) continue;
          // ±10% amount similarity check (was missing — comment promised it).
          // Skip if amounts differ by more than 10% of today's amount.
          if (tx.amount > 0 && Math.abs(old.amount - tx.amount) / tx.amount > 0.1) continue;
          const oldKey = jakartaDateKey(old.date);
          matchingMonths.add(oldKey.slice(0, 7));
        }
        if (matchingMonths.size >= 3) {
          alerts.push({
            type: 'recurring',
            severity: 'info',
            message: `🔄 "${tx.description}" muncul ${matchingMonths.size} bulan — tagihan berulang?`,
            data: { description: tx.description, months: matchingMonths.size },
          });
          break; // only show one recurring alert
        }
      }
    }

    // ── Patterns ─────────────────────────────────────────────────────

    // Best/worst day this month (lowest/highest expense)
    const monthDailyTotals = new Map<string, number>();
    for (const tx of monthTx) {
      if (tx.type !== 'expense') continue;
      const key = jakartaDateKey(tx.date);
      monthDailyTotals.set(key, (monthDailyTotals.get(key) ?? 0) + tx.amount);
    }
    let bestDayThisMonth: { date: string; amount: number } | null = null;
    let worstDayThisMonth: { date: string; amount: number } | null = null;
    for (const [date, amount] of monthDailyTotals.entries()) {
      // Only consider days that have at least one transaction recorded.
      // (Days with no data are excluded — we don't want to falsely report
      // a 0-expense "best day" when the user simply didn't track.)
      if (!bestDayThisMonth || amount < bestDayThisMonth.amount) bestDayThisMonth = { date, amount };
      if (!worstDayThisMonth || amount > worstDayThisMonth.amount) worstDayThisMonth = { date, amount };
    }

    // Day-of-week pattern (last 30 days)
    const dowStats = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
    for (const [date, amount] of monthDailyTotals.entries()) {
      const d = new Date(date + 'T00:00:00Z');
      const dow = d.getUTCDay();
      dowStats[dow].total += amount;
      dowStats[dow].count += 1;
    }
    const dayOfWeekPattern = dowStats.map((s, i) => ({
      day: DAY_NAMES[i],
      avgAmount: s.count > 0 ? Math.round(s.total / s.count) : 0,
      count: s.count,
    }));

    // Personality tag
    let personalityTag: { tag: string; emoji: string; description: string };
    if (todayExpense === 0) {
      personalityTag = { tag: 'No-Spend Master', emoji: '💎', description: 'Hari tanpa pengeluaran — disiplin!' };
    } else if (dailyBudget?.status === 'over') {
      personalityTag = { tag: 'Big Spender', emoji: '💸', description: 'Over budget hari ini — besok lebih hemat ya' };
    } else if (smartSpenderStreak >= 3) {
      personalityTag = { tag: 'Smart Spender', emoji: '🎯', description: `${smartSpenderStreak} hari hemat berturut — konsisten!` };
    } else if (todayExpense < avg7d) {
      personalityTag = { tag: 'Mindful Spender', emoji: '🧘', description: 'Hari ini di bawah rata-rata — pertahankan!' };
    } else if (todayExpense > avg7d * 1.5) {
      personalityTag = { tag: 'Wild Spender', emoji: '🎢', description: 'Spending 1.5× di atas normal — easy tiger' };
    } else {
      personalityTag = { tag: 'Steady Spender', emoji: '⚖️', description: 'Spending normal hari ini' };
    }

    // Transaction diversity: unique categories today
    const transactionDiversity = todayCategoryMap.size;

    // Cash flow health: income vs expense ratio today
    const ratio = todayIncome > 0 ? todayExpense / todayIncome : (todayExpense > 0 ? Infinity : 0);
    const cashFlowHealth = {
      ratio: ratio === Infinity ? -1 : Math.round(ratio * 100) / 100,
      status: (ratio === Infinity ? 'danger' : ratio > 1 ? 'danger' : ratio > 0.7 ? 'warning' : 'healthy') as 'healthy' | 'warning' | 'danger',
    };

    // Savings rate: % income not spent today
    const savingsRate = todayIncome > 0
      ? Math.round(((todayIncome - todayExpense) / todayIncome) * 100)
      : (todayExpense === 0 ? 100 : 0);

    // Category anomaly: z-score per category vs 30-day history.
    // Re-aggregate: per category, per day, total expense.
    const catDayTotals = new Map<string, Map<string, number>>(); // category -> dateKey -> total
    for (const tx of allRecentTx) {
      if (tx.type !== 'expense') continue;
      const dateKey = jakartaDateKey(tx.date);
      if (!catDayTotals.has(tx.category)) catDayTotals.set(tx.category, new Map());
      const dayMap = catDayTotals.get(tx.category)!;
      dayMap.set(dateKey, (dayMap.get(dateKey) ?? 0) + tx.amount);
    }
    const categoryAnomaly: Array<{ category: string; zScore: number; amount: number; isAnomaly: boolean; avgAmount: number }> = [];
    for (const [cat, dayMap] of catDayTotals.entries()) {
      const todayAmount = todayCategoryMap.get(cat)?.amount ?? 0;
      if (todayAmount === 0) continue; // skip categories not spent today
      const allDailyTotals = Array.from(dayMap.values());
      const mean = allDailyTotals.reduce((a, b) => a + b, 0) / allDailyTotals.length;
      const sd = stdDev(allDailyTotals);
      const z = zScore(todayAmount, mean, sd);
      categoryAnomaly.push({
        category: cat,
        zScore: Math.round(z * 100) / 100,
        amount: todayAmount,
        avgAmount: Math.round(mean),
        isAnomaly: z > 1.5, // 1.5σ above normal
      });
    }
    categoryAnomaly.sort((a, b) => b.zScore - a.zScore);

    // ── Per-category deep stats (for the "per-category insight" UI block).
    // For each category that has transactions today, compute:
    //   - todayAmount / todayCount (today's totals)
    //   - maxTransaction / avgTransaction (per single-tx, 30-day)
    //   - maxDaily / avgDaily (per-day-total, 30-day — only days with tx)
    //   - deltaVsAvgDaily = todayAmount - avgDaily (negative = below avg)
    //
    // We reuse `catDayTotals` for the per-day aggregation, and walk
    // `allRecentTx` once more to bucket per-tx amounts per category.
    const catTxAmounts = new Map<string, number[]>(); // category -> [amount, amount, ...]
    for (const tx of allRecentTx) {
      if (tx.type !== 'expense') continue;
      if (!catTxAmounts.has(tx.category)) catTxAmounts.set(tx.category, []);
      catTxAmounts.get(tx.category)!.push(tx.amount);
    }

    // ── Current-month per-category stats (new — for "Bulan ini" tab) ──
    // Reuse `monthTx` (already filtered to this Jakarta month). Build
    // per-category tx-amount arrays + day-total maps, same structure as
    // the 30-day maps above. Only expense txs are counted.
    const monthCatTxAmounts = new Map<string, number[]>();
    const monthCatDayTotals = new Map<string, Map<string, number>>();
    for (const tx of monthTx) {
      if (tx.type !== 'expense') continue;
      if (!monthCatTxAmounts.has(tx.category)) {
        monthCatTxAmounts.set(tx.category, []);
        monthCatDayTotals.set(tx.category, new Map());
      }
      monthCatTxAmounts.get(tx.category)!.push(tx.amount);
      const dk = jakartaDateKey(tx.date);
      const dm = monthCatDayTotals.get(tx.category)!;
      dm.set(dk, (dm.get(dk) ?? 0) + tx.amount);
    }

    // ── All-time per-category stats (new — for "All-time" tab) ────────
    // Single query for ALL expense transactions ever recorded. This is
    // heavier than the 30-day query, but only runs once per daily-recap
    // request and the payload is small (amount + date + category only).
    // For users with thousands of txs over years, this could be optimized
    // with a cached CategoryStats table updated on mutation — but for now
    // (personal app, <1000 txs) the direct query is fine.
    const allTimeTxRaw = await db.transaction.findMany({
      where: { type: 'expense' },
      select: { amount: true, date: true, category: true },
    });
    const allTimeCatTxAmounts = new Map<string, number[]>();
    const allTimeCatDayTotals = new Map<string, Map<string, number>>();
    for (const tx of allTimeTxRaw) {
      if (!allTimeCatTxAmounts.has(tx.category)) {
        allTimeCatTxAmounts.set(tx.category, []);
        allTimeCatDayTotals.set(tx.category, new Map());
      }
      allTimeCatTxAmounts.get(tx.category)!.push(tx.amount);
      const dk = jakartaDateKey(tx.date);
      const dm = allTimeCatDayTotals.get(tx.category)!;
      dm.set(dk, (dm.get(dk) ?? 0) + tx.amount);
    }

    const categoryStats: CategoryStats[] = [];
    for (const [cat, dayMap] of catDayTotals.entries()) {
      const todayEntry = todayCategoryMap.get(cat);
      if (!todayEntry) continue; // only categories with tx today
      const txAmounts = catTxAmounts.get(cat) ?? [];
      const dailyTotals = Array.from(dayMap.values());

      const maxTransaction = txAmounts.length > 0 ? Math.max(...txAmounts) : 0;
      const avgTransaction = txAmounts.length > 0
        ? Math.round(txAmounts.reduce((a, b) => a + b, 0) / txAmounts.length)
        : 0;
      const maxDaily = dailyTotals.length > 0 ? Math.max(...dailyTotals) : 0;
      const avgDaily = dailyTotals.length > 0
        ? Math.round(dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length)
        : 0;

      // Current-month stats
      const monthTxAmts = monthCatTxAmounts.get(cat) ?? [];
      const monthDayTots = Array.from((monthCatDayTotals.get(cat) ?? new Map()).values());
      const monthMaxTransaction = monthTxAmts.length > 0 ? Math.max(...monthTxAmts) : 0;
      const monthAvgTransaction = monthTxAmts.length > 0
        ? Math.round(monthTxAmts.reduce((a, b) => a + b, 0) / monthTxAmts.length)
        : 0;
      const monthMaxDaily = monthDayTots.length > 0 ? Math.max(...monthDayTots) : 0;
      const monthAvgDaily = monthDayTots.length > 0
        ? Math.round(monthDayTots.reduce((a, b) => a + b, 0) / monthDayTots.length)
        : 0;

      // All-time stats
      const allTimeTxAmts = allTimeCatTxAmounts.get(cat) ?? [];
      const allTimeDayTots = Array.from((allTimeCatDayTotals.get(cat) ?? new Map()).values());
      const allTimeMaxTransaction = allTimeTxAmts.length > 0 ? Math.max(...allTimeTxAmts) : 0;
      const allTimeAvgTransaction = allTimeTxAmts.length > 0
        ? Math.round(allTimeTxAmts.reduce((a, b) => a + b, 0) / allTimeTxAmts.length)
        : 0;
      const allTimeMaxDaily = allTimeDayTots.length > 0 ? Math.max(...allTimeDayTots) : 0;
      const allTimeAvgDaily = allTimeDayTots.length > 0
        ? Math.round(allTimeDayTots.reduce((a, b) => a + b, 0) / allTimeDayTots.length)
        : 0;

      categoryStats.push({
        name: cat,
        todayAmount: todayEntry.amount,
        todayCount: todayEntry.count,
        maxTransaction,
        avgTransaction,
        maxDaily,
        avgDaily,
        deltaVsAvgDaily: todayEntry.amount - avgDaily,
        emoji: metaFor(cat).emoji,
        color: metaFor(cat).color,
        monthMaxTransaction,
        monthAvgTransaction,
        monthMaxDaily,
        monthAvgDaily,
        allTimeMaxTransaction,
        allTimeAvgTransaction,
        allTimeMaxDaily,
        allTimeAvgDaily,
      });
    }
    // Sort by todayAmount desc — biggest spending today first.
    categoryStats.sort((a, b) => b.todayAmount - a.todayAmount);

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
    const all30dExpenses = Array.from(monthDailyTotals.values()).sort((a, b) => a - b);
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

    // ── NEW: Projection enrichment (computed after monthDailyTotals + categoryStats) ──
    // Confidence: based on coefficient of variation (CV) of daily spending.
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

    // Budget compliance probability — ALWAYS based on the ALL-categories
    // projection vs the OVERALL monthly budget target. The budget applies to
    // total spending, so filtering categories must not inflate the compliance
    // percentage (which would falsely reassure the user). Previously used
    // `monthEndProjection` which is now the filtered value when categories
    // are selected — that was a bug; fixed to use `monthEndProjectionAll`.
    const budgetCompliancePct = totalMonthlyTarget > 0
      ? Math.max(0, Math.min(100, Math.round(100 - ((monthEndProjectionAll - totalMonthlyTarget) / totalMonthlyTarget) * 200)))
      : null;

    // Days until budget runs out — always based on OVERALL spending/burn rate
    // (budget applies to all spending, not the filtered subset).
    let daysUntilBudgetOut: number | null = null;
    if (totalMonthlyTarget > 0 && burnRate > 0) {
      const remBudget = totalMonthlyTarget - monthExpenseSoFar;
      daysUntilBudgetOut = remBudget > 0 ? Math.ceil(remBudget / burnRate) : 0;
    }

    // Top projected category.
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

    // ── Build response ───────────────────────────────────────────────
    const response: DailyRecapResponse = {
      date: todayStr,
      today: {
        income: todayIncome,
        expense: todayExpense,
        net: todayIncome - todayExpense,
        transactionCount: todayTx.length,
        expenseCount: todayTx.filter((t) => t.type === 'expense').length,
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
        monthEndProjection,
        burnRate,
        trendDirection: trend,
        budgetETA,
        smartCapTomorrow,
        projectionConfidence,
        budgetCompliancePct,
        daysUntilBudgetOut,
        topProjectedCategory,
        // ── Category-basis selection (Fase 1) ──
        projectionCategoryNames,
        projectionIsFiltered,
        // BUG-2 fix: projectionBurnRate is now the MTD rate for both
        // filtered and unfiltered cases (computed above). No longer falls
        // back to the 7-day burnRate — that's only for budget ETA metrics.
        projectionBurnRate,
        projectionFullProjection: projectionIsFiltered ? monthEndProjectionAll : null,
        availableExpenseCategories,
        // ── What-if scenario raw numbers (Fase 3) ──
        whatIfBase,
        whatIfDaysElapsed,
        whatIfDaysRemaining,
        // ── Last month accuracy badge (Fase 3) ──
        lastMonthAccuracy,
      },
      alerts,
      patterns: {
        bestDayThisMonth,
        worstDayThisMonth,
        dayOfWeekPattern,
        personalityTag,
        transactionDiversity,
        cashFlowHealth,
        savingsRate,
        // Filter to actual anomalies first, then slice — previously sliced
        // top-3 by z-score which could include non-anomalies (zScore < 1.5)
        // while dropping real anomalies further down the list.
        categoryAnomaly: categoryAnomaly.filter((c) => c.isAnomaly).slice(0, 5),
      },
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

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/finance/daily-recap error:', error);
    return NextResponse.json({ error: 'Failed to fetch daily recap' }, { status: 500 });
  }
}

// ── Small helper (kept local to avoid polluting money.ts) ────────────────
function formatRupiahShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1000)}k`;
  return String(n);
}
