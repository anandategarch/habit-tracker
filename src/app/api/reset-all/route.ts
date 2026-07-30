import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function DELETE() {
  try {
    // Delete all data atomically (respect foreign keys). Order matters for
    // referential integrity: child tables first, parent tables last.
    //
    // Previously this left FundSource, WeeklyBudget, BudgetSnapshot,
    // LearningTopic, HabitOption, and HabitGroup intact — so after "reset all"
    // the fund-source balances persisted with no underlying transactions
    // (balances and history permanently out of sync), while the API claimed
    // "Semua data berhasil dihapus". Now we delete EVERYTHING except
    // AppSettings (which is recreated with defaults below).
    await db.$transaction([
      // Habit tracker — child tables first
      db.habitLog.deleteMany(),
      db.habit.deleteMany(),
      db.habitGroup.deleteMany(),
      db.habitOption.deleteMany(),
      // Daily logs / journals / goals / challenges
      db.dailyLog.deleteMany(),
      db.journal.deleteMany(),
      db.goal.deleteMany(),
      db.challenge.deleteMany(),
      // Badges & rewards
      db.badge.deleteMany(),
      db.reward.deleteMany(),
      // Finance — transactions first (referenced by source balance), then
      // sources/categories/budgets/weekly-budget/snapshots
      db.transaction.deleteMany(),
      db.budget.deleteMany(),
      db.budgetSnapshot.deleteMany(),
      db.weeklyBudget.deleteMany(),
      db.fundSource.deleteMany(),
      db.financeCategory.deleteMany(),
      // Learning
      db.learningTopic.deleteMany(),
    ]);

    // Keep AppSettings — just reset to defaults
    await db.$transaction([
      db.appSettings.deleteMany(),
      db.appSettings.create({ data: {} }),
    ]);

    return NextResponse.json({ message: 'Semua data berhasil dihapus' });
  } catch (error) {
    console.error('Reset all error:', error);
    return NextResponse.json({ error: 'Gagal menghapus data' }, { status: 500 });
  }
}