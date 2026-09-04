'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface MorphingSproutProps {
  /** Square pixel size of the loader. Default: 48. */
  size?: number;
  className?: string;
}

/**
 * MorphingSprout — shape morphing loader.
 *
 * An SVG path morphs between three shapes (sprout → circle → rounded
 * square → sprout) in a 3s loop. Each shape gets ~1s of screen time.
 * When the path structures don't match, framer-motion falls back to a
 * crossfade between keyframes — the visual effect is still a clear
 * "morph" (one shape dissolves into another).
 *
 * All three shapes share a 6-cubic structure so the morphing can
 * interpolate numerically where possible (the sprout's stem and leaves
 * map cleanly onto the circle's quadrants and the square's sides).
 *
 * Accessibility:
 * - `role="status"` + `aria-label="Memuat..."` (Indonesian).
 * - When `prefers-reduced-motion` is set, the loader renders a static
 *   sprout icon (no morphing, no rotation).
 *
 * Performance: animating the `d` attribute triggers SVG path re-tessellation
 * each frame — heavier than transform-based animations. Keep this loader
 * for short-lived contexts (e.g. inline button spinners), not full-screen
 * loading screens on low-end mobile. `will-change: opacity` is set on the
 * wrapper to keep the crossfade smooth.
 *
 * Color: fill #22c55e (app primary green). SVG `fill` attributes don't
 * reliably resolve `hsl(var(--primary))` in all browsers; the hex is the
 * resolved light-mode value.
 */
export function MorphingSprout({ size = 48, className }: MorphingSproutProps) {
  const prefersReducedMotion = useReducedMotion();

  // All three shapes share M + 6× C + Z structure so framer-motion can
  // interpolate numerically. The shapes trace clockwise from the top.
  // - SPROUT: stem from bottom up + 2 leaves at top (6 cubics trace the
  //   outline: right leaf outer → stem right → soil → stem left → left
  //   leaf outer → left leaf inner → right leaf inner)
  // - CIRCLE: 6-segment cubic approximation of a circle (radius 45)
  // - SQUARE: rounded square (corner radius ~12), 6 cubics around the
  //   perimeter — top-right corner + right side, bottom-right corner +
  //   bottom, bottom-left corner + left side, top-left corner + top.
  //
  // FIX-TRANSITION-1: SQUARE_PATH previously had 8 cubics while SPROUT and
  // CIRCLE had 6. Mismatched segment counts cause framer-motion to fall
  // back from numerical path interpolation to a hard crossfade (snap between
  // shapes), defeating the smooth morph effect. Rewrote SQUARE_PATH with 6
  // cubics so all three paths interpolate numerically — true morph.
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

  // 6-curve rounded square. Each cubic handles one corner + half of a side
  // so the total segment count matches SPROUT_PATH and CIRCLE_PATH. Control
  // points on the sides are placed along the straight edge (e.g. C 88 50,
  // 88 50, 88 72) which produces a degenerate-but-valid cubic that the
  // interpolator treats as a straight line — visually identical to a real
  // straight segment, but structurally compatible with the other shapes.
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
      <motion.svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        animate={{ rotate: [0, 90, 180, 270, 360] }}
        transition={{
          duration: 6,
          ease: 'linear',
          repeat: Infinity,
        }}
        style={{ willChange: 'transform' }}
      >
        <motion.path
          fill="#22c55e"
          animate={{
            d: [SPROUT_PATH, CIRCLE_PATH, SQUARE_PATH, SPROUT_PATH],
          }}
          transition={{
            duration: 3,
            ease: 'easeInOut',
            repeat: Infinity,
            times: [0, 0.33, 0.66, 1],
          }}
        />
      </motion.svg>
      <span className="sr-only">Memuat...</span>
    </div>
  );
}
