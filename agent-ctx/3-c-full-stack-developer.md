# Task ID: 3-c — BUGHUNT-54 FIX (area Beranda/Progres/Tujuan/Pohon)

Agent: full-stack-developer (fix home/goals/tree) — lihat juga worklog.md section `Task ID: 3-c`.

## Ringkasan perbaikan (7 fix, komentar kode berprefix `// BUGHUNT-54 (3-c #N):`)

1. **#1a XP/level regresi saat habit dijeda** — `src/app/api/dashboard/route.ts`:
   query baru `xpHabits` (non-arsip: aktif+DIJEDA, select id+difficulty) di Promise.all;
   loop totalXp/todayXp kini iterasi `xpHabits` (bukan `habits` yang filter isActive).
   `habits` (isActive) tetap dipakai utk tracking/KPI/fokus → habit dijesa keluar rotasi harian.
2. **#1b worstHabit vacation-aware** — route.ts loop `rates`: `if (h.vacationMode) continue;`
   → habit libur bukan kandidat best/worst (sinyal "Daun Menguning" tak bertabrakan dgn "Dorman").
3. **#2 semantik avoid di Beranda** — `dashboard.tsx`: `todayCompleted` dihitung ulang dari
   `todayHabits` dgn `habitType === 'avoid' ? !completed : completed` (hero + TreeProgress
   growth ikut benar via props). `today-habits.tsx`: badge "X/Y selesai" pakai `successCount`
   (semantik sama) + perayaan "Semua selesai 🌳" hanya bila SEMUA habit berhasil.
   `today-hero.tsx`: TIDAK diubah (murni props; fixnya di sumber data dashboard.tsx).
4. **#3 goals deep-link gating** — `goals.tsx`: efek openGoalFocus dipindah di bawah query
   ['goals'] + gate `if (list.length === 0 && isLoading) return;` (pola daily-tracker 47-d #2);
   deps `list, isLoading` agar fokus tertunda sampai data siap; consume-and-clear dipertahankan.
5. **#4 label rate jujur** — `tree-card.tsx` (Beranda period 'all'): "Rawat: X (N% sejak awal)"
   + aria-label. `tree-growth-path.tsx`: prop baru `ratePeriodLabel` → activeText daun-kuning
   dinamis. `progress.tsx`: `careRatePeriodLabel` dari `progressPeriod` (7d/1m/3m/all).
6. **#5 level ASLI + fetchError** — `tree-card.tsx`: prop `level` (kpi currentLevel) utk label
   "Pohonmu · Level N" + aria-label (bukan stage.levelLabel). `dashboard.tsx`: TreeCard
   dirender `{data && (...)}` — pohon fabricated (DEFAULT_DATA) disembunyikan saat fetchError.
7. **#6 count-up** — `count-up.tsx`: mount pertama set langsung target (tanpa animasi);
   perubahan berikutnya interpolasi `from + (target - from) * eased` dari displayRef
   (nilai display SEBELUMNYA), bukan dari 0. Tanpa setState sinkron di body efek
   (patuh react-hooks/set-state-in-effect).
8. **#7 insight hari terbaik** — `progress.tsx`: gate `weeklyChartData.some(d => d.rate > 0)`
   (bentuk data post-contract hanya punya rate; rate>0 ⟺ ada penyelesaian nyata minggu itu).

## Verifikasi (ringkas)
- XP pause-test: baseline 20 → +2 log Hard = 60 → PAUSED kedua habit uji → **tetap 60** di
  4 periode (7/30/90/all) — dulu akan turun 20. Cleanup → kembali 20. (habit uji VERIFY-54-3c dihapus)
- worstHabit vacation-test: habit rate-0 di-set vacationMode → worst berpindah ke habit
  non-libur (Baca Buku), bukan habit libur. Dikembalikan.
- E2E agent-browser: avoid kambuh → hero "2 dari 5 (40%)" (bukan 3/5), badge "2/5 selesai",
  tanpa perayaan palsu, chip "Tercatat" netral; tree card "Pohonmu — tahap Benih, Level 1";
  care chip "(0% sejak awal)" di Beranda → "(7 hari)" setelah ganti periode Progres;
  insight "Hari terbaik: Jumat (100%)" (data nyata). 0 page error, 0 console error.
- `bun run lint`: 0 error (1 warning TanStack Virtual pre-existing). tsc: 0 error baru di file saya.
- curl `/` = 200. dev.log: tanpa compile error dari file saya. Data uji dibersihkan (4 habit asli utuh).

## Catatan untuk agent lain
- Saya TIDAK menyentuh: prisma/schema, habit-ensure, dashboard-helpers, timezone, tree-growth.ts,
  api/habits/route.ts (milik agent paralel), public/tree/*.svg, daily-tracker-habit-grid.tsx
  ( sempat parse-error saat saya verifikasi — sudah diperbaiki agent lain).
- Kontrak respons /api/dashboard TIDAK berubah (xpHabits hanya query internal; tanpa field baru).
- Contract.ts `todayCompletedCount` tetap (semantik "logged") — dashboard.tsx tidak lagi
  memakainya; tidak ada konsumen lain.
