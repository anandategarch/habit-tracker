'use client';

import { useSyncExternalStore } from 'react';

/**
 * usePrefersReducedMotion — reactively tracks the user's
 * `prefers-reduced-motion` media query.
 *
 * Replacement for framer-motion's `useReducedMotion` hook in components
 * that no longer import framer-motion (CSS-only loaders + page transitions).
 *
 * Uses `useSyncExternalStore` (React 18+) for tear-free subscription to
 * the MediaQueryList — avoids the `setState-in-effect` lint error that
 * the naive `useEffect + setState` pattern triggers, and avoids
 * hydration mismatches (the SSR snapshot is always `false`, matching the
 * framer-motion default which also returns `false` during SSR).
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
 */

const MQL_QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(MQL_QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(MQL_QUERY).matches;
}

// SSR snapshot — always returns `false` so the server-rendered HTML matches
// the first client render (no hydration mismatch).
function getServerSnapshot(): boolean {
  return false;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
