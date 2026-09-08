// Extracted from dashboard.tsx — shared types for the dashboard feature.

export type Period = '7d' | '1m' | '3m' | 'all';

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: '7 Hari' },
  { value: '1m', label: '1 Bulan' },
  { value: '3m', label: '3 Bulan' },
  { value: 'all', label: 'Semua' },
];

export interface MotivationalQuote {
  quote: string;
  translation: string;
  author: string;
}

export interface DashboardData {
  totalHabits: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  successToday: number;
  weeklyCompletion: number;
  monthlyCompletion: number;
  bestHabit: { id?: string; name: string; icon: string; rate: number };
  worstHabit: { id?: string; name: string; icon: string; rate: number };
  totalXP: number;
  currentLevel: number;
  nextLevelXP: number;
  currentLevelXP: number;
  levelProgress: number;
  goalProgress: number;
  moodAverage: string;
  sleepAverage: string;
  productivityScore: number;
  weeklyChartData: { day: string; date: string; dateKey: string; completed: number; total: number; rate: number }[];
  monthlyChartData: { day: string; completed: number; total: number; rate: number }[];
  categoryPerformance: { category: string; done: number; total: number; rate: number }[];
  todayFocus: { id: string; name: string; icon: string; priority: string }[];
  period: string;
  habitDetailStats: { id: string; name: string; icon: string; color: string; category: string; completed: number; total: number; rate: number; streak: number }[];
  stackedBarData: { day: string; completed: number; missed: number; total: number; rate: number }[];
  weeklyPattern: { day: string; fullDay: string; rate: number; avgCompleted: string }[];
  financeOverview: {
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
    transactionCount: number;
    budgetWarning: number;
    budgetExceeded: number;
  };
  timeTrackedSummary: {
    id: string;
    name: string;
    icon: string;
    color: string;
    targetTime: string | null;
    todayTime: string | null;
    todayDone: boolean;
    weekAvg: string | null;
    weekOnTarget: number;
    weekTotal: number;
    weekOnTargetRate: number;
    prevAvg: string | null;
    trend: number | null;
    weekTimes: { day: string; time: string | null; minutes: number | null }[];
  }[];
  lastDoneSummary: {
    id: string;
    name: string;
    icon: string;
    color: string;
    interval: string | null;
    intervalDays: number;
    lastDate: string | null;
    daysAgo: number | null;
    completedAt: string | null;
    overdue: boolean;
  }[];
}

// Convenience aliases for the per-row shapes inside DashboardData — used by
// the dashboard section sub-components (dashboard-time-tracked-habits.tsx,
// dashboard-last-done.tsx, dashboard-finance-overview.tsx) extracted in
// PHASE-A-2.
export type TimeTrackedSummary = DashboardData['timeTrackedSummary'][number];
export type LastDoneSummary = DashboardData['lastDoneSummary'][number];
export type FinanceOverview = DashboardData['financeOverview'];
