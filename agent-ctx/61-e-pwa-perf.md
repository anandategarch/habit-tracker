# Task 61-e — Audit PWA + Performa + A11y Dasar (statis)

Agent: Explore (PWA/perf/a11y) · REPORT ONLY — tidak ada file source yang diedit, tidak ada commit.
Scope diaudit: `public/manifest.webmanifest`, `public/sw.js`, `src/components/sw-register.tsx`,
`src/app/layout.tsx`, `next.config.ts`, `vercel.json`, seluruh `public/*` (ukuran+dimensi riil),
`src/app/globals.css` (font/animasi/reduced-motion), `src/app/page.tsx` (+ PremiumBottomNav),
`src/components/providers.tsx`, `src/components/ui/loaders.tsx`, `src/components/tree/*` (pemakaian `<img>`),
sampling aria-label 12 komponen habit-tracker/work/finance.
Tidak melapor ulang fix lama (Task 35 logo XML, Task 56 ikon pohon, Task 58 splash) — hanya statusnya.

## Ringkasan eksekutif

PWA dalam kondisi **sehat — tidak ada P0/P1**. Manifest lengkap & valid (ikon 192/512 any+maskable
terverifikasi dimensi fisik via `file`: 192×192 & 512×512, apple-touch 180×180, favicon 16/32/48).
SW arsitektur benar (HTML network-first + fallback cache, API network-first + 503 jujur, aset SWR,
precache 17 file — semuanya ADA di disk, tidak ada 404). Registrasi single + anti-loop + bfcache.
Tab berat sudah dynamic import dengan loading fallback. A11y dasar sangat rapi untuk ukuran audit
cepat. Temuan terkumpul: **3×P2, 9×P3** — mayoritas polish/robustness, bukan kerusakan.

## Yang SUDAH BAIK (jangan difix ulang oleh agen triase)

- **Manifest**: name/short_name/description/start_url/display/background_color (#f5f7f5 ≈ --background
  oklch 0.985)/theme_color #3eb59e ada; 5 entri ikon (svg any + 192/512 any + 192/512 maskable);
  file fisik cocok deklarasi (dicek `file public/*.png`).
- **SW**: install→addAll→skipWaiting; activate→hapus cache lama→clientsClaim; pesan SKIP_WAITING;
  API ≠ GET diabaikan; cross-origin diabaikan. Riwayat bump versi v15→v27 disiplin (cache-stale
  sudah terkelola manual dengan track record baik).
- **Registrasi**: sekali (onceRef), versi diparse dari sw.js (no-store), reload anti-loop via flag
  `refreshing`, bfcache pageshow→update() — semua pattern benar.
- **layout.tsx**: lang="id" ✓, manifest link ✓, apple-touch PNG 180 ✓ (iOS tolak SVG), theme-color
  light+dark via Viewport ✓, viewportFit cover ✓, description ✓, 3 font via next/font (self-hosted,
  non-blocking) ✓.
- **Perf**: semua 8 tab `dynamic(..., { ssr:false, loading: tabLoading })` (page.tsx:66-86) — tidak
  ada tab berat di bundle awal; recharts hanya di chunk dashboard/progress; dnd-kit hanya di chunk
  tracker. Ukuran aset sehat: PNG terbesar icon-512.png 23,7KB & maskable 16,5KB (<200KB), SVG pohon
  terbesar berbunga.svg 11,6KB (<20KB), logo.svg 3,4KB. React Query staleTime 30s, retry 1,
  refetchOnWindowFocus false (providers.tsx:18-27). Semua `<img>` (loaders.tsx:156-165,
  tree-card.tsx:104-112, tree-growth-path.tsx:91-101/272-282, pohon-screen.tsx:502-511) punya
  width/height eksplisit + loading/decoding (eager+fetchPriority high hanya tahap pertama splash —
  tepat). Tidak ada font eksternal blocking, tidak ada data-URI besar di globals.css.
- **A11y**: h1 (judul tab di shell) → h2 (PageHeader/TodayHero, FIX H-DUPE sudah benar) → h3 kartu;
  nav + FAB punya aria-label/aria-current/aria-expanded/role=menu + roving focus + focus trap;
  drawer mobile modal (inert main, focus restore); sidebar tertutup `inert` (WCAG 2.4.3/2.4.7);
  23 blok `prefers-reduced-motion: reduce` di globals.css; TreeGrowSplash role="status" + aria-label;
  sampling 12 komponen: ikon-only button (work-routines, work-notes, work-today, finance-budgets,
  finance-tx-dialog, finance-recurring, finance-transactions, finance-savings-goals,
  finance-category-dialogs, finance-source-dialogs) SEMUA punya aria-label spesifik.

## TEMUAN

### P2

**[P2] `vercel.json:7-11` — `Cache-Control: immutable, max-age=2592000` untuk nama file TANPA
content-hash (manifest, ikon, favicon) — perangkap aset basi 30 hari.**
Konsekuensi: browser yang pernah fetch ikon/manifest tidak revalidasi selama 30 hari; lebih bahaya:
`cache.addAll()` SW juga membaca lewat HTTP cache → **bump CACHE_NAME TIDAK menjamin ikon baru
sampai ke user hingga 30 hari** (fetch install kena salinan immutable lama). Ini persis kelas bug
"ikon basi/kotak" Task 56 yang diperangi dengan bump versi — bump ternyata tidak cukup aman untuk
pengguna lama. Manifest yang diedit (shortcut/theme) juga baru terlihat ≤30 hari.
Saran: hilangkan `immutable` untuk file non-hash → `public, max-age=86400` (atau tambah query
`?v=` di PRECACHE saat ikon berganti). **Aman diperbaiki: ya** (vercel.json saja, tanpa sentuhan
kode; efek segera untuk request berikutnya).

**[P2] `src/app/layout.tsx:35-51` — metadata iOS `appleWebApp` hilang (tidak ada
`apple-mobile-web-app-capable` / `-status-bar-style` / `-title`).**
Next 16 baru emit meta iOS bila `metadata.appleWebApp` di-set. Diverifikasi: tidak ada string
appleWebApp/apple-mobile-web-app di seluruh src/. Manifest `display: standalone` tetap dihormati
iOS modern (instalasi jalan), TAPI tanpa `statusBarStyle: "black-translucent"` status bar standalone
iOS pakai style default (terang) — bertabrakan dengan dark mode app dan viewport-fit=cover; judul
home screen tidak dipatok "Rutina".
Saran: tambah `appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Rutina" }`
di export metadata. Cek regresu visual iOS (konten makin naik di bawah status bar transparan —
padding env(safe-area-inset-top) mungkin perlu dicek di header shell).
**Aman diperbaiki: ya dengan regresi viewport iOS** (uji dulu; kalau ragu, `default` dulu).

**[P2] `src/app/page.tsx:289-293` — splash pembuka durasi TETAP 2,0 detik terlepas dari kesiapan
data.**
Kunjungan ulang (chunk + SW cache + React Query cache) sudah siap jauh sebelum 2s tapi tetap
ditahan penuh; tiap cold-start PWA membayar 2s perceived latency. Keputusan desain sadar Task 58
(narasi 4 tahap butuh 1,76s) — jadi ini trade-off, bukan bug.
Saran: exit-early — mulai exit saat (a) komponen tab aktif mount + (b) query kritis selesai ATAU
timeout 2s, mana lebih dulu, dengan durasi minimum ~1,4s agar narasi tidak terpotong aneh.
**Aman diperbaiki: ya hati-hati** (ubah efek splash jadi promise-aware; jangan sentuh timing CSS
 tahap pohon).

### P3

**[P3] `public/manifest.webmanifest:1-42` — field pelengkap hilang: `lang: "id"`, `dir: "ltr"`,
`id: "/"`, `shortcuts`, `screenshots`, `categories`.**
`id` penting untuk stabilitas identitas instalasi antar deploy; `shortcuts` (mis. "Catat
Pengeluaran" → `/?tab=finance`, "Hari Ini") memperkaya long-press Android; `screenshots` bikin
install prompt Android lebih kaya (form factor `narrow` + label). Saran: tambahkan bertahap.
**Aman diperbaiki: ya** (murni additive; ingat P2 immutable — gabungkan deploy dengan fix vercel.json).

**[P3] `public/manifest.webmanifest:8` + `src/lib/theme-utils.ts` (applyThemeColors) —
`theme_color` manifest statis #3eb59e bisa desync dari preset warna runtime + berbeda dari meta
theme-color browser (#f5f7f5/#101513).**
Title bar PWA terinstall teal, address bar browser off-white/dark, dan --primary bisa diganti user
di Pengaturan — tiga sumber warna tidak konsisten. Inheren terhadap runtime theming (tidak ada
mekanisme dinamis untuk manifest). Saran: minimnya sadari & dokumentasikan; opsional samakan
manifest theme_color ke netral (#101513) bila ingin title bar gelap konsisten dark-first.
**Aman diperbaiki: ya** (nilai saja) — tapi keputusan desain, bicarakan di triase.

**[P3] `public/sw.js:147` — fallback navigasi offline bisa resolve `undefined`.**
`caches.match(req, {ignoreSearch:true})` → jika entry HTML belum tersimpan (mis. instal lalu langsung
offline sepaḥam kunjungan pertama selesai), respondWith(undefined) → error network page, bukan shell.
SPA selalu navigasi ke `/` sehingga praktis jarang kena. Saran:
`.catch(() => caches.match('/'))` sebagai lapis terakhir. **Aman diperbaiki: ya.**

**[P3] `public/sw.js:143-144, 158-159` — `cache.put` di fetch handler tidak dibungkus
`event.waitUntil`.**
SW bisa di-terminate browser sebelum put selesai (terutama background revalidate SWR). Praktis
jarang masalah di halaman aktif. Saran: `event.waitUntil(caches.open(...).then(...))`.
**Aman diperbaiki: ya** (bump CACHE_NAME v28 — trigger update terkontrol via mekanisme versi
sw-register yang sudah ada).

**[P3] `public/sw.js:153-166` — cabang aset: saat offline & tidak ada cache, promise resolve
`undefined` (`.catch(() => cached)` dengan cached undefined) → TypeError respondWith.**
Sama kelas dengan temuan navigasi; hanya file yang belum pernah di-cache. Saran: fallback
`Response.error()` atau biarkan fetch gagal natural (return tanpa respondWith tidak bisa di sini —
bungkus guard `if (!cached) return fetch(req)` tanpa respondWith... paling sederhana: catch →
`Promise.reject` dan tangkap di respondWith). **Aman diperbaiki: ya.**

**[P3] `public/sw.js` — tidak ada `navigationPreload`.**
Setiap navigasi menunggu SW boot sebelum `fetch(req)` jalan. `event.waitUntil(self.registration.
navigationPreload.enable())` di activate + `event.preloadResponse` di handler navigasi memangkas
~200-400ms pada perangkat lambat. Nice-to-have. **Aman diperbaiki: ya** (opsional).

**[P3] `src/components/sw-register.tsx:55` — registrasi SW tanpa guard `process.env.NODE_ENV ===
'production'`.**
SW aktif juga di dev port 3000 (worklog: dev server terus dipakai) — berisiko kebingungan aset basi
saat HMR/edit (chunk `/_next/static` ikut ter-cache SWR). Belum ada laporan insiden dev — catatan
pencegahan. Saran: register hanya saat production, atau `unregister()` eksplisit di dev.
**Aman diperbaiki: ya** — tapi uji dulu alur dev tim (mereka mungkin sengaja menguji SW di dev).

**[P3] `src/components/sw-register.tsx:30-36 + 65-68` + `public/sw.js:101,110` — reload ganda &
reload kunjungan pertama.**
(a) `clients.claim()` di activate men-trigger `controllerchange` juga saat instal PERTAMA → pengguna
baru dapat 1 reload penuh tak perlu tepat setelah first load. (b) Pengguna lama saat deploy baru
bisa kena 2 reload beruntun (localStorage version-mismatch reload, lalu controllerchange reload).
Kosmetik, sekali per kejadian. Saran (opsional): guard `if (!navigator.serviceWorker.controller)
return;`-style di listener, atau tunda reload sampai idle. **Aman diperbaiki: ya hati-hati**
(pattern reload-on-update adalah yang menyelamatkan user dari SW basi — jangan sampai malah
menahan update).

**[P3] `vercel.json:7` — tidak ada header cache untuk `/tree/*.svg`, `/logo.svg`, dan eksplisit
`/sw.js`.**
Tree SVG (11 file, ±70KB total) & logo kena default Vercel `max-age=0, must-revalidate` →
revalidasi tiap cold visit pra-SW (aman tapi 12 RTT ekstra). `/sw.js` juga default (cukup baik di
Vercel; `no-cache` eksplisit lebih self-documenting). Saran: tambah rule
`/tree/.*\.svg|logo\.svg` → `public, max-age=86400` (TANPA immutable) dan `/sw.js` →
`no-cache`. **Aman diperbaiki: ya.**

**[P3] `src/app/layout.tsx:12-33` — micro-opt font: Geist Mono dimuat penuh padahal hanya dipakai
`font-mono tabular-nums` tooltip chart (chart.tsx:236, dashboard-charts.tsx:198/304/401); Fraunces
variable dengan 3 sumbu (SOFT/opsz/WONK) untuk momen display.**
Self-hosted via next/font jadi tidak blocking, tapi ±1 file woff2 bisa dihemat dengan
`font-variant-numeric: tabular-nums` pada font sans di angka chart. Fraunces axes biarkan (identitas
brand, dipakai luas). **Aman diperbaiki: ya** — nilai kecil, prioritaskan terakhir.

**[P3] `src/app/page.tsx:1 + 66-86` — seluruh app client-rendered (`'use client'` + semua tab
`ssr:false`): first paint = splash kosong sampai JS hidrasi.**
Konsekuensi: FCP bergantung JS di link kualitas jaringan lambat; SEO n/a (app pribadi). Arsitektur
disengaja (browser-only APIs + shell PWA). Tidak perlu diubah; catatan struktural kalau suatu saat
butuh landing/SEO. **Aman diperbaiki: tidak** (biarkan — arsitektural).

**[P3] `src/app/page.tsx:539-755` — tidak ada skip-link ke konten.**
Dampak kecil karena sidebar tertutup sudah `inert` (Tab order pendek: toggle → konten). Di desktop
sidebar terbuka ada ~9 tombol sebelum konten. Saran: `<a href="#konten" class="sr-only
focus:not-sr-only">` + id di `<main>`. **Aman diperbaiki: ya**.

**[P3] `public/tree/tunas-mark.svg` — aset 2,4KB tanpa konsumen runtime (dead asset disengaja,
dipertahankan untuk `scripts/generate-icons.mjs`).**
Info saja — JANGAN dihapus oleh agen lain (sumber regenerasi ikon).

### Catatan non-temuan (sudah dicek, tidak bermasalah)
- `next.config.ts:12-14` `ignoreBuildErrors: true` — mekanisme yang menutup 26 error tsc baseline
  lama (diketahui worklog; bukan temuan baru, tapi berarti error tsc BARU tidak akan menggagalkan
  build — triase sebaiknya tetap jalankan tsc manual).
- robots.txt wajar; error.tsx global ada; QueryClient tidak dibuat ulang per render; Toaster di
  layout (bukan per-tab).
- Offline = shell + aset saja (API 503, tanpa mutation queue) — SUDAH didokumentasikan jujur di
  header sw.js; bukan regresi.

## Totals & Top-5 layak fix

**Totals: P0=0 · P1=0 · P2=3 · P3=12** (2 di antaranya "biarkan/info saja).

Top-5 (rasio dampak/risiko terbaik):
1. **[P2] vercel.json** — buang `immutable` dari file non-hash → cegah kelas bug "ikon/manifest
   basi 30 hari" yang berulang (Task 56). 1 baris, nol risiko.
2. **[P2] layout.tsx** — `appleWebApp` meta (capable + black-translucent + title) → pengalaman
   instal iOS benar. Regresi visual iOS wajib dicek.
3. **[P3] manifest** — tambah `id`, `lang`, `dir`, `shortcuts`, `screenshots` (gabung 1 deploy
   dengan #1 supaya tidak kena cache immutable lama).
4. **[P3] sw.js** — fallback `caches.match('/')` navigasi offline + `event.waitUntil` di put +
   (opsional) navigationPreload; bump v28.
5. **[P2] splash early-exit** — kurangi 2s fixed delay jadi max(ready, ~1,4s). Hati-hati: keputusan
   desain Task 58 — butuh persetujuan estetika.

Urutan kerja yang disarankan: 1 → 3 (satu deploy) → 2 → 4 → 5.
