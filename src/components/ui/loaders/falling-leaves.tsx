'use client';

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface FallingLeavesProps {
  /** Number of leaves to render. Default: 5. */
  leafCount?: number;
  className?: string;
}

/**
 * FallingLeaves — particle overlay of green leaves drifting downward.
 *
 * Renders a fixed full-viewport overlay with N leaves (default 5). Each
 * leaf: random horizontal start position, falls from y=-50 to viewport+50,
 * rotates 0→360° during the fall, and sways horizontally in a sine pattern
 * (via two nested motion divs: outer = fall+rotate, inner = sway).
 *
 * Accessibility:
 * - `role="status"` + `aria-label="Memuat..."` (Indonesian).
 * - When `prefers-reduced-motion` is set, the overlay renders a small
 *   static row of leaves at the top-center (no falling, no rotation).
 *
 * Performance: each leaf is `position: absolute` and uses transform-only
 * animations (y, rotate, x) so the browser keeps them on the compositor
 * thread. `will-change: transform` is set on every animated leaf layer.
 * Recommended count: 5–7 (more than ~10 may cause jank on low-end mobile).
 *
 * Color: leaves use #22c55e with opacity 0.6–0.9 (randomized per-leaf).
 * The leaf SVG path is a simple teardrop-leaf shape rotated to look like
 * a falling leaf.
 */
export function FallingLeaves({
  leafCount = 5,
  className,
}: FallingLeavesProps) {
  const prefersReducedMotion = useReducedMotion();

  // Pre-compute leaf configs (stable across re-renders). useMemo avoids
  // regenerating random values on every parent render which would cause
  // leaves to "jump" to new positions.
  const leaves = useMemo(
    () =>
      Array.from({ length: leafCount }).map((_, i) => ({
        id: i,
        leftPct: 8 + Math.random() * 84, // 8%–92% horizontal
        size: 18 + Math.random() * 14, // 18–32px
        duration: 6 + Math.random() * 5, // 6–11s fall
        swayAmount: 18 + Math.random() * 24, // 18–42px horizontal sway
        rotateDir: Math.random() > 0.5 ? 1 : -1,
        opacity: 0.6 + Math.random() * 0.3, // 0.6–0.9
        delay: -Math.random() * 8, // negative → start mid-animation
        hue: Math.random() > 0.5 ? '#22c55e' : '#16a34a',
      })),
    [leafCount]
  );

  if (prefersReducedMotion) {
    // Static row of leaves near the top of the viewport.
    return (
      <div
        role="status"
        aria-label="Memuat..."
        className={cn(
          'pointer-events-none fixed inset-x-0 top-4 flex justify-center gap-3',
          className
        )}
      >
        {leaves.slice(0, 3).map((leaf) => (
          <LeafIcon
            key={leaf.id}
            size={leaf.size}
            color={leaf.hue}
            opacity={leaf.opacity}
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
        'pointer-events-none fixed inset-0 overflow-hidden',
        className
      )}
    >
      {leaves.map((leaf) => (
        <motion.div
          key={leaf.id}
          className="absolute"
          style={{
            left: `${leaf.leftPct}%`,
            top: 0,
            willChange: 'transform',
          }}
          initial={{ y: -50, rotate: 0 }}
          animate={{ y: ['0vh', '110vh'], rotate: 360 * leaf.rotateDir }}
          transition={{
            duration: leaf.duration,
            ease: 'linear',
            repeat: Infinity,
            delay: leaf.delay,
          }}
        >
          {/* Inner sway: nested so x-sway doesn't cancel with the fall's
              rotate transform (different transform contexts). */}
          <motion.div
            style={{ willChange: 'transform' }}
            animate={{ x: [0, leaf.swayAmount, 0, -leaf.swayAmount, 0] }}
            transition={{
              duration: leaf.duration / 2,
              ease: 'easeInOut',
              repeat: Infinity,
              delay: leaf.delay,
            }}
          >
            <LeafIcon
              size={leaf.size}
              color={leaf.hue}
              opacity={leaf.opacity}
            />
          </motion.div>
        </motion.div>
      ))}
      <span className="sr-only">Memuat...</span>
    </div>
  );
}

/** LeafIcon — simple SVG teardrop-leaf shape with a center vein. */
function LeafIcon({
  size,
  color,
  opacity,
}: {
  size: number;
  color: string;
  opacity: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M16 2 C 6 6, 4 18, 16 30 C 28 18, 26 6, 16 2 Z"
        fill={color}
        opacity={opacity}
      />
      <path
        d="M16 4 L16 28"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="0.75"
        opacity={opacity}
      />
    </svg>
  );
}
