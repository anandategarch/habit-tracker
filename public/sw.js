const CACHE_NAME = 'habit-tracker-v4';

// Bump cache version (v1 -> v2) to purge any stale /api/ responses that
// may have been cached by the previous service worker version.

// Install: pre-cache shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate: clean old caches (including v1)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
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
