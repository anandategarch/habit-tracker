const CACHE_NAME = 'habit-tracker-v15';

// Bump cache version (v1 → v2 → ... → v10) to purge any stale /api/ responses that
// may have been cached by the previous service worker version.
// v15: Gelombang-1 — hapus fitur hantu (KPI Lencana + kontrol Bahasa/Target
// Penyelesaian di Settings) + sinkron versi SW (sw-register kini parse
// CACHE_NAME ini secara dinamis). Satu bump menutupi semua asset yang juga
// berubah ronde ini oleh agent paralel.
// v14: Premium UI redesign seluruh app ("Rutina Aurora") — design tokens,
// hero/kartu premium, chip gradien, dsb. Purge v13 chunks agar user lihat UI baru.
// v13: Premium bottom-nav redesign (floating glass dock + liquid indicator +
// FAB popup) — purge v12 JS chunks that still contain the old Flutter
// notched-bar nav. Users on the cached v12 shell would otherwise never
// receive the new PremiumBottomNav component.
// v10: i18n Indonesian — purge old English JS feature removed — purge old sw.js with push handler
// + old JS chunks with PushNotificationSettings component.
// v8: Rewards/Badges/Challenges removed — purge old JS chunks that still
// contain nav items + KPI cards for these removed features. Users seeing
// stale nav with 9 items need this cache bump to fetch fresh JS (6 items).
// v6: SW activate bug fix — `clients.claim()` now runs inside
// `event.waitUntil()` so the new SW reliably takes control of open tabs
// (previously could be terminated before claim finished, leaving the
// user stuck on the old SW). Also adds page-side `SKIP_WAITING` message
// handler so sw-register.tsx can nudge a waiting worker into activation.
// v7: CLIENT-DEBUG-1 — post-Turso-migration cache purge. Even though v2+
// SW no longer caches /api/ responses, the v1 SW DID cache them with a
// network-first strategy. Any user whose browser still has the v1 SW
// active (because v6 activation failed silently on iOS PWA mode, or
// because they never re-opened the app after v6 was deployed) will have
// STALE EMPTY /api/ responses in their `habit-tracker-v1` cache from
// the DB-migration window. Bumping to v7 forces a fresh SW update wave
// + activate event, which deletes ALL old caches (including v1) via the
// `keys.filter(key => key !== CACHE_NAME)` cleanup below. Combined with
// the no-store header on /api/dashboard, this guarantees that the next
// load after the v7 deploy fetches fresh data from the new Turso DB.
// Also bumps static-asset cache so any client-side JS changes get fetched.

// Install: pre-cache shell
self.addEventListener('install', (event) => {
  // FIX: wrap skipWaiting in event.waitUntil to prevent SW termination
  // before activation completes on slow devices.
  event.waitUntil(self.skipWaiting());
});

// Activate: clean old caches (including v1) AND claim all open clients.
// CRITICAL: `self.clients.claim()` MUST be inside `event.waitUntil()`.
// If it's outside (as it was previously), the browser may terminate the
// SW after the cache-cleanup promise resolves but BEFORE clients.claim()
// finishes — meaning the new SW never takes control of existing tabs,
// `controllerchange` never fires on the client, and the auto-reload
// never happens. Result: user is stuck on the old SW forever (until
// they manually close all tabs). This was the silent bug behind the
// morph-bump nav not appearing on returning users' Android Chrome.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );

      // PERF-FIX (FIX-TIER3 / Fix 16): LRU eviction + max-age cleanup for
      // the current cache. The SW caches static assets (JS/CSS/fonts/
      // images) on a stale-while-revalidate basis. Over many deploys +
      // many sessions the cache can accumulate stale entries from older
      // builds (immutable chunks that are no longer referenced by the
      // current HTML). Without eviction this grows unbounded —
      // eventually hitting the browser's per-origin storage quota.
      //
      // Two cleanup passes:
      //   1. MAX-AGE: delete any entry whose `date` response header is
      //      older than 30 days. These are almost certainly from old
      //      builds — Vercel serves static assets with far-future
      //      `Cache-Control: max-age=31536000, immutable`, so a fresh
      //      response is fetched whenever the URL changes (new build
      //      hash). Old-URL entries linger forever without this cleanup.
      //   2. LRU: if more than 60 entries remain, delete the oldest
      //      (by `date` header) down to 60. 60 is well above the
      //      per-build chunk count (~30-50) so a single deploy's
      //      working set always fits; the cap protects against pathological
      //      growth from many rapid deploys.
      //
      // Both passes use the HTTP `date` header (set by the origin
      // server when the response was generated) — NOT the time the
      // entry was added to the cache. This is correct: a revalidated
      // 304 response updates the cache entry's freshness without
      // changing the underlying resource age.
      //
      // Wrapped in try/catch so a malformed `date` header or unexpected
      // cache API error can't break activation (which would leave the
      // new SW stuck in waiting state forever).
      try {
        const MAX_ENTRIES = 60;
        const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
        const now = Date.now();

        const cache = await caches.open(CACHE_NAME);
        const keys = await cache.keys();

        // Fetch all responses in parallel to read their `date` headers.
        // Promise.all returns a stable order matching `keys`.
        const items = await Promise.all(
          keys.map(async (key) => {
            const response = await cache.match(key);
            const dateHeader = response?.headers.get('date');
            const timestamp = dateHeader ? new Date(dateHeader).getTime() : 0;
            return { key, timestamp };
          })
        );

        // Pass 1: max-age cleanup. Any entry whose `date` is older than
        // 30 days (or has no/invalid `date` header — treat as age 0 to
        // be safe, these get evicted first under LRU below).
        const expired = items.filter(
          (item) =>
            item.timestamp === 0 || now - item.timestamp > MAX_AGE_MS
        );
        await Promise.all(expired.map((item) => cache.delete(item.key)));

        // Pass 2: LRU eviction. Re-read keys (Pass 1 may have deleted
        // some) and if we're still over the cap, sort ascending by
        // timestamp and delete the oldest (cap - current) entries.
        const remainingKeys = await cache.keys();
        if (remainingKeys.length > MAX_ENTRIES) {
          const remainingItems = await Promise.all(
            remainingKeys.map(async (key) => {
              const response = await cache.match(key);
              const dateHeader = response?.headers.get('date');
              const timestamp = dateHeader
                ? new Date(dateHeader).getTime()
                : 0;
              return { key, timestamp };
            })
          );
          // Sort ascending by timestamp (oldest first).
          remainingItems.sort((a, b) => a.timestamp - b.timestamp);
          const toDelete = remainingItems.slice(
            0,
            remainingItems.length - MAX_ENTRIES
          );
          await Promise.all(toDelete.map((item) => cache.delete(item.key)));
        }
      } catch (e) {
        // Cleanup is best-effort — never block activation on it.
        console.warn('SW cache cleanup failed (non-fatal):', e);
      }

      await self.clients.claim();
    })()
  );
});

// Allow the page to trigger skipWaiting from the client side. The SW
// already calls self.skipWaiting() in the install event, but if the
// user's previously-installed SW is OLDER (and doesn't have skipWaiting
// in install), the new SW gets stuck in "waiting" state. The page's
// sw-register.tsx detects this via `reg.waiting` / `updatefound` and
// sends this message to nudge the waiting worker into activation.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // ── API calls: network-only (NEVER cache personal data) ───────────────
  // Privacy + correctness: API responses contain user-specific data that
  // must not persist in the SW cache across sessions, devices, or after
  // mutations. Returning stale cached data would also confuse users.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(
            JSON.stringify({
              error: 'You are offline. Please check your connection.',
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          )
      )
    );
    return;
  }

  // Static assets (JS, CSS, fonts, images): stale-while-revalidate
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'image'
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // HTML / navigation: network-only (never cache HTML to prevent stale content)
  // Previously cached HTML responses, which meant users could get old JS
  // bundles after a deploy. Now: always fetch fresh, only fall back to
  // cache when truly offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((r) => r || new Response('Offline', { status: 503 }))
      )
    );
    return;
  }
});
