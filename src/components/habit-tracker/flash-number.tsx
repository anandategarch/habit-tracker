'use client';

import { useState } from 'react';
import { useCountUp } from '@/hooks/use-count-up';
import { formatRupiah } from '@/components/habit-tracker/finance-types';

/**
 * FlashNumber — animates a number from 0→target (count-up) AND flashes
 * green when the value changes (increases or decreases).
 *
 * Combines premium count-up with gamification flash feedback.
 *
 * Implementation: useState tracks the previous value (null on first render).
 * shouldFlash is computed during render based on prev !== null && prev !== value.
 * A render-phase update to prevValue is safe here because it's derived from
 * the `value` prop (same value → same state, no loop).
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
  // prevValue starts as null. On first render: shouldFlash = false (prev is null).
  // On subsequent renders where value changed: shouldFlash = true.
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const shouldFlash = flash && prevValue !== null && prevValue !== value;

  // Schedule prevValue update for next render. This is the React-recommended
  // pattern for "adjusting state when a prop changes" — see:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (prevValue !== value) {
    setPrevValue(value);
  }

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
  const [prevAmount, setPrevAmount] = useState<number | null>(null);
  const shouldFlash = flash && prevAmount !== null && prevAmount !== amount;

  if (prevAmount !== amount) {
    setPrevAmount(amount);
  }

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
