# Task 60-b — full-stack-developer (API fixes Task 60)

Ringkasan kerja penuh ada di `/home/z/my-project/worklog.md` section "Task ID: 60-b".

## File yang diubah (11, sesuai daftar izin)
- `src/app/api/_lib/import-utils.ts` — Fix 1 (goalId) + Fix 2 (5 TableSpec Meja Kerja; dayKey = string, bukan dateColumns)
- `src/app/api/data/export/route.ts` — Fix 2 (ensureWorkTables + dump 5 tabel, kunci workRoutines/workRoutineLogs/workTasks/workNotes/workDayFlags)
- `src/app/api/data/import/route.ts` — Fix 2 (ensureWorkTables, deleteMany urut FK WorkRoutineLog→WorkRoutine, create urut dependensi; backup lama skip senyap)
- `src/app/api/data/reset-all/route.ts` — Fix 2 (ensureWorkTables + deleteMany 5 tabel)
- `src/app/api/finance/recurring/[id]/process/route.ts` — Fix 3 (CAS+create dalam SATU interactive $transaction)
- `src/app/api/finance/savings-goals/[id]/route.ts` — Fix 4 (PUT {delta}: baca+tulis dalam $transaction, clamp & completedAt dipertahankan)
- `src/app/api/habits/[id]/year-logs/route.ts` — Fix 5 (ensureHabitGraduation sebelum query)
- `src/app/api/work/ai/route.ts` — Fix 6 (export const maxDuration = 60)
- `src/app/api/habits/[id]/logs/route.ts` — Fix 7 (notes non-string → 400)
- `src/app/api/daily-logs/route.ts` — Fix 7 (notes non-string → 400)
- `src/app/api/finance/budgets/route.ts` — Fix 8 (P2002→409, P2025→404)

## Pendekatan transaction (keputusan kunci)
Interactive `prisma.$transaction(async (tx) => …)` TERBUKTI berjalan di driver adapter libsql (dipakai 8 route lain). Dibaca sumber `@prisma/adapter-libsql@6.19.2`: `startTransaction` meng-acquire mutex koneksi (async-mutex) yang baru di-release pada commit/rollback → seluruh transaksi ter-serialize terhadap query lain pada PrismaClient yang sama. Fallback compensating-action tidak diperlukan.

## Verifikasi
- `bun run lint`: 0 error, 1 warning lama (TanStack Virtual, finance-transactions.tsx — diizinkan).
- `bunx tsc --noEmit`: 26 baris error = identik baseline (semua error lama di scripts/, skills/, work-assistant, work-board, daily-tracker dnd-kit); 0 error di file yang disentuh.
- `curl GET /api/data/export` 200 → payload memuat 5 kunci Meja Kerja (array; DB dev kosong untuk tabel itu) + kunci lama utuh.
- GET aman lain: year-logs 404 (habit tak ada, ensureHabitGraduation jalan), budgets 200, daily-logs 200.
- Skrip bun murni: 25/25 assertion PASS (goalId, IMPORT_KEYS, dayKey string, doneAt ISO→Date, backward-compat backup lama).
- Ekstrik `dev.log`: 0 error/500 baru.
- Tidak ada POST/PUT/DELETE ke API penulis DB; tidak commit/push/build/db-push; schema.prisma tidak disentuh.
