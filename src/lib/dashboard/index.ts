// Barrel index for the dashboard service modules.
// Re-exports the service functions + types so the route can import them
// all from one path: `@/lib/dashboard`.

export type {
  Period,
  DifficultyOptionRow,
  ActiveGoalRow,
  RecentDailyLogRow,
  MonthTransactionRow,
  BudgetRow,
  HabitLogRow,
  TimeHabitLogRow,
  LatestHabitLogRow,
  WeeklyChartPoint,
  MonthlyChartPoint,
  StackedBarPoint,
  WeeklyPatternPoint,
  CategoryPerformancePoint,
  TodayFocusItem,
  HabitDetailStat,
  BestWorstHabit,
  FinanceOverview,
  TimeHabitWeekTime,
  TimeHabitSummary,
  LastDoneSummaryItem,
  CompletionStatsResult,
  DashboardBaseData,
  DashboardLogData,
  DashboardResponse,
} from './types';

export {
  safe,
  calcLevel,
  calcNextLevelXP,
  getPeriodDays,
  toMinutesFromISO,
  minutesToHHmm,
  intervalToDays,
  buildHabitCreatedDates,
  habitsActiveOnDate,
  theoreticalMaxInRange,
  buildDailyCompletionMap,
} from './helpers';

export {
  fetchDashboardBaseData,
  fetchDashboardLogData,
} from './queries';

export {
  computeCompletionStats,
  type CompletionStatsContext,
} from './completion-stats';

export {
  buildWeeklyChart,
  buildMonthlyChart,
  buildStackedBarChart,
  buildWeeklyPatternChart,
} from './chart-builders';

export { computeFinanceOverview } from './finance-overview';

export { computeTimeTrackedSummary } from './time-tracked-summary';

export { computeLastDoneSummary } from './last-done-summary';
