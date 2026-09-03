'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface DotWaveProps {
  /** Size preset. Default: 'sm'. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  sm: { dot: 6, gap: 4, lift: 8 },
  md: { dot: 9, gap: 6, lift: 12 },
  lg: { dot: 14, gap: 8, lift: 18 },
} as const;

/**
 * DotWave — minimal 3-dot wave loader (universal fallback).
 *
 * Three green dots bounce in sequence: dot 1 lifts first, then dot 2,
 * then dot 3, then they all settle. The stagger creates a wave motion.
 * Total cycle: 1.2s with easeInOut timing.
 *
 * Use this as the universal fallback for any environment that can't run
 * heavier SVG / backdrop-filter animations (e.g. very old browsers,
 * reduced-data mode, or as a guaranteed-safe default).
 *
 * Accessibility:
 * - `role="status"` + `aria-label="Memuat..."` (Indonesian).
 * - When `prefers-reduced-motion` is set, the dots render statically with
 *   increasing opacity (no bouncing).
 *
 * Performance: transform-only animation (translateY) — GPU-composited,
 * no layout/paint. `will-change: transform` on each dot. This is the
 * cheapest loader in the kit.
 *
 * Color: #22c55e (app primary green). Consistent across light/dark themes.
 */
export function DotWave({ size = 'sm', className }: DotWaveProps) {
  const prefersReducedMotion = useReducedMotion();
  const dims = SIZE_MAP[size];

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: dims.gap,
    height: dims.dot + dims.lift,
  };

  const dotBase: React.CSSProperties = {
    width: dims.dot,
    height: dims.dot,
    borderRadius: '50%',
    background: '#22c55e',
    willChange: 'transform',
  };

  if (prefersReducedMotion) {
    // Static dots with increasing opacity — no bounce.
    return (
      <div
        role="status"
        aria-label="Memuat..."
        className={cn('inline-flex', className)}
        style={containerStyle}
      >
        {[0.35, 0.6, 0.35].map((opacity, i) => (
          <span
            key={i}
            style={{ ...dotBase, opacity, willChange: 'auto' }}
            aria-hidden="true"
          />
        ))}
        <span className="sr-only">Memuat...</span>
      </div>
    );
  }

  // Wave keyframes: dot lifts (y: 0 → -lift → 0) at staggered times.
  // Each dot's animation is offset by 0.15s so the wave travels left-to-right.
  return (
    <div
      role="status"
      aria-label="Memuat..."
      className={cn('inline-flex', className)}
      style={containerStyle}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          style={dotBase}
          animate={{ y: [0, -dims.lift, 0] }}
          transition={{
            duration: 1.2,
            ease: 'easeInOut',
            repeat: Infinity,
            delay: i * 0.15,
          }}
          aria-hidden="true"
        />
      ))}
      <span className="sr-only">Memuat...</span>
    </div>
  );
}
