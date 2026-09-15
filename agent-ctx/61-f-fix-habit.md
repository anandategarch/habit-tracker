# Task 61-f — Fix Habit/Tracker/Pohon/Meja Kerja (general-purpose agent)

Scope edit (semua di dalam daftar file yang diizinkan): `work-board.tsx`, `use-habit-completions.ts`, `habit-master.tsx`, `today-habits.tsx`, `pohon-screen.tsx`, `hourly-consistency.tsx`, `daily-tracker-habit-card.tsx`, `habit-mobile-cards.tsx`, `finance-tx-dialog.tsx`, `goal-form-dialog.tsx`. Tidak menyentuh DB/schema/kontrak API/kalkulasi/TZ. Tanpa dependency baru.

## Fix yang diterapkan

1. **[P1-crash] work-board.tsx:574-582** — `board.stats.todo/jalan/nunggu/selesaiHariIni` kini di-guard (`board ? … : 0`) untuk `totalOpen` & `doneCount`. Dulu: fetch gagal tanpa cache (React Query v5 → `isLoading=false`, `board=undefined`) → TypeError saat render, tab Meja Kerja crash SEBELUM kartu error `showBoardError` tampil. Derivasi `summaryText` jadi aman; JSX `{board && …}` tidak berubah.
2. **[P1-data] use-habit-completions.ts:152-182** — fetch `/api/habits/batch-logs` gagal (network error / !res.ok / JSON rusak) kini di-track via `fetchFailed`; saat gagal: `return` SEBELUM menulis `monthLogsCacheRef`/`cachedMonthRef`/`cachedRefreshKeyRef` dan SEBELUM `setCompletionMap/setCompletedAtMap/setAmountValueMap` → peta completion lama utuh (tidak dinolkan) + cache bulan tidak tertulis kosong (tidak teracun) → muat ulang berikutnya mencoba fetch lagi. Guard RACE-1 `isCancelled` tetap dievaluasi lebih dulu. State gagal sengaja sederhana (tanpa UI error baru), sesuai instruksi fix minimal.
3. **[P2] habit-master.tsx — invalidasi `['habits']` di 5 jalur sukses mutation** (fix list meminta 4; jalur ke-5 adalah create sejenis dalam rentang baris yang dirujuk):
   - `:404` edit (handleSubmit, update path) — setelah setQueryData.
   - `:419` create (handleSubmit, create path) — setelah setQueryData, sebelum pemulangan tab quick-add.
   - `:488` handleToggleStatus — setelah `res.ok`, sebelum toast.
   - `:513` handleArchive — setelah `res.ok`, sebelum toast.
   - `:558` handleQuickAdd (EXTRA, create ke-5 di baris ±356-520) — kelas bug sama (setQueryData optimistik tak pernah direkonsiliasi server).
   Catatan: jalur error tetap memanggil `invalidateHabits()` (tidak berubah). `handleDelete` TIDAK diubah (tidak masuk fix list; sudah punya invalidasi `habit-logs-batch`/`daily-logs-month` — kandidat lanjutan bila mau).
4. **[P2-UX] habit-master.tsx:247-268 handleDialogOpenChange** — saat `!open` dan dialog dibuka via quick-add (`openedViaQuickAddRef.current && quickAddReturnTab`) → `setActiveTab(quickAddReturnTab)` sebelum `clearQuickAddReturn()`; flag sesi direset `openedViaQuickAddRef.current = false`. Jalur SIMPAN tidak dobel-restore (handleSubmit memanggil `setDialogOpen(false)` langsung, bukan handler ini, dan sudah clearQuickAddReturn lebih dulu). Batal/X/Escape/overlay kini memulangkan user dari 3 pintu masuk quick-add (FAB page.tsx, dashboard, daily-tracker) tanpa perlu mengubah file pintu masuk itu.
5. **[P2] today-habits.tsx:200-202** — span `rt-check-ripple` kini hanya dirender `{busy && (<span key={`ripple-${habit.id}`} …/>)}` (pola benar daily-tracker-habit-card.tsx:411-413). Dulu: render permanen → animasi 0.6s berjalan SAAT MOUNT untuk semua baris pending (kilau palsu tiap load Beranda). Kini ripple justru hidup di momen benar: saat tap (round-trip completion, `completingIds`).
6. **[P2] pohon-screen.tsx:166** — `todayStr = useJakartaToday()` (import `@/components/habit-tracker/use-jakarta-today`, pola dashboard/daily-tracker/progress) menggantikan `jakartaDateString()` per-render. Tab Pohon yang terbuka melewati tengah malam WIB kini me-refresh "hari ini" (tick 30 dtk, re-render hanya saat YMD berganti). Import `jakartaDateString` lama dihapus (tidak ada pemakaian lain di file).
7. **[P3] pohon-screen.tsx:607** — track progress bar `bg-[#10362E]` → `bg-muted` (theme-aware) di kartu `bg-card` section Pertumbuhan. Fill gradient mint (baris 615) sengaja tidak diubah (by-design).
8. **[P2] hourly-consistency.tsx:148** — grid 24 sel jam: `grid-cols-12 gap-1.5` → `grid-cols-8 gap-1.5 sm:grid-cols-12`. @320px: ±15-18px/sel → ±30px/sel (3 baris) di mobile; ≥sm tetap 12 kolom (2 baris) seperti semula.
9. **[P2] daily-tracker-habit-card.tsx:316 + habit-mobile-cards.tsx:137** — chip tombol "Tujuan": `py-px` → `py-1` + `min-h-6` (24px). Chip non-interaktif tetap `py-px`. Visual tetap chip kecil.
10. **[P3] habit-mobile-cards.tsx:38** — `ACTION_BTN` `h-9 w-9` (36px) → `h-10 w-10` (40px) untuk Edit/Jeda/Arsip/HAPUS (guard pointer:coarse globals.css tidak mencocokkan h-9).
11. **[P3] habit-master.tsx:113+299-311+655** — popover emoji form: tutup saat `pointerdown` di luar wrapper input+popover (listener document + ref `emojiPickerWrapRef`, cleanup benar, hanya aktif saat popover terbuka). Bonus kecil terkait: `handleDialogOpenChange` juga `setFormEmojiPicker(false)` saat dialog ditutup (dulu popover bisa tersisa "terbuka" setelah Escape-close lalu muncul lagi saat dialog dibuka ulang).
12. **[P3] finance-tx-dialog.tsx:258 (+91-121)** — baris split: `key={idx}` → key stabil `splitKeys[idx]` (counter uid modul). `splitRows` dimiliki parent (use-finance-mutations, di luar daftar edit) tanpa id → dialog memelihara daftar key paralel: tambah/hapus via wrapper lokal `handleAddSplitRow`/`handleRemoveSplitRow` (splice idx persis), reset eksternal (dialog dibuka ulang) disinkronkan via pola adjust-state-during-render (pola `prevOpen` CalculatorDialog di file yang sama). Hapus baris tengah tidak lagi menukar identitas React antar baris (fokus/animasi tak lompat).
13. **[P3] goal-form-dialog.tsx:217 + 55-61, 69-70, 78** — baris milestone: `key={i}` → `key={m._key}` (type lokal `LocalMilestone = GoalMilestone & { _key: string }`, uid counter modul; `_key` otomatis dilepas saat submit karena `cleanMilestones` hanya memetakan `text`+`done`). **goal-form-dialog.tsx:221-239** — checkbox milestone: wrapper hit-area `grid h-11 w-11 place-items-center` (44px) dengan visual 20px sebagai anak `span` — pola goal-card.tsx:380-401.

## Item yang di-SKIP

- **Item 12 [P3] — sembunyikan segmen filter kategori saat chip "Semua" yatim.** Dua alasan: (a) markup segmen (`role="group" aria-label="Filter kategori habit"`, `premium-segment`) ada di **habit-filters.tsx:66-103 — BUKAN file yang boleh saya edit** (FiltersBar adalah sub-komponen terpisah; dari habit-master.tsx tidak ada prop untuk menyembunyikan segmen tersebut tanpa mengubah interface-nya). (b) Verifikasi kode menunjukkan kondisi pemicu di fix list (`groups.length === 0`) TIDAK sesuai sumber data segmen: chip kategori berasal dari `categories` (prop `useHabitOptions()` → `/api/habit-options`), bukan `groups` (habit-groups). Di environment ini `GET /api/habit-options` memang mengembalikan `{"options":[]}` (dicek via curl, read-only) sehingga segmen hanya berisi chip "Semua" — kejadian live 61-b valid, tapi fix yang benar adalah `{categories.length > 0 && (…)}` pada segmen kategori di **habit-filters.tsx** (one-line guard), di luar wewenang saya.

## Verifikasi

- `bun run lint`: **0 error, 1 warning** — hanya warning LAMA TanStack Virtual di finance-transactions.tsx:255 (baseline). Tidak ada warning/error baru.
- `bunx tsc --noEmit`: **0 error di semua 10 file yang diedit**. Total error tinggal 20 (baseline disebut 26 — kini lebih sedikit karena agen paralel/fix lain; sisanya di file baseline lama: scripts/seed-local-test, skills/*, work-assistant, daily-tracker dnd-kit). Tidak ada error baru dari edit saya.
- Dev server :3000 tetap hidup (tidak direstart); `GET /` → HTTP 200, tidak ada compile error di dev.log. Tidak ada commit/push.
- Catatan lingkungan: repo sedang diedit agen paralel (file lain berubah di git diff); semua perubahan saya hanya pada 10 file yang diizinkan.

## Saran tindak lanjut (di luar scope saya)

1. habit-filters.tsx — `{categories.length > 0 && …}` untuk segmen kategori (item 12 yang di-skip).
2. habit-master.tsx handleDelete — pertimbangkan invalidasi `['habits']` pasca-delete (kelas sama dengan item 3, sengaja tidak disentuh karena di luar fix list).
