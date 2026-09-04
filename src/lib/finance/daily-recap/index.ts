// Barrel index for the daily-recap service modules.
// Re-exports the service functions so the route can import them all from
// one path: `@/lib/finance/daily-recap`.

export { buildAlerts } from './alerts';
export { buildCategoryStats } from './category-stats';
export { buildPatterns } from './patterns';
export { buildProjectionBasis, buildProjectionEnrichment } from './projections';
export type {
  ProjectionBasis,
  ProjectionEnrichment,
} from './projections';
export type { PatternsResult } from './patterns';
