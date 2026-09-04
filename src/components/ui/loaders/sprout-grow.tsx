'use client';

// FIX-TIER2 / Fix 4: Converted from framer-motion `m.path` + useReducedMotion
// to pure CSS keyframes (.css-sprout-* in globals.css) + the local
// usePrefersReducedMotion hook. Uses SVG `pathLength="1"` attribute to
// normalize stroke length, then animates `stroke-dashoffset` 1 → 0 → 1
// to draw + erase each path sequentially. Same visual effect as the
// framer-motion `pathLength` animation.
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { cn } from '@/lib/utils';

export interface SproutGrowProps {
  /** Square pixel size of the loader. Default: 120. */
  size?: number;
  className?: string;
}

/**
 * SproutGrow — Signature SVG path-drawing loader.
 *
 * A sprout 🌱 is drawn stroke-by-stroke from soil upward: first the stem,
 * then the left leaf, then the right leaf. After the drawing completes the
 * paths fade out and the loop repeats — evoking the daily-habit metaphor
 * of growing something new each day.
 *
 * Animation: 3 `<path>` elements animate `stroke-dashoffset` 1 → 0 → 1
 * sequentially (stem → left leaf → right leaf), total loop ~2.5s with
 * easeInOut timing. The SVG `pathLength="1"` attribute normalizes the
 * path length so the same dasharray (1) works for any path shape.
 *
 * Accessibility:
 * - `role="status"` + `aria-label="Memuat Rutica"` (Indonesian, matches app).
 * - When `prefers-reduced-motion` is set, the loader shows a fully-drawn
 *   static sprout with a gentle opacity pulse (no path drawing, no loop).
 *
 * Performance: path-drawing is GPU-composited via SVG transforms.
 * `will-change: opacity` is only applied to the wrapper (paths use stroke
 * which doesn't trigger layout).
 *
 * Color: stroke uses `#22c55e` (app primary green) directly. SVG `stroke`
 * attributes don't reliably resolve `hsl(var(--primary))` across browsers
 * when applied via inline attributes; the hex is the resolved value of
 * `--primary` in light mode and is intentionally distinct in dark mode
 * for consistent brand visibility.
 */
export function SproutGrow({ size = 120, className }: SproutGrowProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const wrapperStyle: React.CSSProperties = {
    width: size,
    height: size,
    willChange: 'opacity',
  };

  if (prefersReducedMotion) {
    // Static fallback: fully-drawn sprout with subtle opacity pulse.
    return (
      <div
        role="status"
        aria-label="Memuat Rutina"
        className={cn('inline-flex items-center justify-center', className)}
        style={wrapperStyle}
      >
        <svg
          viewBox="0 0 100 100"
          width={size}
          height={size}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="css-sprout-static"
        >
          {/* Soil mound (decorative) */}
          <path
            d="M 30 92 Q 50 86 70 92"
            stroke="#22c55e"
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.4}
          />
          {/* Stem */}
          <path
            d="M 50 90 Q 48 70 50 55"
            stroke="#22c55e"
            strokeWidth={3.5}
            strokeLinecap="round"
          />
          {/* Left leaf */}
          <path
            d="M 50 62 Q 32 55 18 42 Q 36 50 50 56"
            stroke="#22c55e"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Right leaf */}
          <path
            d="M 50 56 Q 68 48 82 34 Q 64 48 50 50"
            stroke="#22c55e"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="sr-only">Memuat Rutina</span>
      </div>
    );
  }

  // Sequential draw: stem (0→0.4s) → left leaf (0.4→0.85s) → right leaf (0.85→1.3s)
  // Then hold (1.3→2.2s) + fade out (2.2→2.5s) → loop.
  // Each path uses `pathLength="1"` so the CSS keyframes (which animate
  // stroke-dashoffset between 0 and 1) work identically regardless of the
  // actual SVG path length.
  return (
    <div
      role="status"
      aria-label="Memuat Rutina"
      className={cn('inline-flex items-center justify-center', className)}
      style={wrapperStyle}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="css-sprout-svg"
      >
        {/* Soil mound (decorative, drawn instantly) */}
        <path
          d="M 30 92 Q 50 86 70 92"
          stroke="#22c55e"
          strokeWidth={2.5}
          strokeLinecap="round"
          opacity={0.4}
        />
        {/* Stem */}
        <path
          d="M 50 90 Q 48 70 50 55"
          stroke="#22c55e"
          strokeWidth={3.5}
          strokeLinecap="round"
          pathLength={1}
          className="css-sprout-stem"
        />
        {/* Left leaf */}
        <path
          d="M 50 62 Q 32 55 18 42 Q 36 50 50 56"
          stroke="#22c55e"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="css-sprout-leaf-l"
        />
        {/* Right leaf */}
        <path
          d="M 50 56 Q 68 48 82 34 Q 64 48 50 50"
          stroke="#22c55e"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="css-sprout-leaf-r"
        />
      </svg>
      <span className="sr-only">Memuat Rutina</span>
    </div>
  );
}
