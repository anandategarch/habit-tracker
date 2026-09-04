'use client';

// FIX-TIER2 / Fix 4: Converted from framer-motion `m.svg` / `m.path` +
// useReducedMotion to pure CSS keyframes (.css-morph-* in globals.css) +
// the local usePrefersReducedMotion hook.
//
// True SVG `d` morphing is impossible in pure CSS (no `interpolate-path`
// property). Instead, we stack all 3 paths (sprout, circle, square) and
// crossfade opacity via CSS keyframes — visually similar (shape "blinks"
// through the 3 forms in sequence on a 3s loop). The wrapper rotates
// slowly (6s linear) just like the framer-motion version.
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { cn } from '@/lib/utils';

export interface MorphingSproutProps {
  /** Square pixel size of the loader. Default: 48. */
  size?: number;
  className?: string;
}

/**
 * MorphingSprout — shape morphing loader.
 *
 * An SVG shape crossfades between three forms (sprout → circle → rounded
 * square → sprout) in a 3s loop. Each shape gets ~1s of screen time. The
 * wrapper rotates slowly (6s linear) for an extra layer of motion.
 *
 * NOTE: The original framer-motion version interpolated the SVG `d`
 * attribute for true numerical path morphing. CSS cannot animate `d`, so
 * this CSS-only version crossfades opacity between the 3 stacked paths —
 * visually similar (one shape dissolves into another) but not a true
 * numerical morph. The trade-off is the elimination of the framer-motion
 * core runtime from the bundle.
 *
 * Accessibility:
 * - `role="status"` + `aria-label="Memuat..."` (Indonesian).
 * - When `prefers-reduced-motion` is set, the loader renders a static
 *   sprout icon (no morphing, no rotation).
 *
 * Performance: animating `opacity` only — extremely cheap, GPU-composited.
 * `will-change: transform` on the rotating wrapper.
 *
 * Color: fill #22c55e (app primary green). SVG `fill` attributes don't
 * reliably resolve `hsl(var(--primary))` in all browsers; the hex is the
 * resolved light-mode value.
 */
export function MorphingSprout({ size = 48, className }: MorphingSproutProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  // All three shapes share M + 6× C + Z structure so the original
  // framer-motion version could interpolate numerically. We retain the
  // same paths here for visual continuity (the crossfade doesn't require
  // matching structure, but keeping the paths identical to the old
  // version means the loader's silhouette is unchanged).
  const SPROUT_PATH =
    'M 50 12 ' +
    'C 65 18, 78 30, 70 42 ' + // right leaf outer
    'C 62 50, 55 48, 50 46 ' + // right leaf inner
    'C 50 70, 52 85, 50 95 ' + // stem down (right side)
    'C 48 85, 50 70, 50 46 ' + // stem up (left side)
    'C 45 48, 38 50, 30 42 ' + // left leaf inner
    'C 22 30, 35 18, 50 12 ' + // left leaf outer
    'Z';

  const CIRCLE_PATH =
    'M 50 5 ' +
    'C 65 5, 78 12, 86 22 ' +
    'C 95 35, 95 65, 86 78 ' +
    'C 78 88, 65 95, 50 95 ' +
    'C 35 95, 22 88, 14 78 ' +
    'C 5 65, 5 35, 14 22 ' +
    'C 22 12, 35 5, 50 5 ' +
    'Z';

  const SQUARE_PATH =
    'M 50 12 ' +
    'C 70 12, 88 12, 88 30 ' + // top-right corner + half of top edge
    'C 88 50, 88 50, 88 70 ' + // right side (straight via degenerate cubic)
    'C 88 88, 70 88, 50 88 ' + // bottom-right corner + half of bottom edge
    'C 30 88, 12 88, 12 70 ' + // bottom-left corner + half of bottom edge
    'C 12 50, 12 50, 12 30 ' + // left side (straight via degenerate cubic)
    'C 12 12, 30 12, 50 12 ' + // top-left corner + half of top edge
    'Z';

  if (prefersReducedMotion) {
    // Static sprout icon (no morphing).
    return (
      <div
        role="status"
        aria-label="Memuat..."
        className={cn('inline-flex items-center justify-center', className)}
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          width={size}
          height={size}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d={SPROUT_PATH} fill="#22c55e" />
        </svg>
        <span className="sr-only">Memuat...</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Memuat..."
      className={cn('inline-flex items-center justify-center', className)}
      style={{ width: size, height: size, willChange: 'opacity' }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="css-morph-rotate"
      >
        {/* 3 stacked paths — only one is visible at a time (opacity 1)
            via the css-morph-path-* keyframes (3s cycle, 1s each). */}
        <path d={SPROUT_PATH} fill="#22c55e" className="css-morph-path-1" />
        <path d={CIRCLE_PATH} fill="#22c55e" className="css-morph-path-2" />
        <path d={SQUARE_PATH} fill="#22c55e" className="css-morph-path-3" />
      </svg>
      <span className="sr-only">Memuat...</span>
    </div>
  );
}
