import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * Security guard: this endpoint wipes the entire database. By default it is
 * BLOCKED in production unless `APP_API_KEY` env var is set, AND the request
 * provides a matching `x-api-key` header (or `?apiKey=` query param).
 *
 * In non-production (NODE_ENV !== 'production'), the endpoint is open for
 * local development convenience (matching the opt-in middleware behavior).
 *
 * See BUGHUNT-OTHER-1 BUG-H1.
 */
function authorizeDestructive(request: Request): NextResponse | null {
  if (process.env.NODE_ENV !== 'production') return null; // dev: open
  const apiKey = process.env.APP_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Destructive endpoints disabled. Set APP_API_KEY to enable.' },
      { status: 403 }
    );
  }
  const url = new URL(request.url);
  const provided =
    request.headers.get('x-api-key') || url.searchParams.get('apiKey') || '';
  if (provided.length !== apiKey.length || provided !== apiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function DELETE(request: Request) {
  const auth = authorizeDestructive(request);
  if (auth) return auth;
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
      // Daily logs / journals / goals
      db.dailyLog.deleteMany(),
      db.journal.deleteMany(),
      db.goal.deleteMany(),
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
      // Push subscriptions (BUG L11 fix: were persisting after reset)
      db.pushSubscription.deleteMany(),
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