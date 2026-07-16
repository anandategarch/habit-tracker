import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function DELETE() {
  try {
    // Delete all data atomically (respect foreign keys)
    await db.$transaction([
      db.habitLog.deleteMany(),
      db.habit.deleteMany(),
      db.dailyLog.deleteMany(),
      db.journal.deleteMany(),
      db.goal.deleteMany(),
      db.challenge.deleteMany(),
      db.badge.deleteMany(),
      db.reward.deleteMany(),
      db.transaction.deleteMany(),
      db.budget.deleteMany(),
      db.financeCategory.deleteMany(),
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