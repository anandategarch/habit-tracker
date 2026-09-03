/**
 * Loaders — premium loading animation kit for the habit-tracker app.
 *
 * Each loader respects `prefers-reduced-motion` and provides a static
 * fallback. All loaders use `role="status"` + `aria-label` for screen
 * readers. Pick a loader by aesthetic + context:
 *
 * - `SproutGrow`         — signature SVG path drawing (full-screen splash)
 * - `AuroraRing`         — circular progress ring (inline content loaders)
 * - `BreathingSeed`      — calm breathing pulse (overlay / dialog backdrop)
 * - `LiquidGlassSpinner` — iOS 26 glass spinner (inline buttons, headers)
 * - `FallingLeaves`      — particle overlay (full-screen delight)
 * - `MorphingSprout`     — shape morph (short-lived inline contexts)
 * - `DotWave`            — minimal 3-dot wave (universal fallback)
 *
 * Usage:
 *   import { SproutGrow, DotWave } from '@/components/ui/loaders';
 */

export { SproutGrow } from './sprout-grow';
export type { SproutGrowProps } from './sprout-grow';

export { AuroraRing } from './aurora-ring';
export type { AuroraRingProps } from './aurora-ring';

export { BreathingSeed } from './breathing-seed';
export type { BreathingSeedProps } from './breathing-seed';

export { LiquidGlassSpinner } from './liquid-glass-spinner';
export type { LiquidGlassSpinnerProps } from './liquid-glass-spinner';

export { FallingLeaves } from './falling-leaves';
export type { FallingLeavesProps } from './falling-leaves';

export { MorphingSprout } from './morphing-sprout';
export type { MorphingSproutProps } from './morphing-sprout';

export { DotWave } from './dot-wave';
export type { DotWaveProps } from './dot-wave';
