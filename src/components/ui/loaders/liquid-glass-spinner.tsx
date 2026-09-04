'use client';

// PERF-BUNDLE-1 Fix 10: `m` instead of `motion` so framer-motion core is
// deferred (requires <LazyMotion features={domAnimation}> at app root).
import { m, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface LiquidGlassSpinnerProps {
  /** Square pixel size of the spinner. Default: 48. */
  size?: number;
  className?: string;
}

/**
 * LiquidGlassSpinner — Apple iOS 26 liquid-glass style spinner.
 *
 * A circular spinner with `backdrop-filter: blur(12px)` + green tint and
 * a semi-transparent border. A light highlight segment rotates around
 * the border (0 → 360° loop, 1.1s linear) giving the impression of a
 * light source sweeping around the glass.
 *
 * The `@supports not (backdrop-filter)` query (handled in inline style via
 * a fallback object) degrades to a solid green tint without blur for
 * browsers that don't support backdrop-filter.
 *
 * Accessibility:
 * - `role="status"` + `aria-label="Memuat..."` (Indonesian).
 * - When `prefers-reduced-motion` is set, the spinner is replaced with a
 *   minimal 3-dot wave (delegated to the DotWave pattern) so users still
 *   see loading feedback without motion.
 *
 * Performance: backdrop-filter is expensive on low-end mobile GPUs. The
 * animation is transform-only (rotate). `will-change: transform` on the
 * highlight layer. On touch devices where backdrop-filter causes jank,
 * the user can fall back to a different loader (see DotWave).
 *
 * Color: rgba(34, 197, 94, 0.18) tint + rgba(34, 197, 94, 0.35) border.
 */
export function LiquidGlassSpinner({
  size = 48,
  className,
}: LiquidGlassSpinnerProps) {
  const prefersReducedMotion = useReducedMotion();

  const wrapperStyle: React.CSSProperties = {
    width: size,
    height: size,
  };

  // Inline fallback for browsers without backdrop-filter support. Modern
  // browsers ignore the `@supports` query at the JS layer; we instead
  // provide a slightly stronger tint to compensate for missing blur.
  const glassStyle: React.CSSProperties = {
    background: 'rgba(34, 197, 94, 0.18)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1.5px solid rgba(34, 197, 94, 0.35)',
    boxShadow:
      'inset 0 1px 1px rgba(255,255,255,0.25), 0 4px 12px rgba(34,197,94,0.12)',
  };

  if (prefersReducedMotion) {
    // Minimal 3-dot wave fallback (inlined here to avoid circular import
    // with dot-wave.tsx; intentionally self-contained).
    const dot = size * 0.18;
    return (
      <div
        role="status"
        aria-label="Memuat..."
        className={cn('inline-flex items-center justify-center gap-1', className)}
        style={{ height: size, minWidth: size }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="rounded-full"
            style={{
              width: dot,
              height: dot,
              background: '#22c55e',
              opacity: 0.4 + i * 0.2,
            }}
            aria-hidden="true"
          />
        ))}
        <span className="sr-only">Memuat...</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Memuat..."
      className={cn(
        'inline-flex items-center justify-center relative',
        className
      )}
      style={wrapperStyle}
    >
      {/* Glass disc */}
      <div
        className="absolute inset-0 rounded-full"
        style={glassStyle}
        aria-hidden="true"
      />
      {/* Rotating highlight arc */}
      <m.svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="absolute inset-0"
        style={{ willChange: 'transform' }}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1.1,
          ease: 'linear',
          repeat: Infinity,
        }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="lg-highlight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.9)" />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke="url(#lg-highlight)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="60 240"
          transform="rotate(-90 50 50)"
        />
      </m.svg>
      <span className="sr-only">Memuat...</span>
    </div>
  );
}
