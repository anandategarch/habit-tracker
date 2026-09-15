# Task 61-d — Audit State Management & Data Flow (statis)

Agent: Explore (state/data-flow) · REPORT-ONLY (tidak ada edit source/commit/DB)
Metode: baca menyeluruh semua file scope + grep silang seluruh pemakaian
`useQuery`/`useMutation`/`invalidateQueries`/`setQueryData`/`setInterval` di `src/**`.

Scope yang diperiksa: `src/store/app-store.ts`, `src/hooks/*` (use-finance-mutations,
use-habit-options, use-toast, use-theme-color, use-mobile), `use-jakarta-today.ts`,
`use-habit-toggle.ts`, `use-habit-completions.ts`, `providers.tsx`, `use-work-api.ts`,
dan konsumen: daily-tracker, dashboard, finance(+semua sub-tab), calendar-view,
habit-master, settings, goals, progress, pohon-screen/tree-card, work-desk/board/
today/assistant, daily-check-in-card, label-manager, time-analysis, hourly-consistency,
weekly-review, source-balance, finance-today-card, finance-analysis, finance-recurring,
finance-rules, finance-savings-goals, goal-form-dialog, `app/page.tsx`, `app/layout.tsx`.

Baseline dihormati: ±85 fix Task 39/47/54/59/60/60-b TIDAK dilaporkan ulang
(semua pola yang dulu diperbaiki — race RACE-1, guard in-flight, rollback optimistik
work/finance, TZ Jakarta, H2 notes flush, dst. — terverifikasi masih utuh).

---

## Verifikasi positif (sehat — tidak perlu aksi)

1. **Store BUKAN persist.** `app-store.ts` tidak memakai middleware persist sama
   sekali (deskripsi task menyebut "Zustand (persist)" — tidak terjadi di kode).
   Isinya murni state UI/navigasi (tab, tanggal, filter, flag konsumsi-sekali);
   tidak ada data server yang disimpan di store → tidak ada risiko hydration
   mismatch persist / versi migrate hilang / dua sumber kebenaran server.
2. **providers.tsx** — QueryClient dibuat via `useState(() => new QueryClient(...))`
   (pola SSR benar). Default: `staleTime 30s, retry 1, refetchOnWindowFocus false`.
   `refetchOnWindowFocus:false` adalah pilihan sadar (komentar eksplisit);
   penyegaran data lewat pull-to-refresh (`page.tsx handleRefresh` — urutan
   triggerRefresh→invalidate sudah benar anti double-fetch) + tombol refresh +
   invalidasi mutasi. Tidak ada staleTime/gcTime ekstrem.
3. **use-work-api.ts** — mutasi optimistik teladan: `onMutate` selalu
   `cancelQueries` → snapshot `prev` → `setQueryData` → `onError` rollback
   `ctx.prev` → `onSettled` invalidate prefix penuh `['work']`. Semua 5 mutasi
   optimistik (setTaskStatus, toggleRoutineLog, toggleTaskDone, toggleNoteCheck,
   toggleNotePin) konsisten. Tidak ditemukan optimistic tanpa rollback.
4. **Peta queryKey ↔ invalidasi koheren.** Semua key finance berprefix `['finance']`
   (sources/categories/transactions/budgets/dashboard/rules/recurring/savings/
   daily-recap/last-done) dan semua mutasi finance memanggil
   `invalidateQueries(['finance'])` → tidak ada mismatch string-vs-array. Ekosistem
   habit (toggle/graduate/check-in/complete-from-home) memanggil set invalidasi
   identik 8 key (`habits, dashboard, habit-logs-batch, daily-logs-month,
   time-analysis, habit-meta, ai-insights, hourly-consistency`). `['dashboard',…]`
   prefix-match menutup semua varian (period/refreshKey/retryCount).
5. **Guard race & double-submit** — in-flight per-habit (`inFlightRef` dibagi
   toggle+stepper), `submitGuard` di finance, `quickPendingRef` di savings,
   FIFO promise-chain di check-in card, `isCancelled` di fetch completions,
   debounce notes dengan flush keepalive (BUG-19/H2) — semuanya benar.
6. **Disiplin timezone** konsisten (`lib/timezone` + `lib/date-utils` UTC +
   `todayYMD()` Jakarta); `useJakartaToday` men-tick lintas tengah malam WIB.

---

## TEMUAN

### [P1] `src/components/habit-tracker/use-habit-completions.ts:152-196` — kegagalan fetch batch-logs ditelan → peta completion dinolkan + cache bulan DIPERACUN (semua habit tampak belum selesai sebulan penuh, tanpa error apa pun)

`fetchCompletions` membungkus fetch dengan `try { if (res.ok) … } catch {}` lalu
**tetap melanjutkan**: `groupedLogs = {}` → semua habit dipetakan `completed:false,
value:0`, `monthLogsCacheRef[month]` ditulis kosong, `cachedMonthRef = month`,
`cachedRefreshKeyRef = refreshKey`. Akibat:
- Kegagalan jaringan/500 sesaat → grid tracker, KPI X/Y, XP hari ini, streak,
  banner Kembali, kalender dots — semua menampilkan "0 selesai" untuk tanggal
  itu; TIDAK ada error UI (efek loading hanya set loading=false; `isError` tidak
  pernah diperiksa di sini).
- **Cache jadi racun**: navigasi tanggal lain dalam bulan yang sama kena
  cache-hit (guard `cachedMonthRef === month && cache ada && refreshKey sama`)
  → data salah bertahan sampai refreshKey berganti (pull-to-refresh/tombol
  refresh/CRUD habit) atau user keluar-masuk bulan (slot cache tunggal).
  User bisa saja me-re-toggle habit yang sebenarnya sudah selesai (mengubah
  completedAt di DB).
Saran: bila `!res.ok` atau throw → jangan tulis cache, jangan replace map
(pertahankan state lama), set flag error + toast/inline retry (pola `retryFetch`
calendar-view), atau minimal retry 1×. — Aman-diperbaiki? **ya** (lokal, tidak
menyentuh kontrak API).

### [P2] `src/components/habit-tracker/habit-master.tsx:356-404 (create/edit), 433-454 (toggle status), 456-476 (archive), 478-520 (quick-add)` — jalur SUKSES tidak pernah meng-invalidasi `['habits']`; cache optimistik tercemar field form & tak pernah direkonsiliasi

Setelah PUT/POST sukses: `setQueryData(['habits'], …)` + `triggerRefresh()` —
padahal `triggerRefresh` hanya membump `refreshKey` yang HANYA ada di queryKey
keluarga `dashboard/ai-insights/hourly-consistency`; **`['habits']` tidak memuat
refreshKey → tidak pernah di-refetch**. Dua akibat:
1. Objek cache hasil edit = spread payload FORM (`{ ...h, ...payload }`) →
   membawa field non-schema (`icon`, `status`, `scheduleKind`, `scheduleDays`,
   `scheduleDates`, `vacationEnd`, `reminder:''`) yang mengendap permanen di
   cache sampai invalidasi tak terkait (toggle habit, pull-to-refresh).
   Konsumen hari ini tidak membaca field itu (aman), tapi normalisasi server
   (dedup/sort jadwal, default startDate) tidak pernah mendarat.
2. Bila PUT sukses sebagian / server menormalkan beda, UI bohong sampai aksi lain.
Saran: tambah `queryClient.invalidateQueries({ queryKey: ['habits'] })` setelah
sukses (optimistik tetap untuk respons instan). — Aman-diperbaiki? **ya**.

### [P2] Pola sistemik `if (!res.ok) return [] / null` di `queryFn` — error server menjadi "data kosong" yang di-cache + empty-state palsu; contoh konkret: UI error kalender MATI

Instance: `calendar-view.tsx:213-217` (dailyLogs), `:230-243` (habitLogs),
`finance.tsx:269-272` (sources), `:336-340` (categories), `:408-411`
(transactions), `:428-432` (budgets), `daily-tracker.tsx:108-111` (goals),
`use-habit-options.ts:17`, `dashboard.tsx:174-176` (workData),
`source-balance.tsx:61-64`, `finance-overview` (via finance.tsx), dst.
`use-work-api.jsonFetch` sudah benar (melempar Error). Konsekuensi: pada jaringan
flaky, kegagalan fetch dirender sebagai "Belum ada transaksi/habit/tujuan…"
bukan error; hasil kosong dianggap sukses → di-cache staleTime (15–60s), dan
karena `refetchOnWindowFocus:false`, hanya invalidasi/remount yang menyegarkan.
**Contoh paling nyata:** `calendar-view.tsx:228` mendestruktur
`isError: fetchError` dan merender kartu "Gagal memuat + Coba Lagi"
(`retryFetch`), tetapi queryFn-nya `return []` saat gagal → `isError` TIDAK
PERNAH true → UI error itu dead code.
Saran: pada instance yang punya UI error (calendar-view), ubah queryFn menjadi
`throw`; instance lain boleh bertahap. — Aman-diperbaiki? **ya, per komponen**
(perlu cek empty-state masing-masing).

### [P3] `src/components/habit-tracker/daily-tracker.tsx:216-218, 540-599` — override lokal urutan habit (dual source) dilepas setelah 200ms fixed

`localHabitsOverride` men-shadow `queryHabits`; setelah `invalidateQueries` sukses,
`setTimeout(() => setLocalHabitsOverride(null), 200)` — bila refetch >200ms/gagal,
urutan UI balik ke cache lama sesaat (flicker) atau sampai refetch lain;
`toggleDragMode(false)` juga langsung membuang override saat PUT masih in-flight
(dikomentari sebagai kompromi). Self-healing, low impact. — Aman-diperbaiki?
ya-tapi-rendah (alternatif: pertahankan override sampai `dataUpdatedAt` berubah).

### [P3] `src/components/habit-tracker/use-habit-completions.ts:199-217` × `use-habit-toggle.ts` — refetch `['habits']` yang mendarat saat toggle lain in-flight membangun-ulang peta dari cache → centang optimistik habit ke-2 "kedip" hilang sejenak

Setelah toggle A sukses → `invalidateQueries(['habits'])` → refetch; bila user
men-toggle B sebelum refetch mendarat, array habits baru → efek re-run →
cache-hit → `setCompletionMap(dari cache)` menimpa optimistik B (cache baru
ditulis setelah POST B resolve). Kedip <300ms dan self-healing. — Aman-diperbaiki?
opsional (mis. lewati rebuild bila ada `togglingIds` aktif).

### [P3] `src/hooks/use-toast.ts` + `src/components/ui/toaster.tsx` — dead code (~230 baris)

Satu-satunya konsumen `useToast` adalah `ui/toaster.tsx`, dan `Toaster` itu
tidak pernah dipasang — `app/layout.tsx:8,76` memakai `Toaster` sonner (komentar
layout sendiri menyatakan radix toaster "tidak punya konsumen"). `TOAST_REMOVE_
DELAY = 1000000` dkk. jadi moot. — Aman-diperbaiki? ya (hapus berdua; jangan
dihapus bila ingin dipertahankan untuk regenerasi shadcn).

### [P3] Duplikasi mekanisme "hari ini hidup" — 5 implementasi interval terpisah vs `use-jakarta-today.ts`

`use-jakarta-today.ts` (30s) hanya dipakai daily-tracker/dashboard/progress;
`work-desk.tsx:30-34` (60s), `finance-today-card.tsx:87-92` (60s),
`page.tsx:331-340` (dateString, 60s), `today-hero.tsx:43-48` (minute-tick),
`pohon-screen.tsx:317` (60s) masing-masing roll-their-own. Semua Jakarta-benar
dan punya cleanup — tidak ada bug; hanya konsistensi + 5 timer aktif paralel.
Tidak ada `visibilitychange` listener di mana pun (item #10 task): dengan
throttling browser (~1×/menit di tab hidden) tick tetap jalan, jadi keterlamban
maksimal ±60 detik setelah kembali ke tab — dapat diterima; opsional tambah
listener bila ingin instan. — Aman-diperbaiki? ya (konsolidasi ke hook bersama).

### [P3] `src/hooks/use-finance-mutations.ts:632` — deps `handleSaveBalance` keliru isi

Body memakai `invalidateFinance()` (:617) tapi deps `[balanceEditValue,
getActiveSources, queryClient]` — `queryClient` tidak dipakai di body,
`invalidateFinance` tidak dimasukkan. Hari ini aman karena `invalidateFinance`
stabil (deps-nya stabil), tapi rentan jadi stale closure bila depsnya berubah.
— Aman-diperbaiki? ya (one-liner).

### [P3] `src/components/habit-tracker/settings.tsx:144-153` — efek sinkron settings→form dapat menimpa ketikan yang sedang berjalan

`handleSave` → invalidate `['settings']` → refetch mendarat ±0.5s kemudian →
`setForm(server)` menimpa apa pun yang diketik user di jendela itu; juga akan
menimpa bila ada invalidasi `['settings']` lain saat form sedang diedit (belum
ada hari ini). — Aman-diperbaiki? ya (guard dirty / bandingkan field).

### [P3] `src/components/habit-tracker/goals.tsx:87` — `['dashboard','all',refreshKey,0]` hardcode retryCount

Ini persis bug yang diperbaiki di pohon (Task 60-a #2b, lihat komentar
`pohon-screen.tsx:165-171`) tapi goals.tsx terlewat: setelah "Coba Lagi" di
Beranda menaikkan retryCount-nya sendiri, key goals bercabang → cache ganda +
fetch duplikat. — Aman-diperbaiki? ya (gunakan state retryCount lokal seperti
pohon, atau langsung 0→hapus elemen bila tak ada retry UI).

### [P3] `src/components/habit-tracker/daily-tracker.tsx:723-749` — `bestStreak`/`comeback` tidak dihitung ulang saat log BACKDATED masuk cache

Log manual via dialog waktu (`dateOverride` ≠ tanggal tampilan) memutasi
`monthLogsCacheRef` tanpa menyentuh `completionMap` → memo `bestStreak`
(deps `[activeHabits, selectedDate, completionMap]`) tidak re-run → angka streak
stale sampai perubahan state lain. — Aman-diperbaiki? ya-tapi-rendah (tambah
nonce bump setelah toggle sukses non-view-date).

---

## Totals & rekomendasi

| Prioritas | Jumlah |
|---|---|
| P0 | 0 |
| P1 | 1 |
| P2 | 3 |
| P3 | 8 |
| **Total** | **12** |

**Top-5 layak fix (urutan):**
1. **P1 use-habit-completions** — jangan telan kegagalan batch-logs + jangan
   tulis cache kosong (satu-satunya temuan yang membuat data tampil salah
   persisten).
2. **P2 habit-master** — tambah `invalidateQueries(['habits'])` di 4 jalur sukses
   (murah, menutup polusi cache + non-rekonsiliasi).
3. **P2 pola `return []` saat !res.ok** — mulai dari calendar-view (menghidupkan
   UI error yang sudah ada tapi dead), lalu bertahap di query ber-UI-error lain.
4. **P3 use-finance-mutations deps** — one-liner `queryClient`→`invalidateFinance`.
5. **P3 dead code use-toast/toaster** — bersihkan 2 file (~230 baris).

Catatan untuk perbaik nanti: semua temuan bersifat client-side; tidak ada yang
menyentuh kontrak API, skema, atau aturan bisnis. Temuan P2#2 & P2#3 sebaiknya
digabung satu commit "invalidasi & error-state konsisten".
