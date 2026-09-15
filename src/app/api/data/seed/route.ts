// POST /api/data/seed — isi data demo. Guard: tolak bila sudah ada data.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, handleApiError } from '@/app/api/_lib/api-utils';
import { seedDemoData } from '@/app/api/_lib/seed-data';
import { ensureTransactionGroupId } from '@/app/api/_lib/transaction-ensure';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // Task 60-f: query baris Transaction penuh (kolom groupId via DDL runtime).
    await ensureTransactionGroupId();
    const [
      habits,
      habitLogs,
      dailyLogs,
      transactions,
      fundSources,
      financeCategories,
      weeklyBudgets,
      savingsGoals,
      recurringTransactions,
      transactionRules,
      goals,
      habitOptions,
      habitGroups,
    ] = await Promise.all([
      db.habit.count(),
      db.habitLog.count(),
      db.dailyLog.count(),
      db.transaction.count(),
      db.fundSource.count(),
      db.financeCategory.count(),
      db.weeklyBudget.count(),
      db.savingsGoal.count(),
      db.recurringTransaction.count(),
      db.transactionRule.count(),
      db.goal.count(),
      db.habitOption.count(),
      db.habitGroup.count(),
    ]);

    const existing =
      habits + habitLogs + dailyLogs + transactions + fundSources + financeCategories +
      weeklyBudgets + savingsGoals + recurringTransactions + transactionRules + goals +
      habitOptions + habitGroups;
    if (existing > 0) {
      throw badRequest('Data sudah ada — reset data terlebih dahulu sebelum seed ulang');
    }

    const summary = await seedDemoData();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return handleApiError(error, 'data/seed:POST');
  }
}
