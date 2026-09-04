// ── Types (mirrors API response) ─────────────────────────────────────────
// Extracted from daily-recap.tsx during SPLIT-PHASE2-UI.

export interface TodayTransaction {
  id: string;
  type: string;
  amount: number;
  category: string;
  description: string | null;
  // ISO string of the transaction date. The client formats this to Jakarta
  // wall-clock time via `toLocaleTimeString('id-ID', { timeZone:
  // 'Asia/Jakarta' })` — same code path as the Transactions tab, so the time
  // shown here always matches the Transactions tab for the same transaction.
  date: string;
  source: string;
}

export interface CategoryStats {
  name: string;
  todayAmount: number;
  todayCount: number;
  // 30-day window (powers delta badge + anomaly z-score)
  maxTransaction: number;
  avgTransaction: number;
  maxDaily: number;
  avgDaily: number;
  deltaVsAvgDaily: number;
  emoji: string;
  color: string;
  // Current month window (for "Bulan ini" tab)
  monthMaxTransaction: number;
  monthAvgTransaction: number;
  monthMaxDaily: number;
  monthAvgDaily: number;
  // All-time window (for "All-time" tab)
  allTimeMaxTransaction: number;
  allTimeAvgTransaction: number;
  allTimeMaxDaily: number;
  allTimeAvgDaily: number;
}

export interface DailyRecap {
  date: string;
  today: {
    income: number;
    expense: number;
    net: number;
    transactionCount: number;
    expenseCount: number;
    transactions: TodayTransaction[];
    categories: Array<{ name: string; amount: number; count: number; emoji: string; color: string }>;
    categoryStats: CategoryStats[];
    sources: Array<{ name: string; amount: number }>;
    hourlyBreakdown: number[]; // 48 elements, expense per 30-min bucket
    peakHour: { hour: number; amount: number } | null;
    topTransaction: TodayTransaction | null;
  };
  comparison: {
    vsYesterday: { expense: number; changePct: number | null; direction: string };
    vs7DayAverage: { average: number; changePct: number | null; direction: string };
  };
  streaks: {
    noSpendStreak: number;
    smartSpenderStreak: number;
    budgetStreak: number;
  };
  predictions: {
    monthEndProjection: number;
    burnRate: number;
    trendDirection: { slope: number; direction: string };
    budgetETA: { daysLeft: number; willExceed: boolean; projectedOver: number } | null;
    smartCapTomorrow: number | null;
    projectionConfidence: 'high' | 'medium' | 'low';
    budgetCompliancePct: number | null;
    daysUntilBudgetOut: number | null;
    topProjectedCategory: { name: string; emoji: string; projected: number; pct: number } | null;
    // ── Category-basis selection (Fase 1) ──
    projectionCategoryNames: string[];
    projectionIsFiltered: boolean;
    projectionBurnRate: number;
    projectionFullProjection: number | null;
    availableExpenseCategories: Array<{ name: string; emoji: string; color: string }>;
    // ── What-if scenario (Fase 3) ──
    whatIfBase: number;
    whatIfDaysElapsed: number;
    whatIfDaysRemaining: number;
    // ── Accuracy badge (Fase 3) ──
    lastMonthAccuracy: {
      projected: number;
      actual: number;
      deviationPct: number;
      tier: 'accurate' | 'close' | 'off';
    } | null;
  };
  alerts: Array<{
    type: string;
    severity: 'info' | 'warning' | 'danger';
    message: string;
    data?: Record<string, unknown>;
  }>;
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

export type DailyRecapAlert = DailyRecap['alerts'][number];
