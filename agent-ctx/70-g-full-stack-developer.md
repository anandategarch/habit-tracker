# Task 70-g — full-stack-developer (fix audit 70-a & 70-c)

Semua item dikerjakan; diff minimal, tanpa refactor, tanpa test code, tanpa
dependensi baru. File paralel jalur lain (muscle-map.tsx, exercise-editor.tsx,
gym-screen.tsx, gym-card.tsx, globals.css .mm-*, use-gym.ts,
api/gym/exercises/route.ts) TIDAK disentuh.

## Perubahan per file

1. src/app/api/dashboard/route.ts
   - (70-a M1) xpHabits: hapus `where: { isArchived: false }` → semua habit
     (aktif+dijeda+terarsip) dihitung totalXp/todayXp/weeklyXp/level. Komentar
     BUGHUNT-54 lama disesuaikan + penanda Task 70.
   - (70-c #5) monthTx: filter bulan berjalan pindah ke where Prisma
     (`date: transactionMonthRange(currentMonth)` — helper sama dengan route
     finance/dashboard; konvensi tanggal transaksi YMD-stabil-UTC membuat
     rentang [gte,lt) ekuivalen persis dengan filter startsWith lama).
     Saringan JS + var monthPrefix dihapus; output payload identik.
     allCompleted HabitLog all-time dibiarkan (dipakai XP/streak).

2. src/app/api/settings/route.ts
   - (70-c #4) getOrCreateSettings: select eksplisit (id, userName, theme,
     themeColor, weekStart, language, targetCompletion, updatedAt) TANPA
     appLockHash — GET tidak lagi mengekspos hash PIN. Konsumen klien
     di-grep dulu (providers, settings.tsx, use-theme-color, calendar-view,
     finance-spending-heatmap, category-explorer-detail-view) — semua field
     yang dipakai tetap ada. PUT tetap tidak menerima appLockHash;
     import/restore tetap boleh menulis kolom itu.

3. src/app/api/gym/route.ts
   - (70-c MAJOR) POST: HabitGroup "Gym" + 7 habit zona dibungkus SATU
     db.$transaction (pola CAS ala gym/exercises & recurring/process) dengan
     re-check habit zona DI DALAM transaksi; habitOption upsert (unique
     type_label) tetap di luar. Response shape {ok, created, total} sama.
   - (70-c MAJOR) GET zoneHabits: + orderBy { createdAt: 'asc' } supaya
     pemilihan habit per zona deterministik (terlama) bila terlanjur dobel.
   - (70-a m3) zoneStreak: computeStreakWithShields(doneDays, todayYmd, 0)
     — strict tanpa hari aman, paritas longestStreakDays. Import
     computeStreakFromSet diganti computeStreakWithShields (satu-satunya
     pemakai di file ini); default 2-hari-aman pemakai lain TIDAK berubah.

4. src/app/api/habits/[id]/logs/route.ts
   - (70-a m4) Guard completedAt: baca existingLog (findUnique
     habitId_date) sebelum menyusun update; completedAt=new Date() hanya
     saat baris BARU atau transisi false→true. Baris yang sudah
     completed=true di tanggal sama mempertahankan completedAt lama (jendela
     pump 2 jam tidak melebar). completedAt eksplisit dari body tetap
     menang; completed=false tetap me-null-kan.

5. src/components/habit-tracker/dashboard.tsx
   - (70-a m5) queryKey ['dashboard','all',refreshKey,retryCount,todayStr]
     — refetch otomatis saat YMD Jakarta berganti. todayStr sudah ada dari
     useJakartaToday (baris 90). Invalidasi prefix ['dashboard'] /
     ['dashboard','all'] tetap mencakup varian baru.

6. src/lib/muscle-map.ts
   - (70-a m2) bestWeek.totalSessions dari sesi ASLI
     (Σ zoneOwnWeekly zona misi + fbWeekly); zonesTouched & metTarget tetap
     dari peta efektif. Doc GymBestWeekPayload disesuaikan; tipe tidak
     berubah. (Hunk STATUS_BASE_OPACITY.neglected 0.28→0.36 di file yang
     sama MILIK JALUR PARALEL — bukan perubahan 70-g.)
   - gym-history.tsx TIDAK diubah: label "X sesi" kini akurat secara
     semantik setelah totalSessions dihitung dari sesi asli.

7. src/app/api/_lib/seed-data.ts
   - (70-c #3) Isi seedDemoData dibungkus db.$transaction(async (tx:
     Prisma.TransactionClient) => {...}, { timeout: 60_000 }); semua
     `await db.` → `await tx.`. Migrasi lurus (semua operasi CRUD Prisma;
     ensure-DDL tetap di route seed sebelum transaksi). Timeout 60 dtk
     dipilih (default 5 dtk terlalu ketat untuk ±250 insert berurutan di
     Turso remote).

## Verifikasi (read-only / live)
- bunx tsc --noEmit: 0 error pada 7 file yang diubah.
- bun -e (murni): 1 sesi fb → bestWeek {totalSessions:1, zonesTouched:6}
  (dulu 7); 1 fb + dada + kaki → totalSessions 3; strict streak 4/2 sesuai
  harapan; default computeStreakWithShields masih mengampu 1 bolongan (3).
- Live (dev server port 3000): GET /api/settings tanpa appLockHash; GET
  /api/gym zoneStreak == longestStreakDays tiap zona & bestWeek.totalSessions
  == lifetimeSessions; POST /api/gym idempoten dalam transaksi (created:0);
  GET /api/dashboard payload utuh; POST logs 5x (baru→set, re-tap→
  completedAt TETAP, uncheck→null, transisi→set baru, uncheck cleanup) —
  habit uji punggung ditinggalkan pada state netral completed=false.
- Seed diuji pada DB sementara /tmp (prisma db push + seedDemoData):
  commit sukses 483ms {habits:6, habitLogs:129, dailyLogs:14,
  transactions:85, goals:3}; DB sementara dihapus.

## Risiko untuk main thread
- queryKey Beranda kini berakhiran todayStr; pohon-screen.tsx & progress.tsx
  masih memakai key lama (['dashboard','all',refreshKey,retryCount]) — cache
  Beranda↔Pohon tidak lagi identik (fetch terpisah saat pertama kali), dan
  Pohon/Progres tetap butuh invalidasi/refocus untuk data pasca-tengah-malam.
  Disengaja sesuai batasan item 6 (hanya dashboard.tsx).
- xpHabits tanpa filter: todayXp/weeklyXp kini ikut menghitung log habit yang
  diarsipkan HARI INI/minggu ini (konsisten "log tetap sah"), bukan hanya
  totalXp — main thread bisa konfirmasi ini memang semantik yang diinginkan.
- Guard completedAt: baris legacy completed=true dengan completedAt=null
  dipertahankan null-nya saat re-tap (instruksi audit literal); uncheck→
  re-check akan men-set nilai baru.
- Race POST gym: transaksi mempersempit jendela race ke antara baca-tulis
  di dalam BEGIN..COMMIT (mutex koneksi adapter libsql); tanpa unique
  constraint muscleZone, teoritis masih ada celah mikro bila dua proses
  server berbeda menulis bersamaan — pertimbangkan unique constraint
  (muscleZone where not null) di masa depan.
- Seed timeout 60 dtk melebihi konvensi route lain (tanpa opsi) — dipilih
  sadar untuk keamanan Turso; bila ingin seragam, hapus opsinya.
