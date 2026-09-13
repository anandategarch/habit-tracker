// GET /api/data/export — dump seluruh data aplikasi (untuk backup/import).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError } from '@/app/api/_lib/api-utils';
import { ensureHabitGraduation } from '@/app/api/_lib/habit-ensure';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Task 36: dump habit membaca semua kolom scalar (targetDays/graduatedAt).
    await ensureHabitGraduation();
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
      appSettings,
    ] = await Promise.all([
      db.habit.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      db.habitLog.findMany({ orderBy: { date: 'asc' } }),
      db.dailyLog.findMany({ orderBy: { date: 'asc' } }),
      db.transaction.findMany({ orderBy: { date: 'asc' } }),
      db.fundSource.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.financeCategory.findMany({ orderBy: { name: 'asc' } }),
      db.weeklyBudget.findMany({ orderBy: [{ month: 'asc' }, { category: 'asc' }] }),
      db.savingsGoal.findMany({ orderBy: { createdAt: 'asc' } }),
      db.recurringTransaction.findMany({ orderBy: { createdAt: 'asc' } }),
      db.transactionRule.findMany({ orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }] }),
      db.goal.findMany({ orderBy: { createdAt: 'asc' } }),
      db.habitOption.findMany({ orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] }),
      db.habitGroup.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.appSettings.findUnique({ where: { id: 'singleton' } }),
    ]);

    return NextResponse.json({
      data: {
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
        appSettings: appSettings ?? null,
      },
    });
  } catch (error) {
    return handleApiError(error, 'data/export:GET');
  }
}
