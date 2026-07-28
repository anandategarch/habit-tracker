'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * useCountUp — animates a number from 0 (or previous value) to `target`.
 *
 * Features:
 * - Smooth easing (easeOutExpo) for a premium feel.
 * - Respects `prefers-reduced-motion` (returns target immediately, no state).
 * - Handles target changes (re-animates from current displayed value).
 * - Safe for unmount (cancels animation frame).
 * - Returns integer when `decimals === 0` to avoid float jitter on money.
 *
 * @param target  Final number to animate to.
 * @param duration Animation duration in ms (default 900).
 * @param decimals Number of decimal places (default 0 — for money/counts).
 */
export function useCountUp(target: number, duration = 900, decimals = 0): number {
  // Check reduced-motion synchronously during render (no setState in effect).
  // SSR-safe: window doesn't exist on server, so default to false.
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const displayRef = useRef(0); // tracks latest display without re-triggering effect
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion) return; // no animation, target returned directly

    const from = fromRef.current;
    const delta = target - from;
    if (delta === 0) return; // nothing to animate

    const start = performance.now();
    // easeOutExpo: fast start, slow finish — premium feel.
    const ease = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = ease(t);
      const current = from + delta * eased;
      // Round to specified decimals to avoid float jitter.
      const factor = Math.pow(10, decimals);
      const rounded = Math.round(current * factor) / factor;
      displayRef.current = rounded;
      setDisplay(rounded);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        displayRef.current = target;
        setDisplay(target); // ensure exact final value
        fromRef.current = target;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Store current display as the next "from" so re-animations are smooth.
      // Use displayRef (not the state variable) to avoid adding it to deps —
      // otherwise the effect would re-run every frame (infinite loop).
      fromRef.current = displayRef.current;
    };
    // NOTE: display is intentionally NOT in the dependency array.
    // It changes every animation frame; including it would cause an
    // infinite re-render loop. displayRef tracks it without triggering re-runs.
  }, [target, duration, decimals, reducedMotion]);

  return reducedMotion ? target : display;
}
