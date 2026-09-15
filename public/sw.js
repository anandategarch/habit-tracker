// Rutina Service Worker — v28 (TASK 61-i: robustness fetch handler).
// Strategi: assets stale-while-revalidate; HTML & API network-first (fallback
// cache HTML bila pernah tersimpan; API offline -> 503 JSON jujur).
// NOTE jujur: ini BUKAN offline-first penuh — mutation queue belum ada.
const CACHE_NAME = 'habit-tracker-v28';
// Riwayat versi:
//  v28 — Task 61-i (bug-hunt PWA robustness): (1) fallback navigasi offline
//        kini BERANTAI sampai shell '/' + 503 darurat — respondWith tidak
//        pernah lagi menerima undefined; (2) SEMUA cache.put di fetch
//        handler didaftarkan ke event.waitUntil sel event masih aktif —
//        browser tidak boleh meng-terminate SW sebelum tulis cache selesai
//        (termasuk revalidasi background SWR yang berjalan setelah
//        respondWith settle); (3) aset yang offline & belum pernah di-cache
//        dijawab 503 generik, bukan undefined (TypeError respondWith).
//        Satu deploy bersama: vercel.json (buang immutable utk file
//        non-hash), manifest (+id/lang/dir), layout (appleWebApp iOS),
//        sw-register (SW hanya production). Bump versi agar update terpasang
//        serentak + cache v27 dibersihkan saat activate.
//  v27 — TASK 59 + bug-hunt 59-b4 #1: splash (Task 58) DAN tab-loading
//        (Task 59) kini TreeGrowSplash — 4 aset sekuens tumbuh
//        /tree/grow-1-tunas … grow-4-berbunga.svg WAJIB di-precache
//        (sebelumnya hanya v26-era tunas-mark — cold-start offline PWA
//        menampilkan splash tanpa pohon). tunas-mark.svg dikeluarkan:
//        TreeMark sudah tidak dirender (dead code Task 59), file tetap
//        ada di disk untuk scripts/generate-icons.mjs (ikon PWA/favicon).
//  v26 — TASK 57 (fix "kok jadi kotak"): splash + tab loading kini memakai
//        /tree/tunas-mark.svg — artwork tunas botanical TANPA layer latar
//        (rect teal kotak dibuang, crop persegi di sekitar tunas, bayangan
//        .16) sehingga yang tampil POHONNYA pada background aplikasi.
//        File baru wajib di-precache; bump cache agar pengguna PWA langsung
//        dapat mark transparan (bukan tile kotak v25).
//  v25 — TASK 56 (samakan ikon dgn pohon terbaru): splash + tab loading
//        kini TreeMark (artwork tunas botanical pengguna — komponen baru di
//        loaders.tsx, TreeGrow vektor lama dihapus). SELURUH paket ikon PWA
//        (icon-192/512 any + maskable, apple-touch-icon, favicon.ico,
//        logo.svg) diregenerasi dari tunas.svg: any = full-bleed square;
//        maskable = konten 62% dalam safe-zone 66/108 (0 pelanggaran
//        piksel, 72 sampel). Bump cache WAJIB — v24 masih menyimpan ikon
//        tunas-Lucide lama di HP user.
//  v23 — POHON RUTINA (Task 53): fitur pohon bertumbuh (Beranda "Pohonmu"
//        + Progres "Jalan Pertumbuhan"). 7 artwork SVG botanical pengguna
//        (benih/tunas/pohon-muda/pohon-dewasa/berbunga/daun-kuning/dorman)
//        di-precache supaya pohon tetap tampil saat offline — ia adalah
//        cermin identitas sistem, bukan dekorasi yang boleh hilang.
//  v22 — Opsi R2 (Task 34): SEMUA file ikon berganti konten — logo Rutina asli
//        (tunas Lucide, teal #3eb59e = --primary yang dirender aplikasi)
//        dipulihkan dari sejarah git, menggantikan logo template Z.AI yang
//        tak sengaja terpasang sejak rebuild d9ef4e4. Maskable kini aman
//        safe-zone 66/108 yang benar (0 pelanggaran piksel). favicon.ico baru
//        (16/32/48) + theme_color manifest disamakan ke #3eb59e. Bump cache
//        WAJIB karena v21 masih menyimpan ikon Z.AI lama di HP user.
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
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png',
  // POHON (Task 53) — artwork SVG pertumbuhan (botanical gelap Aurora)
  '/tree/benih.svg',
  '/tree/tunas.svg',
  '/tree/pohon-muda.svg',
  '/tree/pohon-dewasa.svg',
  '/tree/berbunga.svg',
  '/tree/daun-kuning.svg',
  '/tree/dorman.svg',
  // TASK 58/59 — sekuens tumbuh splash + loading antar tab (TreeGrowSplash).
  // Keempatnya berbagi koordinat viewBox (x=152 w=720 bawah=966) supaya
  // tanah sejajar saat crossfade — offline pun pohon tetap "tumbuh".
  '/tree/grow-1-tunas.svg',
  '/tree/grow-2-muda.svg',
  '/tree/grow-3-dewasa.svg',
  '/tree/grow-4-berbunga.svg',
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

// 61-i: lapis darurat terakhir semua fallback offline — respondWith tidak
// boleh pernah menerima undefined (TypeError); jawab 503 jujur.
function offlineResponse() {
  return new Response('Offline — koneksi tidak tersedia. Buka ulang saat online.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

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

  // HTML: network-first dengan fallback cache berantai (61-i #1: turun
  // match(req) -> match('/') -> 503 darurat — tak pernah resolve undefined).
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          // 61-i #2: waitUntil — SW dijamin hidup sampai tulis cache selesai.
          event.waitUntil(
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {}),
          );
          return res;
        })
        .catch(() =>
          caches
            .match(req, { ignoreSearch: true })
            .then((cached) => cached || caches.match('/'))
            .then((shell) => shell || offlineResponse())
            .catch(() => offlineResponse()),
        ),
    );
    return;
  }

  // Assets: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req);
      // 61-i #2: rantai tulis-cache didaftarkan ke waitUntil SEKARANG, sel
      // event masih aktif (respondWith belum settle) — mencakup juga
      // revalidasi background SWR setelah respondWith menjawab dari cache.
      const putChain = network.then((res) => {
        if (!res.ok) return;
        const copy = res.clone();
        return caches
          .open(CACHE_NAME)
          .then((c) => c.put(req, copy))
          .catch(() => {});
      });
      event.waitUntil(putChain.catch(() => {}));

      if (cached) return cached; // SWR: instan dari cache, revalidate di belakang.
      // 61-i #3: cache kosong + offline -> 503 generik, bukan undefined.
      return network.catch(() => offlineResponse());
    }),
  );
});
