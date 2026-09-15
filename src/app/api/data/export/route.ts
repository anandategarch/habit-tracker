// GET /api/data/export — dump seluruh data aplikasi (untuk backup/import).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError } from '@/app/api/_lib/api-utils';
import { ensureHabitGraduation } from '@/app/api/_lib/habit-ensure';
import { ensureWorkTables } from '@/app/api/_lib/work-ensure';
import { ensureTransactionGroupId } from '@/app/api/_lib/transaction-ensure';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Task 36: dump habit membaca semua kolom scalar (targetDays/graduatedAt).
    await ensureHabitGraduation();
    // Task 60-b (audit 59-b5): Meja Kerja kini ikut di-backup (UI Pengaturan
    // menjanjikan "backup berisi seluruh data"). Tabelnya dibuat ensure-DDL
    // runtime di produksi — pastikan ada dulu (no-op lokal).
    await ensureWorkTables();
    // Task 60-f: dump Transaction membaca semua kolom (groupId baru).
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
      workRoutines,
      workRoutineLogs,
      workTasks,
      workNotes,
      workDayFlags,
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
      db.workRoutine.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      db.workRoutineLog.findMany({ orderBy: [{ routineId: 'asc' }, { dayKey: 'asc' }] }),
      db.workTask.findMany({ orderBy: { createdAt: 'asc' } }),
      db.workNote.findMany({ orderBy: { createdAt: 'asc' } }),
      db.workDayFlag.findMany({ orderBy: { dayKey: 'asc' } }),
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
        // Task 60-b: Meja Kerja — kunci baru (additif); importer baru membaca
        // kunci ini, backup lama tanpa kunci tetap valid untuk diimpor.
        workRoutines,
        workRoutineLogs,
        workTasks,
        workNotes,
        workDayFlags,
        appSettings: appSettings ?? null,
      },
    });
  } catch (error) {
    return handleApiError(error, 'data/export:GET');
  }
}
