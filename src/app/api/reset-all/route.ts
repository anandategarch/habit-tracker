import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function DELETE() {
  try {
    // Delete all data in correct order (respect foreign keys)
    await db.habitLog.deleteMany();
    await db.habit.deleteMany();
    await db.dailyLog.deleteMany();
    await db.journal.deleteMany();
    await db.goal.deleteMany();
    await db.challenge.deleteMany();
    await db.badge.deleteMany();
    await db.reward.deleteMany();
    await db.transaction.deleteMany();
    await db.budget.deleteMany();
    await db.financeCategory.deleteMany();

    // Keep AppSettings — just reset to defaults
    await db.appSettings.deleteMany();
    await db.appSettings.create({ data: {} });

    return NextResponse.json({ message: 'Semua data berhasil dihapus' });
  } catch (error) {
    console.error('Reset all error:', error);
    return NextResponse.json({ error: 'Gagal menghapus data' }, { status: 500 });
  }
}