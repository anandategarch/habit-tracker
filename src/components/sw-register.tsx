'use client';
import { useEffect } from 'react';

// ── Module-scope controllerchange listener ───────────────────────────
// MUST be attached at module load (before React mounts) — not inside
// useEffect. Reason: when a new SW activates (skipWaiting + clients.claim),
// the `controllerchange` event can fire DURING the initial page parse,
// before React has mounted. A listener attached only inside useEffect
// would MISS the event and never trigger the reload that fetches fresh
// JS chunks.
//
// The `refreshing` flag prevents an infinite reload loop in case the
// event fires more than once.
let refreshing = false;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    // Force a hard reload (bypasses bfcache) so the new SW serves fresh
    // HTML + JS chunks.
    window.location.reload();
  });
}

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        console.log('SW:', reg.scope);

        // Force an update check on every page load. The browser normally
        // rate-limits SW update checks to once per 24h (per the SW spec
        // "Should-Skip-Update" algorithm). This means a user who opened
        // the app within the last 24h will NOT receive the new SW until
        // the 24h window expires. `reg.update()` bypasses this limit and
        // forces a fresh fetch of sw.js. Critical for shipping fixes
        // (like the morph-bump nav redesign) to returning users.
        reg.update().catch(() => {});

        // If a new SW is already in the waiting state (e.g., the user's
        // previously-installed SW is older and doesn't self-trigger
        // skipWaiting on install), nudge it from the page side. The SW
        // listens for this message and calls self.skipWaiting().
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // When a new SW finishes installing, if there's already an active
        // controller (returning user), the new SW goes into "waiting"
        // state. Detect this and trigger skipWaiting from the page side
        // (defense in depth — the SW also calls skipWaiting in install).
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      } catch (e) {
        console.warn('SW:', e);
      }
    };

    // Register immediately rather than waiting for the `load` event.
    // The sooner the SW is registered + update() is called, the sooner
    // we detect a new version and trigger the auto-reload. Waiting for
    // `load` adds 200-2000ms of latency on mobile.
    register();

    // Handle bfcache restore: when the user navigates back to this page
    // and Chrome restores it from the back/forward cache, the OLD JS
    // execution context is restored (including any OLD morph-bump nav
    // state). Force a SW update check + reload if the SW has changed.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        navigator.serviceWorker
          .getRegistration()
          .then((reg) => reg?.update().catch(() => {}));
      }
    };
    window.addEventListener('pageshow', onPageShow);

    return () => {
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);
  return null;
}
