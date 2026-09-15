// POST /api/data/reset-all — hapus seluruh data habit+keuangan+goal+Meja Kerja.
// AppSettings dipertahankan (kontrak).
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { handleApiError } from '@/app/api/_lib/api-utils';
import { ensureWorkTables } from '@/app/api/_lib/work-ensure';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // Task 60-b (audit 59-b5): UI Pengaturan menjanjikan "hapus … data lainnya"
    // — Meja Kerja ikut di-reset. Tabelnya dibuat ensure-DDL runtime di
    // produksi (no-op lokal); tanpa ini deleteMany 500 di DB produksi segar.
    await ensureWorkTables();
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.habitLog.deleteMany();
      await tx.transaction.deleteMany();
      await tx.fundSource.deleteMany();
      await tx.habit.deleteMany();
      await tx.habitGroup.deleteMany();
      await tx.habitOption.deleteMany();
      await tx.dailyLog.deleteMany();
      await tx.financeCategory.deleteMany();
      await tx.weeklyBudget.deleteMany();
      await tx.budgetSnapshot.deleteMany();
      await tx.savingsGoal.deleteMany();
      await tx.recurringTransaction.deleteMany();
      await tx.transactionRule.deleteMany();
      await tx.goal.deleteMany();
      // Meja Kerja (Task 60-b): log dulu baru rutinitas (FK routineId).
      await tx.workRoutineLog.deleteMany();
      await tx.workRoutine.deleteMany();
      await tx.workTask.deleteMany();
      await tx.workNote.deleteMany();
      await tx.workDayFlag.deleteMany();
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'data/reset-all:POST');
  }
}
