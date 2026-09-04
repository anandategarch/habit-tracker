'use client';

// FIX-TIER2 / Fix 4: Converted from framer-motion `m.div` + useReducedMotion
// to pure CSS keyframes (.css-breathing-* in globals.css) + the local
// usePrefersReducedMotion hook. The framer-motion core runtime is no longer
// required for this loader.
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { cn } from '@/lib/utils';

export interface BreathingSeedProps {
  /** Square pixel size of the loader. Default: 64. */
  size?: number;
  className?: string;
}

/**
 * BreathingSeed — calm breathing pulse loader (Calm / Headspace inspired).
 *
 * A soft green radial-gradient circle scales 1.0 → 1.15 → 1.0 over 4
 * seconds (a slow, breath-like rhythm). Two concentric ripple circles
 * emanate outward (scale 1 → 2, opacity 0.4 → 0) staggered by half a
 * cycle, mimicking a calm exhalation. A small 🌱 icon sits in the center.
 *
 * Accessibility:
 * - `role="status"` + `aria-label="Memuat..."` (Indonesian).
 * - When `prefers-reduced-motion` is set, the ripples are removed and the
 *   center circle is rendered statically (no breathing scale).
 *
 * Performance: transforms only (scale) — GPU-composited, no layout/paint.
 * `will-change: transform` is applied to each animated layer via the
 * `.css-breathing-*` classes in globals.css.
 *
 * Color: radial gradient uses #22c55e → #16a34a → transparent for the
 * soft center glow. Emoji renders as text.
 */
export function BreathingSeed({ size = 64, className }: BreathingSeedProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const wrapperStyle: React.CSSProperties = {
    width: size,
    height: size,
  };

  if (prefersReducedMotion) {
    // Static circle + sprout — no breathing, no ripples.
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
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, #22c55e 0%, #16a34a 60%, transparent 100%)',
            opacity: 0.55,
          }}
          aria-hidden="true"
        />
        <span
          className="relative select-none"
          style={{ fontSize: size * 0.4, lineHeight: 1 }}
          aria-hidden="true"
        >
          🌱
        </span>
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
      {/* Ripple 1 */}
      <div
        className="absolute inset-0 rounded-full css-breathing-ripple"
        style={{
          border: '1.5px solid #22c55e',
          animationDelay: '0s',
        }}
        aria-hidden="true"
      />
      {/* Ripple 2 (offset by half cycle) */}
      <div
        className="absolute inset-0 rounded-full css-breathing-ripple"
        style={{
          border: '1.5px solid #22c55e',
          animationDelay: '2s',
        }}
        aria-hidden="true"
      />
      {/* Breathing core */}
      <div
        className="absolute inset-0 rounded-full css-breathing-core"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, #22c55e 0%, #16a34a 60%, transparent 100%)',
          opacity: 0.55,
        }}
        aria-hidden="true"
      />
      <span
        className="relative select-none css-breathing-sprout"
        style={{ fontSize: size * 0.4, lineHeight: 1 }}
        aria-hidden="true"
      >
        🌱
      </span>
      <span className="sr-only">Memuat...</span>
    </div>
  );
}
