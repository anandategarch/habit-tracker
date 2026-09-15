// POST /api/data/seed — isi data demo. Guard: tolak bila sudah ada data.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, handleApiError } from '@/app/api/_lib/api-utils';
import { seedDemoData } from '@/app/api/_lib/seed-data';
import { ensureTransactionGroupId } from '@/app/api/_lib/transaction-ensure';
import { ensureWorkTables } from '@/app/api/_lib/work-ensure';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // Task 60-f: query baris Transaction penuh (kolom groupId via DDL runtime).
    await ensureTransactionGroupId();
    // Task 61-h (audit 61-c P3-11): tabel Meja Kerja ikut dihitung guard —
    // ensureWorkTables dulu supaya count tidak 500 di DB produksi segar
    // (tabel belum ter-DDL runtime).
    await ensureWorkTables();
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
      budgetSnapshots,
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
      db.workRoutine.count(),
      db.workRoutineLog.count(),
      db.workTask.count(),
      db.workNote.count(),
      db.workDayFlag.count(),
      db.budgetSnapshot.count(),
    ]);

    // Task 61-h (audit 61-c P3-11): guard lama hanya menjumlahkan 13 tabel
    // habit/keuangan/goal — user dengan HANYA data Meja Kerja (rutin/log/
    // tugas/catatan/penanda) atau snapshot budget masih diizinkan seed demo
    // → data demo tercampur data kerja nyata (dan seedDemoData ikut
    // menghapus tabel kerja). Semua tabel yang disentuh seed ikut dihitung.
    const existing =
      habits + habitLogs + dailyLogs + transactions + fundSources + financeCategories +
      weeklyBudgets + savingsGoals + recurringTransactions + transactionRules + goals +
      habitOptions + habitGroups +
      workRoutines + workRoutineLogs + workTasks + workNotes + workDayFlags + budgetSnapshots;
    if (existing > 0) {
      throw badRequest('Data sudah ada — reset data terlebih dahulu sebelum seed ulang');
    }

    const summary = await seedDemoData();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return handleApiError(error, 'data/seed:POST');
  }
}
