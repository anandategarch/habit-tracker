// POST /api/data/reset-all — hapus seluruh data habit+keuangan+goal.
// AppSettings dipertahankan (kontrak).
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { handleApiError } from '@/app/api/_lib/api-utils';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
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
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'data/reset-all:POST');
  }
}
