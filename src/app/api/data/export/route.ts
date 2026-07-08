import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [
      habits,
      habitLogs,
      dailyLogs,
      journals,
      goals,
      challenges,
      badges,
      rewards,
      transactions,
      budgets,
      financeCategories,
      settings,
    ] = await Promise.all([
      db.habit.findMany(),
      db.habitLog.findMany(),
      db.dailyLog.findMany(),
      db.journal.findMany(),
      db.goal.findMany(),
      db.challenge.findMany(),
      db.badge.findMany(),
      db.reward.findMany(),
      db.transaction.findMany(),
      db.budget.findMany(),
      db.financeCategory.findMany(),
      db.appSettings.findMany(),
    ]);

    const data = {
      habits,
      habitLogs,
      dailyLogs,
      journals,
      goals,
      challenges,
      badges,
      rewards,
      transactions,
      budgets,
      financeCategories,
      settings,
    };

    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="habit-tracker-backup-${today}.json"`,
      },
    });
  } catch (error) {
    console.error('Export failed:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}