/**
 * Loaders — premium loading animation kit for the habit-tracker app.
 *
 * Each loader respects `prefers-reduced-motion` and provides a static
 * fallback. All loaders use `role="status"` + `aria-label` for screen
 * readers. Pick a loader by aesthetic + context:
 *
 * - `SproutGrow`    — signature SVG path drawing (full-screen splash)
 * - `AuroraRing`    — circular progress ring (inline content loaders)
 * - `BreathingSeed` — calm breathing pulse (overlay / dialog backdrop)
 *
 * Usage:
 *   import { SproutGrow } from '@/components/ui/loaders';
 */

export { SproutGrow } from './sprout-grow';
export type { SproutGrowProps } from './sprout-grow';

export { AuroraRing } from './aurora-ring';
export type { AuroraRingProps } from './aurora-ring';

export { BreathingSeed } from './breathing-seed';
export type { BreathingSeedProps } from './breathing-seed';
