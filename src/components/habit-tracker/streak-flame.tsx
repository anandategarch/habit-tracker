'use client';

import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * StreakFlame — dynamic Flame icon that scales intensity with streak count.
 *
 * Tier mapping (per Phase 5 rules):
 *   0           → empty   : gray, static
 *   1-3 (spark) → amber-400, slow pulse
 *   4-6 (flame) → orange-500, normal pulse
 *   7-29 (blaze)→ red-500, fast pulse + glow
 *   30-99 (fire)→ red-600, fast pulse + ember particles
 *   100+ (epic) → red-700, rainbow hue-rotate shimmer
 *
 * All flame colors use Tailwind orange/red classes — these are the brand
 * colors for fire per Phase 5 rules (not subject to design-token swap).
 * Animations respect prefers-reduced-motion (handled in globals.css).
 */

type Tier = 'empty' | 'spark' | 'flame' | 'blaze' | 'fire' | 'epic';

interface StreakFlameProps {
  streak: number;
  size?: 'sm' | 'md' | 'lg';
  /** Optional className passthrough for layout/spacing. */
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<StreakFlameProps['size']>, string> = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-6 w-6',
};

function getTier(streak: number): Tier {
  if (streak >= 100) return 'epic';
  if (streak >= 30) return 'fire';
  if (streak >= 7) return 'blaze';
  if (streak >= 4) return 'flame';
  if (streak >= 1) return 'spark';
  return 'empty';
}

const TIER_COLOR: Record<Tier, string> = {
  empty: 'text-muted-foreground/40',
  spark: 'text-amber-400',
  flame: 'text-orange-500',
  blaze: 'text-red-500',
  fire: 'text-red-600',
  epic: 'text-red-700',
};

const TIER_ANIMATION: Record<Tier, string> = {
  empty: '',
  spark: 'anim-flame-pulse-slow',
  flame: 'anim-flame-pulse',
  blaze: 'anim-flame-pulse-blaze',
  fire: 'anim-flame-pulse-fast',
  epic: 'anim-flame-epic',
};

export function StreakFlame({
  streak,
  size = 'md',
  className,
}: StreakFlameProps) {
  const tier = getTier(streak);
  const sizeClass = SIZE_CLASSES[size];

  // PERF-FIX: Only animate flames for habits WITH streak > 0.
  // Previously, all 19 flame icons ran pulse animations concurrently,
  // causing GPU lag on mobile. Now empty (streak=0) flames are static
  // gray — no animation. Only active streaks get the pulse effect.
  // This reduces concurrent infinite animations from 19 → ~2-3 (typical).
  const shouldAnimate = streak > 0;

  // The embers wrapper is only used at fire tier — pure CSS pseudo-elements
  // generate the rising ember particles (see globals.css `.anim-flame-embers`).
  const wrapperClass =
    tier === 'fire' ? 'anim-flame-embers' : undefined;

  return (
    <span
      className={cn('inline-flex items-center', wrapperClass, className)}
      aria-label={`${streak} ${streak === 1 ? 'day' : 'days'} streak`}
      role="img"
    >
      <Flame
        className={cn(
          sizeClass,
          TIER_COLOR[tier],
          shouldAnimate && TIER_ANIMATION[tier],
        )}
      />
    </span>
  );
}
