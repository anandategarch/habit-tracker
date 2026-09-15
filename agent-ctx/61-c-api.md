# Task 61-c — Audit API/backend (Explore, REPORT ONLY)

Scope: seluruh `src/app/api/**/route.ts` (46 file, 88 handler), `src/app/api/_lib/*.ts` (13 file), `src/lib/db.ts`, `src/lib/jakarta-date.ts`, `src/lib/timezone.ts`, `src/lib/date-utils.ts`. Audit statis (baca kode), server TIDAK disentuh penulis; tidak ada edit source.

**Totals: P0=0 · P1=0 · P2=4 · P3=20.** Tidak ditemukan bug yang merusak endpoint / kehilangan data pada alur aplikasi sendiri. Kualitas umum tinggi: 88/88 handler punya try/catch terpusat (`handleApiError`), `readJsonBody` menolak JSON invalid dengan 400, semua upsert memakai unique-key penuh (native ON CONFLICT → race-safe), error Prisma tidak pernah bocor ke client (500 generik), P2002 sudah ditangani di categories/habit-options/budgets-POST, dan pola ensure-DDL konsisten di semua route yang menyentuh kolom hasil DDL runtime.

Temuan yang SUDAH diperbaiki Task 60-b (recurring CAS, savings delta $transaction, year-logs ensure, maxDuration, notes 400, budgets P2002/P2025, import/export/reset 5 tabel Meja Kerja) TIDAK dilaporkan ulang.

---

## P2 — bug kecil / perf / risiko crash instance

### [P2-1] `src/app/api/work/ai/route.ts:139-146` + `src/app/api/ai-insights/route.ts:348-371` — floating promise kalah race → unhandledRejection
`Promise.race([llmPromise, timeoutPromise])`: bila timeout menang, `llmPromise` tetap menggantung TANPA handler. Jika panggilan SDK kemudian reject (network error setelah timeout), Node meng-emit `unhandledRejection` → default Node ≥15 melempar → instance lambda mati SETELAH response terkirim (cold start berikutnya; tidak korup data). Bonus: `setTimeout` tidak pernah di-clear → instance tetap hidup 20–45 dtk setelah response (boros waktu serverless).
**Saran (tanpa ubah kontrak):** tempel `llmPromise.catch(() => {})` sebagai no-op SEBELUM race (rejection yang menang tetap terpropagasi lewat race), dan `const t = setTimeout(...)` + `clearTimeout(t)` di `finally`. **Aman diperbaiki: ya** (murni internal, response tidak berubah).

### [P2-2] `src/app/api/finance/transactions/route.ts:64-88` (GET) — findMany tanpa `take`, limit dipotong di JS
`findMany` mengambil SEMUA baris cocok filter (satu bulan; atau SELURUH tabel saat `search` dikirim karena `month=null`), lalu `filtered.slice(0, limit)`. `limit` (default 500) tidak diteruskan ke DB. `totalIncome/totalExpense` memang butuh seluruh hasil filter, jadi fetch penuh dipertahankan demi totals.
**Saran:** opsi A (aman, tanpa ubah bentuk response): hitung totals via `aggregate`/`groupBy` terpisah + `findMany({ take: limit })` untuk baris; opsi B: biarkan (data single-user). **Aman diperbaiki: ya dengan hati-hati** (wajib regresi bentuk response `transactions/totalIncome/totalExpense/truncated`).

### [P2-3] Hot endpoint memindai seluruh tabel — `finance/sources/route.ts:59-65`, `dashboard/route.ts:87-99`, `ai-insights/route.ts:104-115`
- `GET /api/finance/sources`: `transaction.findMany` TANPA filter waktu (semua transaksi selamanya) untuk hitung saldo (sudah `select` parsial ✓).
- `GET /api/dashboard`: `habitLog.findMany({completed:true})` all-time (memang dibutuhkan XP/streak — READ-ONLY kalkulasi, tidak boleh dipangkas) + `transaction.findMany` income/expense all-time lalu difilter bulan di JS.
- `GET /api/ai-insights`: sama (`allLogs` all-time dibutuhkan streak penuh).
**Saran:** `monthTx` di dashboard/ai-insights BISA dibatasi SQL `date: { gte: monthStart }` dengan aman (konvensi storage Transaction = komponen UTC jam-dinding Jakarta, YMD JS filter identik dengan range SQL). `allLogs` & saldo sources biarkan (kalkulasi READ-ONLY). **Aman diperbaiki: sebagian ya** (hanya filter bulan transaksi; jangan sentuh query streak/XP).

### [P2-4] `src/app/api/finance/sources/[id]/route.ts:93-123` (PATCH quick-edit saldo) — read-modify-write TANPA $transaction
PATCH `{balance}` membaca net transaksi → hitung `newInitial` → `update`. Dua PATCH bersamaan = lost update (kelas bug sama persis dengan savings delta sebelum 60-b). App sendiri single-user + chip cepat berurutan → jarang, tapi pola perbaikan 60-b sudah terbukti di driver libsql.
**Saran:** pindahkan baca (findUnique source + tx + hitung) & tulis ke SATU interactive `prisma.$transaction` (mirror `savings-goals/[id]` mode delta). Bentuk response `{...updated, balance, adjustment}` tetap. **Aman diperbaiki: ya.**

---

## P3 — polish / konsistensi / edge API-only

### [P3-1] `finance/budgets/[id]/route.ts:48-50` — P2002 → 400, padahal POST (fix 60-b) → 409
Duplikat (category, month) saat PUT rename menghasilkan 400 "Budget untuk kategori dan bulan tersebut sudah ada", sedangkan POST 60-b mengembalikan 409. Inkonsistensi status internal untuk kondisi identik.
**Saran:** samakan PUT ke 409 (frontend membaca `err.error` pada `!res.ok` — status 400/409 sama-sama non-ok, aman). **Aman diperbaiki: ya.**

### [P3-2] `finance/transfer/route.ts:44` — amount tanpa batas atas
`requirePositiveNumber` hanya cek > 0; transactions POST/split mencap 1e12. Transfer 1e15 diterima → inkonsisten dengan guard nominal di jalur lain.
**Saran:** tambah `if (amount > 1e12) throw badRequest(...)` (validasi tambahan, non-breaking). **Aman: ya.**

### [P3-3] `finance/transactions/split/route.ts:113` — fallback tanggal pakai tanggal UTC
`dateFromYMDNoon(new Date().toISOString().slice(0, 10))` — WIB 00:00–06:59 UTC-date = kemarin → split tanpa `date` (API-only; FE selalu kirim) default ke tanggal yang salah.
**Saran:** ganti ke `jakartaDateString()`. **Aman: ya.**

### [P3-4] `finance/transactions/split/route.ts:108-111` — date string non-YMD/non-ISO disimpan epoch mentah
Cabang else menyimpan `new Date(rawDate)` apa adanya → melanggar konvensi storage "komponen UTC = jam dinding Jakarta" (bisa geser hari bila server TZ ≠ UTC dan format aneh).
**Saran:** normalisasi lewat `resolveDateAndTime`/tolak format asing dengan 400. **Aman: ya** (API-only path).

### [P3-5] `_lib/finance-fields.ts:139-143` — `time` tanpa `date` diabaikan senyap (mode update)
`if (mode === 'create' || 'date' in body)` — PUT `{time:'14:30'}` saja tidak berefek apa pun tanpa error. FE selalu kirim keduanya.
**Saran (opsional):** bila hanya `time` dikirim, terapkan pada tanggal baris existing. Ini penambahan perilaku, bukan break — **hati-hati, tidak wajib.**

### [P3-6] `finance/sources/route.ts:76-108` + `[id]/route.ts:22-73` — nama sumber duplikat tidak dicegah
`FundSource.name` TIDAK unique di schema (READ-ONLY, tak boleh diubah) → POST/PUT menerima nama kembar. `parseTransactionFields` resolve sumber by-ID lalu **by-name** (`findFirst`) → transaksi bisa tersimpan ke sumber yang salah (arbitrary pick).
**Saran:** guard ramah di POST/PUT: `findFirst({where:{name}})` → 400 "Nama sumber sudah dipakai" (validasi tambahan). **Aman: ya.**

### [P3-7] `finance/sources/[id]/route.ts:68-69` — response PUT tanpa `balance`
POST mengembalikan `{...source, balance}`; PUT mengembalikan baris mentah tanpa `balance`. Inkonsistensi bentuk response internal (FE invalidasi query, tidak membangunkan bug).
**Saran:** tambah `balance` hasil hitung ulang (field additif). **Aman: ya.**

### [P3-8] `goals/[id]/route.ts:75-76` — DELETE tidak atomik
`await db.habit.updateMany(...)` lalu `await db.goal.delete(...)` — dua round-trip terpisah; kegagalan di tengah meninggalkan goal tanpa link (self-heal via onDelete SetNull, dampak kecil).
**Saran:** bungkus `db.$transaction([...])` (pola habit-groups DELETE). **Aman: ya.**

### [P3-9] `habits/[id]/logs/route.ts:119` — create notes-only default `completed=true`
POST `{date, notes}` pada hari yang belum ada log membuat log baru `completed=true` (nilai default `?? true`). Semua caller app (use-habit-toggle ×2, dashboard) SELALU mengirim `completed` eksplisit → hanya jalur API langsung.
**Saran:** default `false` saat body tidak memuat `completed`/`value` — **hati-hati**: mengubah semantik create untuk pemanggil eksternal hipotetis; alternatif: dokumentasikan. **Aman: hati-hati.**

### [P3-10] `habits/[id]/route.ts:39-49` + `_lib/habit-ensure.ts:128-134` — re-enable liburan tanpa `vacationUntil` bisa ter-cancel otomatis
Skenario API-only: habit punya `vacationUntil` LAMA (sudah lewat, mode sudah auto-off, interval tercatat). PUT `{vacationMode:true}` TANPA `vacationUntil` → interval terbuka dibuka, tapi kolom `vacationUntil` basi (masih tanggal lama) → `expireHabitVacations` di GET berikutnya mematikan mode lagi (interval tetap tercatat, streak aman, tapi badge 🏖 libur padam sendiri). Form app selalu mengirim `vacationUntil: form.vacationEnd || null` → tak terjadi di UI.
**Saran:** di `reconcileVacationIntervals` saat membuka interval baru tanpa until → set `data.vacationUntil = null` (kolom ikut bersih). **Aman: ya.**

### [P3-11] `data/seed/route.ts:28-47` — guard tidak menghitung tabel Meja Kerja
`existing` menjumlahkan 13 tabel habit/keuangan/goal saja. User dengan HANYA data Meja Kerja (rutin/catatan/tugas) → seed demo diizinkan → data demo habit/keuangan tercampur data kerja nyata.
**Saran:** panggil `ensureWorkTables()` + tambahkan 5 count tabel work ke guard (dan opsional budgetSnapshot). **Aman: ya.**

### [P3-12] `data/import/route.ts:164-168` — semua kegagalan transaksi dipetakan 400
Catch luar transaksi mengubah SEMUA error non-ApiError menjadi 400 "Data impor tidak valid" — termasuk kegagalan infrastruktur (DB down) yang seharusnya 500 generik; menyesatkan diagnosis.
**Saran:** hanya map error Prisma known-request (P1xxx/P2xxx) → 400; sisanya rethrow → `handleApiError` 500 generik. **Aman: ya.**

### [P3-13] `data/import/route.ts:138-139` — goalId/groupId dangling tidak dinolkan
Mirror pola `pairLinks` transaksi TIDAK diterapkan untuk `habit.goalId`/`groupId`: backup yang memuat habit dengan goalId tujuan yang tidak ikut diimpor → FK menggantung → chip tujuan di UI kehilangan sumber (goal lookup null).
**Saran:** kumpulkan id Goal/HabitGroup yang diimpor, null-kan referensi tak dikenal saat insert habit. **Aman: ya.**

### [P3-14] GET yang menulis (intentional, dokumentasikan) — `habits:GET`+`dashboard:GET` (expireHabitVacations), `finance/sources:GET` (seed trio default), `settings:GET` (create singleton)
Melanggar prinsip "GET aman/idempoten murni", tapi semua idempoten + murah + by-design (komentar kode menjelaskan). Prefetch agresif browser/CDN hanya memicu no-op.
**Saran:** TIDAK perlu fix perilaku (kontrak); cukup pastikan tetap idempoten saat disentuh di masa depan. **Aman diperbaiki: tidak (by design).**

### [P3-15] `finance/dashboard/route.ts:197,276` — `prevRows` & `trendRows` di-await serial setelah Promise.all besar
Dua round-trip DB tambahan yang bisa digabung ke batch `Promise.all` pertama → hemat ~2 RTT per request. **Aman: ya** (murni internal).

### [P3-16] `dashboard/route.ts:134-193` — CPU loop `scheduledCountBetween` × 5 jendela rate
`rateBetween` dipanggil 5× (weekly/monthly/consistency/7d/30d), masing-masing iterasi habit × hari; `period=all` dengan riwayat panjang + banyak habit → ratusan ms CPU. Hasil benar, hanya lambat.
**Saran:** precompute peta `scheduledOn(habitId, ymd)` sekali atau cache hasil `isScheduledOn` per (habit, hari). **Aman: hati-hati** (wajib hasil identik bit-per-bit).

### [P3-17] `daily-logs:GET ?all=true` & `habits/batch-logs` param `ids` tidak dibatasi
`?all=true` tanpa pagination; `ids` bisa ribuan → IN clause raksasa. Volume single-user kecil.
**Saran:** cap `ids` (mis. 500) + 400 bila lebih. **Aman: ya.**

### [P3-18] `_lib/seed-data.ts:44-57` — seedDemoData tidak transaksional
Rangkaian delete+insert panjang tanpa `$transaction`; kegagalan di tengah meninggalkan demo parsial DAN guard seed (count>0) lalu memblokir retry → user harus reset dulu.
**Saran:** bungkus isi `seedDemoData` dalam satu interactive `$transaction` (pola import route). **Aman: ya** (transaksi panjang tapi volume demo kecil).

### [P3-19] `finance/transactions/[id]/route.ts` + `_lib/finance-fields.ts:68-75` — edit tanggal transfer hanya mengubah SATU kaki
Allowed-fields transfer menyertakan `date` → PUT mengubah tanggal kaki yang diedit saja; pasangannya tetap tanggal lama (saldo tetap benar, tapi rekap harian/tampilan pasangan desync).
**Saran:** saat `existing.type === 'transfer'` dan `date` dikirim → update kaki pasangan sekalian (dalam $transaction), atau tolak `date` untuk transfer. **Aman: hati-hati** (ubah perilaku edit transfer).

### [P3-20] `_lib/habit-fields.ts:94-108` — update `habitType` → 'avoid' tidak membersihkan `targetDays` lama
Null-out `targetDays` untuk avoid hanya berjalan bila `targetDays` ikut dikirim di body; type-switch tanpa targetDays menyisakan nilai basi (graduation avoid tak bermakna — dampak: habit avoid bisa "lulus" via targetDays sisa). Frontend mengirim targetDays bersamaan di form utama, jadi jarang.
**Saran:** bila `data.habitType === 'avoid'` (final) → paksa `data.targetDays = null` di PUT. **Aman: ya.**

---

## Hal yang DIPERIKSA dan sehat (agar triase tidak memburu ulang)
- **try/catch:** 88/88 handler; 3 pengecualian disengaja & aman (`/api` health, `motivational-quote` fallback 200, `finance/last-done` 200-kosong + log).
- **Validasi input:** `asNumber/asString/asBool` + `requirePositiveNumber/requireNonEmptyString` + clamp konsisten; `isValidYMD/isValidMonth` ketat (tolak 2026-02-31); enum divalidasi via Set di semua route; id param selalu lewat findUnique → 404 (id aneh tidak pernah sampai ke SQL raw); tidak ada `parseInt` tanpa NaN-check.
- **JSON body:** `readJsonBody` menolak JSON invalid/array/non-objek → 400; semua `JSON.parse` lain (milestones, scheduleJson, AI) dibungkus try/catch.
- **Transaksi/CAS:** transfer, split-existing, bulk-delete, categories rename-cascade, habit-options rename-cascade, habit-groups delete, import, reset-all sudah `$transaction`; recurring process = CAS+create atomik (60-b); semua upsert (habitLog, dailyLog, workRoutineLog, workDayFlag, appSettings) memakai unique-key penuh → Prisma native upsert (INSERT..ON CONFLICT), race-safe.
- **Kebocoran error:** hanya `ApiError.message` (teks Indonesia milik sendiri) yang dikirim; non-ApiError → 500 generik + console. Tidak ada `error.message` Prisma/stack ke client.
- **Timezone:** konvensi solid — HabitLog/DailyLog UTC-midnight, Transaction komponen-UTC = jam dinding Jakarta (0–23 → `toISOString().slice(0,10)` tidak pernah geser hari), completedAt ISO +07:00, recurring startDate/endDate & savings deadline = tengah malam Jakarta, `jakartaDayStart` untuk "selesai hari ini" work-board. `resolveDateAndTime` mengonversi ISO penuh client ke konvensi storage dengan benar. Satu-satunya kebocoran TZ = P3-3/P3-4 (jalur fallback API-only).
- **Missing await / floating promise:** tidak ada (semua `db.` tanpa await berada di dalam `Promise.all`/`$transaction[]` sebagai PrismaPromise lazy). Satu-satunya floating = P2-1 (LLM race).
- **HTTP method:** tidak ada mutasi via GET selain P3-14 (by design); semua pasangan CRUD lengkap (lihat inventaris handler di catatan audit).
- **ensure-DDL:** semua route yang membaca baris penuh Habit/Transaction atau menyentuh tabel Work memanggil ensure* sebelum query; route yang `select` kolom native saja aman tanpa ensure.

## Top-5 layak fix (urut nilai/risiko)
1. **P2-1** floating LLM promise + uncleared timer (work/ai, ai-insights) — risiko mati instance, fix 5 baris, zero-contract.
2. **P2-4** PATCH sources saldo → bungkus $transaction (pola 60-b tinggal tempel).
3. **P3-10** vacation re-enable tanpa until ter-cancel otomatis — bersihkan `vacationUntil` saat buka interval terbuka.
4. **P3-1** budgets PUT P2002 → 409 (konsistensi dengan fix 60-b).
5. **P3-3** split fallback `jakartaDateString()` (hapus risiko geser hari, satu kata).
