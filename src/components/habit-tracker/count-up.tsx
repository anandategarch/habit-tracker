'use client';

import { useState } from 'react';
import { useCountUp } from '@/hooks/use-count-up';
import { formatRupiah } from '@/components/habit-tracker/finance-types';

/**
 * useFlashOnChange — returns a `[flashKey, flashClass]` tuple where
 * `flashKey` increments every time `value` changes (so the consumer can
 * use it as a React `key` to remount the DOM node and re-trigger the CSS
 * animation), and `flashClass` is the corresponding CSS class.
 *
 * Implementation uses the React-recommended "adjusting state when a prop
 * changes" pattern (render-phase update) — see:
 * https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
 *
 * This avoids `setState` inside `useEffect` (which causes cascading renders
 * and is flagged by `react-hooks/set-state-in-effect`).
 *
 * @param value     The current value to watch.
 * @param flashColor 'green' | 'red' | undefined — controls which flash
 *                   class is applied (.anim-flash-up / .anim-flash-down).
 * @returns [flashKey, flashClass] — use `flashKey` as the React `key` prop
 *          so the DOM node remounts (re-triggering the CSS animation),
 *          and `flashClass` as the className.
 */
function useFlashOnChange(
  value: number,
  flashColor?: 'green' | 'red',
): [number, string] {
  const [flashKey, setFlashKey] = useState(0);
  const [prevValue, setPrevValue] = useState<number | null>(null);

  // Render-phase update — React batches these and re-renders immediately.
  // First if: only flash if we have a previous value AND it actually changed
  // (skips the first render so the value doesn't flash on mount).
  if (flashColor && prevValue !== null && prevValue !== value) {
    setFlashKey(k => k + 1);
  }
  if (prevValue !== value) {
    setPrevValue(value);
  }

  const flashClass = flashColor === 'green'
    ? 'anim-flash-up'
    : flashColor === 'red'
      ? 'anim-flash-down'
      : '';

  // Only return the class after the first change (flashKey > 0).
  return [flashKey, flashKey > 0 ? flashClass : ''];
}

/**
 * CountUpRupiah — animates a Rupiah amount from 0 to target.
 * Uses formatRupiah for display so it stays consistent with the rest of the app.
 * Uses easeOutBack (bounce) for a satisfying overshoot on money amounts.
 *
 * ANIM-2 enhancements:
 * - `flashColor` prop: flash green/red when amount changes (income vs expense
 *   feedback). Internally re-mounts the span via `key` so the CSS animation
 *   re-triggers on every change. Respects prefers-reduced-motion (handled in
 *   globals.css — `.anim-flash-up` / `.anim-flash-down` are disabled there).
 * - `duration` default raised to 1200ms for a more premium roll-up feel.
 *
 * @param amount     Target amount in whole rupiah (Int).
 * @param duration   Animation duration in ms (default 1200).
 * @param bounce     If true (default), use overshoot easing. Set false for subtle animation.
 * @param flashColor Optional — 'green' flashes green when amount changes (income),
 *                   'red' flashes red when amount changes (expense).
 */
export function CountUpRupiah({
  amount,
  duration = 1200,
  bounce = true,
  flashColor,
}: {
  amount: number;
  duration?: number;
  bounce?: boolean;
  flashColor?: 'green' | 'red';
}) {
  const display = useCountUp(amount, duration, 0, bounce);
  const [flashKey, flashClass] = useFlashOnChange(amount, flashColor);
  return (
    <span
      key={flashKey}
      className={flashClass}
      style={{ display: 'inline-block' }}
    >
      {formatRupiah(display)}
    </span>
  );
}

/**
 * CountUpNumber — animates a plain number from 0 to target.
 * Use for counts (habits, transactions, streaks, XP, percentages).
 *
 * ANIM-2 enhancements:
 * - `flashColor` prop: flash green/red when value changes.
 * - `duration` default raised to 1200ms.
 *
 * @param value     Target number.
 * @param duration  Animation duration in ms (default 1200).
 * @param suffix    Optional suffix (e.g. '%', ' XP').
 * @param flashColor Optional — 'green' / 'red' flash on value change.
 */
export function CountUpNumber({
  value,
  duration = 1200,
  suffix = '',
  flashColor,
}: {
  value: number;
  duration?: number;
  suffix?: string;
  flashColor?: 'green' | 'red';
}) {
  const display = useCountUp(value, duration, 0);
  const [flashKey, flashClass] = useFlashOnChange(value, flashColor);
  return (
    <span
      key={flashKey}
      className={flashClass}
      style={{ display: 'inline-block' }}
    >
      {display}{suffix}
    </span>
  );
}

