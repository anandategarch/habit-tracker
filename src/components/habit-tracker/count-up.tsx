'use client';

import { useCountUp } from '@/hooks/use-count-up';
import { formatRupiah } from '@/components/habit-tracker/finance-types';

/**
 * CountUpRupiah — animates a Rupiah amount from 0 to target.
 * Uses formatRupiah for display so it stays consistent with the rest of the app.
 * Uses easeOutBack (bounce) for a satisfying overshoot on money amounts.
 *
 * @param amount  Target amount in whole rupiah (Int).
 * @param duration Animation duration in ms (default 900).
 * @param bounce  If true (default), use overshoot easing. Set false for subtle animation.
 */
export function CountUpRupiah({
  amount,
  duration = 900,
  bounce = true,
}: {
  amount: number;
  duration?: number;
  bounce?: boolean;
}) {
  const display = useCountUp(amount, duration, 0, bounce);
  return <>{formatRupiah(display)}</>;
}

/**
 * CountUpNumber — animates a plain number from 0 to target.
 * Use for counts (habits, transactions, streaks, XP, percentages).
 *
 * @param value   Target number.
 * @param duration Animation duration in ms (default 900).
 * @param suffix  Optional suffix (e.g. '%', ' XP').
 */
export function CountUpNumber({
  value,
  duration = 900,
  suffix = '',
}: {
  value: number;
  duration?: number;
  suffix?: string;
}) {
  const display = useCountUp(value, duration, 0);
  return <>{display}{suffix}</>;
}
