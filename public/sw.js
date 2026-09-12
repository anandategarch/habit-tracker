// Rutina Service Worker — v21 (Opsi L1: paket ikon PWA dari logo existing).
// Strategi: assets stale-while-revalidate; HTML & API network-first (fallback
// cache HTML bila pernah tersimpan; API offline -> 503 JSON jujur).
// NOTE jujur: ini BUKAN offline-first penuh — mutation queue belum ada.
const CACHE_NAME = 'habit-tracker-v21';
// Riwayat versi:
//  v21 — Opsi L1 (Task 33): paket ikon PWA — manifest kini punya PNG 192/512
//        purpose any + maskable (safe-zone 66/108dp, bg full-bleed #2D2D2D,
//        glyph Z skala 0.72) + apple-touch-icon.png 180 opaque (iOS tolak SVG).
//        Fix "logo jadi besar sekali" di Android: mask launcher kini memotong
//        background, bukan glyph. Semua ikon di-precache untuk install offline.
//  v20 — Bug hunt Papan ronde 3 (Task 22): rutinitas kini jadi KARTU kanban
//        kelas satu — belum dicentang → kolom Belum, dicentang hari ini →
//        kolom Selesai (fix "tugas selesai/menggantung kok tidak muncul");
//        kartu rutinitas bisa di-tap, digeser Belum↔Selesai, tombol geser
//        cepat mobile; drop rutinitas ke Jalan/Nunggu ditolak dengan toast;
//        seksi checklist rutinitas lama dihapus (digantikan kartu).
//  v19 — Bug hunt Papan ronde 2 (Task 21): rutinitas hari ini tampil di tab
//        Papan (fix "papan kosong padahal rutinitas sudah diisi"), kolom
//        Selesai & Arsip kini berbasis completedAt (tugas kapan-saja/target
//        depan yang diselesaikan hari ini tidak lagi hilang/masuk arsip
//        duluan), tombol Tugas baru + tampilan error + retry di papan.
//  v18 — Meja Kerja Fase 2 (Task 19): Papan Tugas kanban (drag & drop 4
//        kolom), Arsip tugas selesai, Mode Libur per-hari; FIX-HABIT-GRID-GAP
//        (wajah belakang kartu flip kini benar-benar absolute — jarak antar
//        kartu habit kembali rapat).
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
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png',
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
