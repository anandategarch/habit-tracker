# Task 61-h — API fixer (general-purpose)

Fix list 61-c dieksekusi terhadap 14 file yang diizinkan. **12 fix diterapkan, 2 SKIP** (#13, #14 — EVAL-HATI2). Kontrak API tidak berubah; satu-satunya perubahan bentuk response = field ADDITIF `balance` di PUT sources/[id] (#11, diizinkan eksplisit). Schema/DB tidak disentuh; tidak ada commit/push; dev server tidak direstart.

## Fix diterapkan

1. **[P2-1] `work/ai/route.ts:139-167` + `ai-insights/route.ts:349-397` — floating LLM promise + timer tak di-clear.**
   `llmPromise.catch(() => {})` no-op dipasang SEBELUM race (menelan rejeksi yang kalah race; `Promise.race` tetap memasang handler sendiri → hasil race/rejection yang sampai ke caller TIDAK berubah). Timer id disimpan (`let timeoutId`) → `clearTimeout(timeoutId)` di `finally` — race+parse dibungkus `try { … } finally { … }` tepat di sekitar `await Promise.race(...)`. Semua path error (timeout maupun error SDK) tetap terpropagasi ke catch yang sama seperti sebelumnya.

2. **[P2-4] `finance/sources/[id]/route.ts:104-141` (PATCH quick-edit saldo) — read-modify-write → SATU interactive `$transaction`.**
   Mirror pola 60-b `savings-goals/[id]`: `db.$transaction(async (tx: Prisma.TransactionClient) => …)` berisi re-read `fresh` source → `tx.fundSource.findMany` (id+initialBalance) → `tx.transaction.findMany` (where sourceId=id, select TxLike) → `computeSourceBalances` (fungsi sama dengan GET) → hitung `net`/`newInitial` → `tx.fundSource.update`. Query di dalam transaksi dijalankan SEKUENSIAL (tidak ada Promise.all dalam transaksi — menyamai seluruh route $transaction yang ada). `fresh === null` → return null → `notFound` di luar (pola 60-b). Response `{...updated, balance: target, adjustment: null}` — identik persis.

3. **[P3-1] `finance/budgets/[id]/route.ts:46-56` — P2002 saat PUT kini → 409** (`new ApiError(409, 'Budget untuk kategori dan bulan tersebut sudah ada')`), konsisten dengan POST fix 60-b. FE membaca `err.error` pada `!res.ok` → aman.

4. **[P3-2] `finance/transfer/route.ts:44-47` — amount di-cap `> 1e12 → 400 'Jumlah transfer tidak valid'`** (selaras transactions POST/split).

5. **[P3-3+P3-4] `finance/transactions/split/route.ts:100-118` —**
   :115 fallback tanggal kini `dateFromYMDNoon(jakartaDateString())` (impor `jakartaDateString` dari `@/lib/timezone`) — bukan `new Date().toISOString().slice(0,10)` (UTC) yang bisa kemarin saat WIB 00:00–06:59.
   :108 cabang date asing (bukan YMD / bukan ISO `YYYY-MM-DDTHH:mm`) kini DITOLAK `400 'Format tanggal tidak valid (yyyy-MM-dd)'` — konsisten dengan konvensi `parseTransactionFields` di transactions POST/PUT (jalur lain menolak format asing); dulunya epoch mentah tersimpan.

6. **[P3-10] `habits/[id]/route.ts:39-51` (`reconcileVacationIntervals`)** — saat mode NYALA dari mati (`!habit.vacationMode`) dan body TIDAK mengirim `vacationUntil` (`untilRaw === undefined`) → `data.vacationUntil = null` eksplisit. Kolom basi (tanggal lewat) tak lagi membuat `expireHabitVacations` mematikan mode lagi pada GET berikutnya. `habit-ensure.ts:128` sengaja TIDAK diubah — perilaku expire-nya benar begitu kolom dibersihkan saat interval dibuka (fix ada di titik pembuka interval, sesuai instruksi).

7. **[P3-12+P3-13] `data/import/route.ts` —**
   :184-195 catch transaksi kini HANYA memetakan `Prisma.PrismaClientKnownRequestError` (P2xxx — unik/FK/record) → 400; error lain (DB down/koneksi/infra) di-rethrow → `handleApiError` → 500 generik. (Diverifikasi runtime: `Prisma.PrismaClientKnownRequestError` tersedia di @prisma/client 6.19.2.) Passthrough `'status' in txError` (ApiError) tetap.
   :138-168 id Goal/HabitGroup yang diimpor dikumpulkan ke Set SEBELUM loop insert habit (mirror pola `pairLinks` transaksi) → `habit.goalId`/`habit.groupId` yang tujuannya tidak ikut diimpor DINOLKAN (tidak lagi tersimpan menggantung).

8. **[P3-8] `goals/[id]/route.ts:72-81` (DELETE)** — `db.$transaction([db.habit.updateMany(…goalId:null), db.goal.delete(…)])` bentuk array → atomik.

9. **[P3-11] `data/seed/route.ts:15-73`** — guard "sudah ada data" kini menghitung 5 tabel Meja Kerja (`workRoutines`, `workRoutineLogs`, `workTasks`, `workNotes`, `workDayFlags`) + `budgetSnapshots`; `await ensureWorkTables()` ditambahkan sebelum count supaya DB produksi segar tidak 500 (tabel DDL runtime). seedDemoData memang meng-delete semua tabel itu → guard kini konsisten.

10. **[P3-6] `finance/sources/route.ts:76-88` (POST)** — guard `findFirst({ where: { name } })` → `400 'Nama sumber dana sudah dipakai'` (exact-match, menyamai resolve by-name `findFirst` di `parseTransactionFields`). DICEK AMAN: import/seed/GET-trio-default memakai `db.fundSource.create`/`create` langsung (bukan route ini) → tak terdampak; FE (use-finance-mutations.ts:566) menampilkan `err.error` via toast pada `!res.ok`.

11. **[P3-7] `finance/sources/[id]/route.ts:69-84` (PUT)** — response kini `{ ...updated, balance }` dengan balance terhitung via `computeSourceBalances` (sumber semua + transaksi sourceId=id, fungsi sama dengan GET/PATCH; dibulatkan 2 desimal seperti GET). Field ADDITIF (diizinkan instruksi #11).

12. **[P3-20] `_lib/habit-fields.ts:109-113`** — setelah blok `'targetDays' in body`: `if (body.habitType === 'avoid') data.targetDays = null;` → switch habitType→avoid TANPA mengirim targetDays ikut membersihkan nilai lama (habit avoid tak bisa "lulus" via targetDays basi). Create-path tetap ditangani guard lama di dalam blok.

## SKIP (+ alasan)

- **#13 [P2-2] `finance/transactions/route.ts:64` GET tanpa `take`** — SKIP karena "bentuk response 100% identik" tidak dapat dijamin: (a) filter `search` dijalankan di JS (lowercase `includes` + kecocokan NAMA SUMBER) — tidak bisa direplikasi ke SQL Prisma/SQLite tanpa perubahan semantik (LIKE case-folding non-ASCII, wildcard `%`/`_` literal di query user); totals via `aggregate` butuh filter yang sama; (b) `buildTransferMeta(rows…)` dibangun dari SEMUA baris transfer yang cocok filter — dengan `take`, pasangan transfer di luar limit hilang → `transferPairId`/`transferDirection`/`pairedSourceName` baris dalam limit berubah; (c) penjumlahan float SQL vs JS reduce bisa berbeda urutan → pembulatan `totalIncome/totalExpense` berisiko beda di batas .5. Volume single-user kecil (opsi B di laporan audit). File dibiarkan utuh.
- **#14 [P2-3] `finance/sources/route.ts:59` scan penuh** — SKIP: baris itu adalah kalkulasi SALDO (initialBalance + seluruh transaksi all-time) — membatasi `date: { gte: monthStart }` akan menghasilkan saldo SALAH (audit 61-c sendiri menulis "saldo sources biarkan (kalkulasi READ-ONLY)"). `monthTx` yang memang bisa dibatasi gte sudah difilter sejak awal di `ai-insights/route.ts:113` dan pemilik `monthTx` satunya (`dashboard/route.ts`) tidak ada di daftar file yang boleh diedit.

## Verifikasi

- `bun run lint`: **0 error, 1 warning** — persis baseline (TanStack Virtual `finance-transactions.tsx:255`, warning lama). Tidak ada warning/error baru.
- `bunx tsc --noEmit`: **0 error di seluruh `src/app/api/**`** (14 file yang diedit bersih). Sisa error hanya baseline lama di `scripts/seed-local-test.ts`, `skills/*`, `work-assistant.tsx`, `daily-tracker*.tsx` (dnd kit) — 20 baris error saat run ini, lebih kecil dari baseline 26 (variansi file `.next/dev/types` yang diregenerasi dev server; tidak ada error baru).
- curl GET (semua 200, bentuk JSON seperti sebelumnya):
  - `/api/finance/sources` → 200 `{sources:[{…,balance}]}` (562 B)
  - `/api/finance/budgets` → 200 `{budgets:[]}`
  - `/api/finance/transactions?limit=5` → 200 `{transactions:[],totalIncome:0,totalExpense:0,truncated:false}`
  - `/api/ai-insights` → 200 `{insights:[…]}` (1042 B — route hasil restrukturisasi try/finally terbukti jalan; fallback statis tetap bekerja)
- Tidak ada POST/PUT/DELETE/PATCH ke API penulis DB; dev.log bersih dari error baru.

## Catatan untuk triase/ronde berikutnya

- PUT `finance/sources/[id]` rename ke nama yang sudah dipakai belum di-guard (instruksi #10 hanya minta POST) — kandidat fix kecil berikutnya, guard yang sama tinggal ditempel.
- `dashboard/route.ts` monthTx + prevRows/trendRows serial (P2-3/P3-15 di laporan 61-c) — di luar daftar izin task ini.
