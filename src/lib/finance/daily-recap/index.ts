// Barrel index for the daily-recap service modules.
// Re-exports the service functions so the route can import them all from
// one path: `@/lib/finance/daily-recap`.
//
// NOTE: This barrel is consumed by exactly one file —
// `src/app/api/finance/daily-recap/route.ts`. Only the function re-exports
// imported by that route are kept here; the 9 dead type re-exports
// (TodayAggregates, DailyBudgetResult, ComparisonsResult, GamificationInput,
// GamificationResult, BuildDailyRecapContextInput, ProjectionBasis,
// ProjectionEnrichment, PatternsResult) were removed as dead (DEADCODE-FIX-1).
// Those types still exist in their source modules and can be imported
// directly from there if ever needed.

export { buildAlerts } from './alerts';
export { buildCategoryStats } from './category-stats';
export { buildPatterns } from './patterns';
export { buildProjectionBasis, buildProjectionEnrichment } from './projections';
export { computeTodayAggregates } from './today-aggregates';
export {
  computeNoSpendStreak,
  computeSmartSpenderStreak,
  computeDailyBudget,
} from './streaks';
export { computeComparisons } from './comparisons';
export { computeGamification } from './gamification';
export { buildDailyRecapContext } from './context';
