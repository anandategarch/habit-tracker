# Task 61-g — Finance / Goals / Settings / Kalender / Toast — Fix Report

Agent: general-purpose (frontend fixer, domain Keuangan/Tujuan/Pengaturan/kalender)
Mode: EDIT (7 file di scope, tanpa commit/push, tanpa dependency baru, kontrak API/schema/kalkulasi tidak disentuh).
Baseline dihormati: lint 0 error + 1 warning LAMA (TanStack Virtual, `react-hooks/incompatible-library`, kini di finance-transactions.tsx:255 karena +8 baris komentar di atasnya — warning yang sama, bukan baru). tsc: tidak ada error di file yang diedit (total turun 24→20 karena agen paralel memperbaiki work-board.tsx di tengah sesi).

## Fix applied (8/8)

1. **[P2-a11y] finance.tsx:694-700 → kini :697-703** — 7 label sub-tab Keuangan (Ringkasan/Transaksi/Budget/Analisis/Recurring/Aturan/Tabungan) diganti `hidden sm:inline` → `sr-only sm:not-sr-only`. Di <640px label kini masuk accessibility tree (sr-only) sehingga trigger icon-only punya nama (WCAG 4.1.2); di ≥sm tampil normal. Dipilih penggantian kelas (bukan menambah span sr-only terpisah) supaya desktop tidak membaca label dua kali.
2. **[P2-a11y] finance-transactions.tsx:279** — tombol X penghapus pencarian icon-only kini ber-`aria-label="Hapus pencarian"` (identik dengan kembarannya di badge hasil pencarian). + komentar 61-g di atas Search Bar.
3. **[P3-perf] finance-transactions.tsx:111-118, 540, 606-608, 625, 653-656** — `anim-stagger` (fade-up 0.5s) kini HANYA untuk batch render awal: konstanta modul `ENTRY_ANIM_FLAT_ROW_LIMIT = 22` (≈ viewport awal + overscan, konsisten komentar BUGHUNT-47 "±22 baris pertama ter-mount"), prop baru `animateEntry` di `TransactionRow` diisi `vItem.index < ENTRY_ANIM_FLAT_ROW_LIMIT`. Baris yang mount akibat scroll cepat tidak lagi memutar ulang fade-up (anti-kedip); delay stagger `Math.min(txIdx,8)*30ms` hanya diset saat animasi aktif. Ganti data/filter tetap menganimasikan batch awal (perilaku "render awal" dipertahankan).
4. **[P2-state] calendar-view.tsx:235-241** — queryFn `['habit-logs-batch', …]` (satu-satunya query dengan `isError: fetchError` → kartu error + "Coba Lagi") kini `if (!res.ok) throw new Error('Gagal memuat log habit (HTTP …)')` alih-alih `return []`. UI error yang tadinya dead code hidup; React Query retry default 1× lalu error state; `retryFetch` (invalidate habits/daily-logs-month/habit-logs-batch) sudah ada. Bentuk data sukses TIDAK berubah; `if (!habitIds) return []` (guard disable) dipertahankan.
5. **[P3] goals.tsx:76-84, 96, 350** — paritas pola 60-a #2b (pohon-screen) & dashboard.tsx: `retryCount` kini state LOKAL (dulu hardcode `0` di elemen-4 key `['dashboard','all',refreshKey,retryCount]`) sehingga struktur kunci identik dengan Beranda/Pohon — tidak bercabang permanen pasca-"Coba Lagi" Beranda. Tombol "Coba Lagi" lokal ikut menaikkannya agar status pendukung tujuan (todayHabits) ikut disegarkan saat retry. CATATAN: menghapus elemen-4 (opsi lain di audit) justru salah — dashboard.tsx/pohon-screen.tsx memakai key 4-elemen dan cache sharing butuh key persis sama.
6. **[P3] use-finance-mutations.ts:632-634** — deps `handleSaveBalance` dirapikan: `[balanceEditValue, getActiveSources, queryClient]` → `[balanceEditValue, getActiveSources, invalidateFinance]` (body memakai `invalidateFinance()` di :617; `queryClient` tidak dipakai di callback). `queryClient` tetap dipakai hook di tempat lain (tidak jadi unused).
7. **[P3-eval] settings.tsx:143-166** — dirty-guard sederhana (~24 baris termasuk komentar) pada efek sinkron settings→form: ref `lastSyncedFormRef` menyimpan snapshot form hasil sinkron terakhir; form hanya ditimpa bila masih identik dengan snapshot (user belum menyentuh apa pun). Refetch pasca-save (invalidate `['settings']` ±0,5 dtk) tidak lagi menimpa ketikan user. `setForm` difungsikan dengan guard nilai supaya tidak render loop (form kini masuk deps efek). Trade-off disengaja: setelah "Reset Semua Data" (invalidate semua query), ketikan yang belum disimpan tetap dipertahankan di form — pindah tab & kembali (remount) akan re-sync.
8. **[P2-UX] src/components/ui/sonner.tsx:9-20** — Toaster memakai `useIsMobile()` (src/hooks/use-mobile.ts, breakpoint 768): `position={isMobile ? 'top-center' : 'bottom-right'}` — toast mobile tidak lagi menimpa dock navigasi + FAB ±4 dtk. Prop diletakkan sebelum `{...props}` sehingga pemanggil eksplisit masih bisa override; satu-satunya pemanggil `<Toaster />` (layout.tsx:85) tanpa prop position. Komponen tetap `'use client'`, tanpa SSR mismatch (useIsMobile settle di efek pasca-hidrasi; toast hanya muncul pasca-interaksi user).

## Skip / catatan

- Item fix-list lainnya di luar daftar 8 tidak dikerjakan (bukan scope file ini).
- Pola sistemik `if (!res.ok) return []` di query LAIN calendar-view (habits :203, dailyLogs :214) TIDAK diubah — fix-list #4 hanya menargetkan query ±228 (yang punya UI error); mengubah dua query lain tanpa UI error-nya tidak memberi efek visual dan di luar mandat.
- goals.tsx queryFn dashboard (`return null` saat !res.ok) dibiarkan — bukan item fix-list; men-throw-nya butuh UI error yang belum ada di Tujuan.
- Dead code use-toast/toaster, today-habits ripple, hourly-consistency, dsb. → domain agen lain (bukan daftar file 61-g).

## Verifikasi

- `bun run lint`: **0 error, 1 warning** — hanya warning LAMA TanStack Virtual (`react-hooks/incompatible-library`, finance-transactions.tsx:255, bergeser dari :247 karena komentar baru). Tidak ada warning/error baru.
- `bunx tsc --noEmit`: **0 error di semua 7 file yang diedit**. Total repo 20 error (turun dari 24 baseline — 4 error work-board.tsx hilang karena agen paralel menfixnya di sesi yang sama; bukan efek perubahan saya).
- dev.log: tidak ada "Failed to compile"/"Type error"/"Module not found" pasca-edit; dev server tetap jalan (tidak direstart).
- Tidak ada file luar daftar yang diedit oleh agen ini (git diff bersih dari nama lain; use-habit-completions.ts & work-board.tsx adalah editan agen paralel).
