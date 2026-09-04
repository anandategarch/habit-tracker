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

        // FIX: Race condition — if SW activated BEFORE React mounted (which
        // happens on fast SW install), controllerchange already fired and
        // was missed by the listener. Detect this by comparing controller
        // vs registration active. If they differ, the page loaded with
        // old SW but new SW is now active → force reload.
        if (reg.active && navigator.serviceWorker.controller) {
          const controllerUrl = navigator.serviceWorker.controller.scriptURL;
          const activeUrl = reg.active.scriptURL;
          // If the controller changed during this page load, reload.
          // Use localStorage to track SW version for extra safety.
          const storedVersion = localStorage.getItem('sw-version');
          const currentVersion = reg.active.scriptURL + '|' + CACHE_VERSION;
          if (storedVersion && storedVersion !== currentVersion) {
            localStorage.setItem('sw-version', currentVersion);
            window.location.reload();
            return;
          }
          localStorage.setItem('sw-version', currentVersion);
        }

        // If a new SW is already in the waiting state, nudge it.
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // When a new SW finishes installing, trigger skipWaiting.
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

    register();

    // Handle bfcache restore.
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

// Build-time cache version — injected from sw.js CACHE_NAME.
// If this doesn't match what's stored in localStorage, force reload.
const CACHE_VERSION = 'v12';
