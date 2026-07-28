'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * useTypewriter — types out text character by character.
 *
 * Features:
 * - Respects `prefers-reduced-motion` (returns full text immediately).
 * - Re-types when `text` changes.
 * - Blinking cursor controlled by caller (returns `done` flag).
 * - Safe for unmount (clears timeout).
 *
 * @param text    Full text to type.
 * @param speed   ms per character (default 35).
 * @param startDelay ms before typing starts (default 200).
 * @returns { typed: string, done: boolean }
 */
export function useTypewriter(
  text: string,
  speed = 35,
  startDelay = 200,
): { typed: string; done: boolean } {
  // Check reduced-motion synchronously during render (no setState in effect).
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const [typed, setTyped] = useState('');
  const [done, setDone] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reducedMotion) return; // no animation, full text returned directly

    const startTimer = setTimeout(() => {
      let i = 0;
      const typeNext = () => {
        if (i < text.length) {
          setTyped(text.slice(0, i + 1));
          i++;
          timeoutRef.current = setTimeout(typeNext, speed);
        } else {
          setDone(true);
        }
      };
      typeNext();
    }, startDelay);

    return () => {
      clearTimeout(startTimer);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [text, speed, startDelay, reducedMotion]);

  // Reset done when text changes (so cursor shows during re-type)
  useEffect(() => {
    if (!reducedMotion) {
      setTyped('');
      setDone(false);
    }
  }, [text, reducedMotion]);

  if (reducedMotion) {
    return { typed: text, done: true };
  }
  return { typed, done };
}
