const CACHE_NAME = 'habit-tracker-v6';

// Bump cache version (v1 -> v2 -> ... -> v6) to purge any stale /api/ responses that
// may have been cached by the previous service worker version.
// v5: morph bump nav redesign — purge old JS chunks that contain the old
// flat-pill nav code so browsers fetch fresh JS with morph-bump styles.
// v6: SW activate bug fix — `clients.claim()` now runs inside
// `event.waitUntil()` so the new SW reliably takes control of open tabs
// (previously could be terminated before claim finished, leaving the
// user stuck on the old SW). Also adds page-side `SKIP_WAITING` message
// handler so sw-register.tsx can nudge a waiting worker into activation.

// Install: pre-cache shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
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

// Push handler
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let p; try { p = event.data.json(); } catch { p = { title: 'Rutina', body: event.data.text() }; }
  const o = { body: p.body||'', icon: p.icon||'/icon-192.png', badge: p.badge||'/icon-96.png', tag: p.tag||'r', data: p.data||{url:'/'}, requireInteraction: p.requireInteraction||false, actions: p.actions||[], vibrate: [100,50,100] };
  event.waitUntil(self.registration.showNotification(p.title||'Rutina', o));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const u = event.notification.data?.url || '/';
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cl => {
    for (const c of cl) { if (c.url.includes(self.location.origin)) { c.focus(); return; } }
    if (self.clients.openWindow) return self.clients.openWindow(u);
  }));
});
