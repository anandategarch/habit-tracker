// Barrel index for the dashboard service modules.
// Re-exports the service functions + types so the route can import them
// all from one path: `@/lib/dashboard`.
//
// NOTE: This barrel is consumed by exactly one file —
// `src/app/api/dashboard/route.ts`. Only the symbols imported by that route
// are re-exported here; everything else (helpers like `safe`/`calcLevel`/
// `toMinutesFromISO`, the type-only re-exports for rows/charts, etc.) was
// removed as dead re-exports (DEADCODE-FIX-1). The underlying symbols
// remain in their source modules.

export type { Period } from './types';

export { getPeriodDays, buildHabitCreatedDates, buildDailyCompletionMap } from './helpers';

export {
  fetchDashboardBaseData,
  fetchDashboardLogData,
} from './queries';

export { computeCompletionStats } from './completion-stats';

export {
  buildWeeklyChart,
  buildMonthlyChart,
  buildStackedBarChart,
  buildWeeklyPatternChart,
} from './chart-builders';

export { computeFinanceOverview } from './finance-overview';

export { computeTimeTrackedSummary } from './time-tracked-summary';

export { computeLastDoneSummary } from './last-done-summary';
