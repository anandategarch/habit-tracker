// Rutina Service Worker — v17 (Meja Kerja: bugfix round 1).
// Strategi: assets stale-while-revalidate; HTML & API network-first (fallback
// cache HTML bila pernah tersimpan; API offline -> 503 JSON jujur).
// NOTE jujur: ini BUKAN offline-first penuh — mutation queue belum ada.
const CACHE_NAME = 'habit-tracker-v17';
// Riwayat versi:
//  v17 — Meja Kerja bugfix (Task 18): badge BARU zona waktu Jakarta, AI
//        rapikan lebih tahan banting (parser toleran + retry + gagal terlihat
//        di chat), konfirmasi hapus 2 langkah (catatan & tugas), Catatan
//        Kilat tampilkan 3 terbaru sungguhan.
//  v16 — Meja Kerja (Task 17-a): rutinitas kerja berulang, tugas lepas,
//        catatan kilat + pencarian, Asisten AI (rapikan catatan).
//  v15 — Gelombang-1: hapus fitur hantu (KPI Lencana/Tantangan, dropdown
//        Bahasa, targetCompletion UI), input mood/energi/tidur, habit amount
//        stepper + value, level XP total. sw-register kini parse versi dari
//        sini (single source of truth).
//  v14 — premium nav + shell Aurora.
//  v13 — floating glass dock.

const PRECACHE = [
  '/logo.svg',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API: network-first, 503 JSON jujur saat offline (tidak meng-cache data).
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req).catch(
        () =>
          new Response(JSON.stringify({ error: 'Offline — koneksi tidak tersedia' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    return;
  }

  // HTML: network-first dengan fallback cache.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true })),
    );
    return;
  }

  // Assets: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
