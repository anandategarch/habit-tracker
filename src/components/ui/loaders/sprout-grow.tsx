'use client';

// PERF-BUNDLE-1 Fix 10: `m` instead of `motion` so framer-motion core is
// deferred (requires <LazyMotion features={domAnimation}> at app root).
import { m, useReducedMotion } from 'framer-motion';
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
 * Animation: 3 `m.path` elements animate `pathLength` 0→1 sequentially
 * (stem → left leaf → right leaf), total loop ~2.5s with easeInOut timing.
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
  const prefersReducedMotion = useReducedMotion();

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
        <m.svg
          viewBox="0 0 100 100"
          width={size}
          height={size}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
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
        </m.svg>
        <span className="sr-only">Memuat Rutina</span>
      </div>
    );
  }

  // Sequential draw: stem (0→0.4s) → left leaf (0.4→0.85s) → right leaf (0.85→1.3s)
  // Then hold (1.3→2.2s) + fade out (2.2→2.5s) → loop.
  return (
    <div
      role="status"
      aria-label="Memuat Rutina"
      className={cn('inline-flex items-center justify-center', className)}
      style={wrapperStyle}
    >
      <m.svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        animate={{ opacity: [1, 1, 1, 0.25, 1] }}
        transition={{
          duration: 2.5,
          ease: 'easeInOut',
          repeat: Infinity,
          times: [0, 0.55, 0.85, 0.95, 1],
        }}
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
        <m.path
          d="M 50 90 Q 48 70 50 55"
          stroke="#22c55e"
          strokeWidth={3.5}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: [0, 1, 1, 1, 0] }}
          transition={{
            duration: 2.5,
            ease: 'easeInOut',
            repeat: Infinity,
            times: [0, 0.16, 0.85, 0.95, 1],
          }}
        />
        {/* Left leaf */}
        <m.path
          d="M 50 62 Q 32 55 18 42 Q 36 50 50 56"
          stroke="#22c55e"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: [0, 0, 1, 1, 0] }}
          transition={{
            duration: 2.5,
            ease: 'easeInOut',
            repeat: Infinity,
            times: [0, 0.16, 0.34, 0.95, 1],
          }}
        />
        {/* Right leaf */}
        <m.path
          d="M 50 56 Q 68 48 82 34 Q 64 48 50 50"
          stroke="#22c55e"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: [0, 0, 1, 1, 0] }}
          transition={{
            duration: 2.5,
            ease: 'easeInOut',
            repeat: Infinity,
            times: [0, 0.34, 0.52, 0.95, 1],
          }}
        />
      </m.svg>
      <span className="sr-only">Memuat Rutina</span>
    </div>
  );
}
