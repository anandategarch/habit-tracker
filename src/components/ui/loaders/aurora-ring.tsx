'use client';

// PERF-BUNDLE-1 Fix 10: `m` instead of `motion` so framer-motion core is
// deferred (requires <LazyMotion features={domAnimation}> at app root).
import { m, useReducedMotion } from 'framer-motion';
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
 * green) animates `pathLength` 0→1 while slowly rotating 360°, creating a
 * flowing aurora-light effect around the ring. Inside, a 🌱 sprout icon
 * breathes with a subtle scale animation.
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
  const prefersReducedMotion = useReducedMotion();
  const px = SIZE_MAP[size];
  const stroke = STROKE_WIDTH[size];
  const center = 50;
  const radius = 50 - stroke; // leave room for stroke
  const circumference = 2 * Math.PI * radius;
  // 75% arc visible in reduced-motion mode (25% gap)
  const staticDash = circumference * 0.75;

  const gradientId = 'aurora-ring-grad';

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
          <m.circle
            cx={center}
            cy={center}
            r={radius}
            stroke={`url(#${gradientId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0.25, rotate: 0 }}
            animate={{
              pathLength: [0.25, 0.85, 0.25],
              rotate: 360,
            }}
            transition={{
              pathLength: {
                duration: 1.6,
                ease: 'easeInOut',
                repeat: Infinity,
              },
              rotate: {
                duration: 2.4,
                ease: 'linear',
                repeat: Infinity,
              },
            }}
            style={{
              transformOrigin: '50px 50px',
              willChange: 'transform',
            }}
          />
        )}
      </svg>
      {/* Center sprout icon */}
      <m.span
        className="absolute select-none"
        style={{
          fontSize: px * 0.32,
          lineHeight: 1,
        }}
        animate={
          prefersReducedMotion
            ? undefined
            : { scale: [1, 1.12, 1] }
        }
        transition={{
          duration: 2.4,
          ease: 'easeInOut',
          repeat: Infinity,
        }}
        aria-hidden="true"
      >
        🌱
      </m.span>
      <span className="sr-only">Memuat...</span>
    </div>
  );
}
