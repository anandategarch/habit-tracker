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

        // Single-source versi cache = sw.js: fetch '/sw.js' (no-store, tidak
        // lewat cache SW karena destination fetch() bukan script/navigate)
        // dan parse CACHE_NAME-nya SEBELUM blok compare localStorage di
        // bawah — register() async, jadi tidak ada race dengan register().
        // Dengan ini nilai pembanding halaman tidak pernah "lag" di
        // belakang sw.js hasil deploy baru (dulu konstanta build-time
        // 'v12' yang mandek sejak v13).
        const cacheVersion = await readSwCacheVersion();

        // FIX: Race condition — if SW activated BEFORE React mounted (which
        // happens on fast SW install), controllerchange already fired and
        // was missed by the listener. Detect this by comparing the SW
        // version stored in localStorage against the version we just parsed
        // from the live sw.js. If they differ, the page loaded with an old
        // SW but new SW is now active → force reload.
        //
        // BUG-SW-PERF BUG-3: removed dead `controllerUrl`/`activeUrl`
        // declarations — they were declared but never compared (the
        // actual comparison uses localStorage version, not scriptURL).
        // scriptURL is always `/sw.js` for this app (single SW scope)
        // so comparing scriptURLs would be a no-op anyway.
        if (reg.active && navigator.serviceWorker.controller) {
          const storedVersion = localStorage.getItem('sw-version');
          const currentVersion = reg.active.scriptURL + '|' + cacheVersion;
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

// Fallback bila fetch/parse /sw.js gagal (offline, non-200, regex miss) —
// HARUS identik dengan CACHE_NAME di public/sw.js pada ronde ini;
// sumber kebenaran utama tetap sw.js yang di-parse dinamis di atas.
const FALLBACK_CACHE_VERSION = 'habit-tracker-v15';

// Baca versi cache langsung dari sw.js yang sedang di-deploy (single-source).
// sw.js memakai nama konstanta CACHE_NAME; regex juga menerima CACHE_VERSION
// bila suatu saat di-rename, dan mengambil nilai string pertamanya.
async function readSwCacheVersion(): Promise<string> {
  try {
    const res = await fetch('/sw.js', { cache: 'no-store' });
    if (!res.ok) return FALLBACK_CACHE_VERSION;
    const txt = await res.text();
    const m = txt.match(/CACHE_(?:NAME|VERSION)\s*=\s*['"]([^'"]+)['"]/);
    return m?.[1] ?? FALLBACK_CACHE_VERSION;
  } catch {
    return FALLBACK_CACHE_VERSION;
  }
}
