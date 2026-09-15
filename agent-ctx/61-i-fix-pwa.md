# Task 61-i — Fix PWA (vercel.json cache, appleWebApp, manifest id/lang/dir, sw.js robustness, guard dev SW)

Agent: general-purpose (PWA fixer) · EDIT: 5 file (semua di daftar izin) · SKIP: 0 · Tidak commit/push.
Rujukan audit: `agent-ctx/61-e-pwa-perf.md` (P2 vercel.json, P2 layout appleWebApp, P3 manifest,
P3 sw.js ×3, P3 sw-register dev guard). Kendala keras (DB/schema/API/bisnis) tidak disentuh.

## Fix yang diterapkan

### 1. [P2] vercel.json — akhir era `immutable` untuk file non-hash
- `vercel.json:9` — grup ikon/manifest/favicon/robots: `public, max-age=2592000, immutable`
  → `public, max-age=86400`. Menutup kelas bug "ikon basi 30 hari" (Task 56): `cache.addAll()`
  SW membaca lewat HTTP cache, jadi `immutable` bisa mengalahkan bump CACHE_NAME.
- `vercel.json:12-17` — BARU: `/tree/:path*` → `public, max-age=86400` (11 SVG, ±70KB; dulu
  default Vercel must-revalidate tiap cold visit pra-SW).
- `vercel.json:18-23` — BARU: `/logo.svg` → `public, max-age=86400`.
- `vercel.json:24-29` — BARU: `/sw.js` → `Cache-Control: no-cache` (SW wajib selalu revalidasi;
  makin self-documenting daripada default).
- Tidak ada header route API sebelumnya → tidak ada yang diubah/dirusak. JSON tervalidasi parse.

### 2. [P2] src/app/layout.tsx:44-48 — metadata `appleWebApp` iOS
- Ditambah `appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Rutina" }`
  ke export `metadata` (Next hanya emit meta apple-mobile-web-app-* bila field ini ada).
- Prasyarat diverifikasi dulu: `viewportFit: "cover"` SUDAH ada di export `viewport` (layout.tsx:69).
  Status bar standalone iOS kini transparan-harmonis dengan dark mode; judul home screen dipatok.
- Selain blok baru + komentar, tidak ada baris lain yang berubah.

### 3. [P3] public/manifest.webmanifest:4-6 — field additive
- `"id": "/"` (stabilitas identitas instalasi antar deploy), `"lang": "id"`, `"dir": "ltr"`.
- theme_color/icons/name/short_name/start_url TIDAK diubah (diverifikasi pasca-edit: tetap
  #3eb59e / 5 ikon / start_url "/"). JSON tervalidasi parse. Digabung satu deploy dengan fix #1
  supaya tidak terjebak cache immutable lama.

### 4. [P3] public/sw.js — 3 robustness + bump v27 → v28 (`CACHE_NAME = 'habit-tracker-v28'`)
- **(a) sw.js:172-178** — fallback navigasi offline kini BERANTAI:
  `caches.match(req, {ignoreSearch:true})` → `cached || caches.match('/')` → `shell || offlineResponse()`
  → `.catch(() => offlineResponse())`. respondWith tidak pernah lagi menerima `undefined`
  (dulu → halaman error network, bukan shell).
- **(b) sw.js:167-169 + 190-198** — semua `cache.put` fetch handler didaftarkan ke `event.waitUntil`:
  - Navigasi: inline `event.waitUntil(caches.open(...).put(...))` — aman karena dipanggil selama
    promise respondWith masih pending (event masih aktif menurut spesifikasi).
  - Aset: rantai tulis-cache dipisah (`putChain`) dan didaftarkan `event.waitUntil(putChain...)`
    SEKARANG di dalam callback `caches.match().then()` — sel event masih aktif; ini sengaja
    demikian agar revalidasi background SWR (yang berjalan SETELAH respondWith settle dengan
    salinan cache) tetap terlindungi dari SW terminate. `res.clone()` tetap pertama di rantai
    reaksi promise → body stream aman dari disturbance.
- **(c) sw.js:200-202 + helper 130-137** — cabang aset offline & tak pernah di-cache kini menjawab
  `offlineResponse()` (503 text/plain "Offline — koneksi tidak tersedia…"), bukan resolve
  `undefined` (TypeError respondWith). MIME generik dipilih (bukan `caches.match('/')` HTML)
  karena request bisa img/chunk/font.
- **(d) sw.js:5 + riwayat 7-18** — CACHE_NAME v27 → v28 + entri riwayat lengkap; activate tetap
  menghapus semua cache ≠ v28 → cache ikon lama terbersihkan serentak.
- Pernyataan strategi di header tetap benar (SWR/network-first tidak berubah). `node --check` LULUS.
- CATATAN desain (dari audit, TIDAK dikerjakan — di luar fix list): navigationPreload opsional
  belum ditambahkan.

### 5. [P3] src/components/sw-register.tsx:57-69 — guard environment
- Registrasi SW kini HANYA saat `process.env.NODE_ENV === 'production'`.
- Development: IIFE cleanup — `getRegistrations()` → `unregister()` semua + `caches.keys()` →
  `caches.delete()` semua (pola aman standar CRA/next-pwa). `unregister()` tidak men-trigger
  `controllerchange` → tidak mungkin loop reload dengan listener module-scope.
- Logika production (parse versi, reload anti-loop versi-mismatch, updatefound/SKIP_WAITING,
  bfcache pageshow) TIDAK diubah sama sekali — diff murni additive (guard + doc).

## Verifikasi
- `node --check public/sw.js` → OK (sintaks valid).
- `node -e JSON.parse` vercel.json + manifest.webmanifest → OK.
- `bun run lint` → **0 error, 1 warning** — sama persis dengan baseline (warning lama
  `react-hooks/incompatible-library` di finance-transactions.tsx; hanya bergeser 247→255 karena
  agen paralel lain mengedit file itu secara bersamaan — bukan warning baru).
- `bunx tsc --noEmit` → output **identik byte-per-byte dengan baseline** (diff kosong; 20 baris
  error TS lama di file lain, 0 di kelima file yang diedit).
- `git status` → perubahan saya terbatas pada 5 file izin; modifikasi file lain di working tree
  berasal dari agen paralel Task 61 lain (tidak saya sentuh).

## Catatan / next actions
- Pasca-deploy produksi: cek `curl -I` ikon/manifest (harus `max-age=86400` tanpa immutable),
  `/sw.js` (`no-cache`), `/tree/*.svg` & `/logo.svg` (`max-age=86400`); verifikasi SW user
  berganti ke v28 (localStorage `sw-version`).
- Regresi visual iOS standalone yang disebut audit (safe-area-inset-top di header shell dengan
  black-translucent) perlu dicek di iPhone saat sempat — kalau konten menabrak status bar,
  kandidat fix ada di padding env() shell (di LUAR daftar izin task ini → dilaporkan, bukan diedit).
- Splash fixed 2s (P2 ketiga audit) & shortcuts/screenshots manifest sengaja TIDAK dikerjakan —
  butuh persetujuan desain (Task 58) / di luar fix list task ini.
