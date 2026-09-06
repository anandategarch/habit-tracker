// Barrel index for the daily-recap service modules.
// Re-exports the service functions so the route can import them all from
// one path: `@/lib/finance/daily-recap`.

export { buildAlerts } from './alerts';
export { buildCategoryStats } from './category-stats';
export { buildPatterns } from './patterns';
export { buildProjectionBasis, buildProjectionEnrichment } from './projections';
export { computeTodayAggregates } from './today-aggregates';
export type { TodayAggregates } from './today-aggregates';
export {
  computeNoSpendStreak,
  computeSmartSpenderStreak,
  computeDailyBudget,
} from './streaks';
export type { DailyBudgetResult } from './streaks';
export { computeComparisons } from './comparisons';
export type { ComparisonsResult } from './comparisons';
export { computeGamification } from './gamification';
export type { GamificationInput, GamificationResult } from './gamification';
export { buildDailyRecapContext } from './context';
export type { BuildDailyRecapContextInput } from './context';
export type {
  ProjectionBasis,
  ProjectionEnrichment,
} from './projections';
export type { PatternsResult } from './patterns';
