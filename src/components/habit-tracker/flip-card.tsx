'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * FlipCard — 3D card-flip wrapper. Tap the card to rotate it 180° around the
 * Y axis, revealing a "back" face. The front face is kept in normal flow so
 * it defines the card height; the back is absolutely positioned to overlay
 * exactly. Both faces use `backface-visibility: hidden` so only one is
 * visible at a time.
 *
 * Behaviour:
 * - Click anywhere on the card body (or press Enter/Space) to flip.
 * - Checkbox / buttons inside should call `e.stopPropagation()` to keep
 *   their own click behaviour (e.g. toggling a habit) without flipping.
 * - Respects `prefers-reduced-motion: reduce` — no flip, front always shown.
 *
 * The outer div carries `perspective-1000` so the child rotateY produces a
 * 3D depth effect. The inner rotating div carries `preserve-3d` so the
 * absolutely-positioned back face renders in the same 3D space.
 *
 * @example
 * <FlipCard
 *   className="anim-stagger"
 *   front={<Card>front content</Card>}
 *   back={<Card>back content</Card>}
 * />
 */
interface FlipCardProps {
  front: ReactNode;
  back: ReactNode;
  className?: string;
  /** Extra className applied to the inner rotating div (useful for hover). */
  innerClassName?: string;
  /** Inline style applied to the outer wrapper (e.g. animationDelay). */
  style?: React.CSSProperties;
}

export function FlipCard({ front, back, className, innerClassName, style }: FlipCardProps) {
  const [flipped, setFlipped] = useState(false);

  // Reduced-motion: skip the flip entirely. Front stays visible.
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const toggle = () => {
    if (reducedMotion) return;
    setFlipped((f) => !f);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (reducedMotion) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setFlipped((f) => !f);
    }
  };

  return (
    <div className={cn('perspective-1000', className)} style={style}>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        className={cn(
          'relative preserve-3d cursor-pointer h-full',
          innerClassName,
        )}
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: flipped && !reducedMotion ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
        onClick={toggle}
        onKeyDown={handleKeyDown}
      >
        {/* Front — in normal flow so it defines the card height. */}
        <div
          className="backface-hidden h-full"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {front}
        </div>
        {/* Back — absolute overlay, pre-rotated 180° so it shows on flip. */}
        <div
          className="absolute inset-0 backface-hidden"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {back}
        </div>
      </div>
    </div>
  );
}
