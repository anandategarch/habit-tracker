'use client';

import { useCountUp } from '@/hooks/use-count-up';
import { formatRupiah } from '@/components/habit-tracker/finance-types';

/**
 * FlashNumber — animates a number from 0→target (count-up) AND flashes
 * green when the value changes (increases or decreases).
 *
 * Combines premium count-up with gamification flash feedback.
 *
 * Implementation: the `key` prop changes whenever the value changes,
 * which remounts the <span> and retriggers the CSS animation. This
 * avoids all ref/state-in-effect lint violations — no tracking of
 * previous value needed.
 *
 * @param value   Target number.
 * @param duration Count-up duration in ms (default 900).
 * @param suffix  Optional suffix (e.g. '%', ' XP').
 * @param flash   Enable flash on change (default true).
 */
export function FlashNumber({
  value,
  duration = 900,
  suffix = '',
  flash = true,
}: {
  value: number;
  duration?: number;
  suffix?: string;
  flash?: boolean;
}) {
  const display = useCountUp(value, duration, 0);
  // Key changes on every value change → remount → CSS animation retriggers.
  // Only apply flash class when value > 0 (initial mount from 0 doesn't flash).
  const shouldFlash = flash && value > 0;

  return (
    <span
      key={shouldFlash ? `v${value}` : 'init'}
      className={shouldFlash ? 'anim-flash-green' : ''}
      style={{ display: 'inline-block' }}
    >
      {display}{suffix}
    </span>
  );
}

/**
 * FlashRupiah — same as FlashNumber but formats as Rupiah.
 * Flashes green when the amount changes.
 */
export function FlashRupiah({
  amount,
  duration = 900,
  flash = true,
}: {
  amount: number;
  duration?: number;
  flash?: boolean;
}) {
  const display = useCountUp(amount, duration, 0);
  const shouldFlash = flash && amount > 0;

  return (
    <span
      key={shouldFlash ? `a${amount}` : 'init'}
      className={shouldFlash ? 'anim-flash-green' : ''}
      style={{ display: 'inline-block' }}
    >
      {formatRupiah(display)}
    </span>
  );
}
