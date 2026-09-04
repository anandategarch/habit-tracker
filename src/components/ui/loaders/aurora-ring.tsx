'use client';

// FIX-TIER2 / Fix 4: Converted from framer-motion `m.circle` / `m.span` +
// useReducedMotion to pure CSS keyframes (.css-aurora-* in globals.css) +
// the local usePrefersReducedMotion hook. The framer-motion core runtime
// is no longer required for this loader.
//
// The `pathLength` animation is replicated via SVG `pathLength="1"` +
// CSS `stroke-dashoffset` animation. The combined `pathLength` + `rotate`
// effect on a single SVG circle is achieved by wrapping the circle in a
// `<g>` element that rotates, while the circle itself animates its
// dashoffset — keeping the two animations in independent CSS layers
// (matching framer-motion's independent transition timings: 1.6s for the
// arc length, 2.4s for the rotation).
import { useId } from 'react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { cn } from '@/lib/utils';

export interface AuroraRingProps {
  /** Size preset. Default: 'md'. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  sm: 40,
  md: 64,
  lg: 120,
} as const;

const STROKE_WIDTH = {
  sm: 3,
  md: 4,
  lg: 6,
} as const;

/**
 * AuroraRing — circular progress ring with aurora gradient + breathing sprout.
 *
 * An SVG circle with a 3-stop aurora gradient stroke (emerald → teal → soft
 * green) animates its visible arc length 0.25 → 0.85 → 0.25 (via
 * `stroke-dashoffset`) while slowly rotating 360°, creating a flowing
 * aurora-light effect around the ring. Inside, a 🌱 sprout icon breathes
 * with a subtle scale animation.
 *
 * Accessibility:
 * - `role="status"` + `aria-label="Memuat..."` (Indonesian, matches app).
 * - When `prefers-reduced-motion` is set, the ring renders static at 75%
 *   completion and the sprout icon stays still.
 *
 * Performance: rotation uses CSS `transform` (GPU-composited). The SVG
 * gradient is defined once and reused. `will-change: transform` is applied
 * to the rotating element only.
 *
 * Color: gradient stops use #10b981 (emerald), #14b8a6 (teal), #4ade80
 * (soft green) for the aurora flow. The sprout emoji renders as text.
 */
export function AuroraRing({ size = 'md', className }: AuroraRingProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  // Unique gradient ID per instance — without this, multiple AuroraRing
  // instances on the same page (e.g. LoadingState in multiple lazy tabs
  // during transition) would emit duplicate `<linearGradient id>` elements,
  // which is invalid HTML and makes every `url(#…)` reference resolve to the
  // first definition (visually identical here, but fragile + breaks if the
  // first instance unmounts).
  const reactId = useId();
  const gradientId = `aurora-ring-grad-${reactId.replace(/:/g, '')}`;
  const px = SIZE_MAP[size];
  const stroke = STROKE_WIDTH[size];
  const center = 50;
  const radius = 50 - stroke; // leave room for stroke
  const circumference = 2 * Math.PI * radius;
  // 75% arc visible in reduced-motion mode (25% gap)
  const staticDash = circumference * 0.75;

  return (
    <div
      role="status"
      aria-label="Memuat..."
      className={cn(
        'inline-flex items-center justify-center relative',
        className
      )}
      style={{ width: px, height: px }}
    >
      <svg
        viewBox="0 0 100 100"
        width={px}
        height={px}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
        </defs>
        {/* Track (faint background ring) */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
          opacity={0.35}
          fill="none"
        />
        {prefersReducedMotion ? (
          // Static 75% arc
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke={`url(#${gradientId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${staticDash} ${circumference}`}
            transform="rotate(-90 50 50)"
          />
        ) : (
          // Rotating wrapper <g> — independent 2.4s linear rotation.
          <g
            className="css-aurora-rotate"
            style={{ transformOrigin: '50px 50px' }}
          >
            {/* Animated arc — independent 1.6s ease-in-out dashoffset cycle.
                pathLength="1" normalizes so dasharray "1" = full circumference. */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              stroke={`url(#${gradientId})`}
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="none"
              pathLength={1}
              className="css-aurora-arc"
              transform="rotate(-90 50 50)"
            />
          </g>
        )}
      </svg>
      {/* Center sprout icon */}
      <span
        className={cn(
          'absolute select-none',
          !prefersReducedMotion && 'css-aurora-sprout'
        )}
        style={{
          fontSize: px * 0.32,
          lineHeight: 1,
        }}
        aria-hidden="true"
      >
        🌱
      </span>
      <span className="sr-only">Memuat...</span>
    </div>
  );
}
