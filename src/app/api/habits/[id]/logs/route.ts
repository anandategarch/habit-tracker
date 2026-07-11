import { db } from '@/lib/db';
import { ensureTimeTrackingColumns } from '@/lib/ensure-columns';
import { NextRequest, NextResponse } from 'next/server';
import { startOfDay } from 'date-fns';

// GET /api/habits/[id]/logs?month=2024-01
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTimeTrackingColumns();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
    }

    let startDate: Date;
    let endDate: Date;

    if (month) {
      startDate = new Date(`${month}-01`);
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59);
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      endDate = new Date();
    }

    const logs = await db.habitLog.findMany({
      where: {
        habitId: id,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('GET /api/habits/[id]/logs error:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}

// POST /api/habits/[id]/logs - toggle completion for a date
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTimeTrackingColumns();
    const { id } = await params;
    const body = await request.json();
    const { date, completed, value, completedAt } = body;

    const dateObj = startOfDay(new Date(date));

    // Build the completedAt value
    let completedAtDate: Date | null = null;
    if (completed && completedAt) {
      completedAtDate = new Date(completedAt);
      // Prevent times more than 1 hour in the future (timezone tolerance)
      const oneHourAhead = new Date(Date.now() + 60 * 60 * 1000);
      if (completedAtDate > oneHourAhead) {
        return NextResponse.json({ error: 'Cannot set completion time in the future' }, { status: 400 });
      }
      // Prevent times older than 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      if (completedAtDate < sevenDaysAgo) {
        return NextResponse.json({ error: 'Cannot set completion time more than 7 days ago' }, { status: 400 });
      }
    } else if (completed) {
      completedAtDate = new Date();
    }

    const log = await db.habitLog.upsert({
      where: {
        habitId_date: {
          habitId: id,
          date: dateObj,
        },
      },
      create: {
        habitId: id,
        date: dateObj,
        completed: completed ?? true,
        value: value ?? 1,
        completedAt: completedAtDate,
      },
      update: {
        completed: completed ?? true,
        value: value ?? 1,
        completedAt: completed ? completedAtDate : null,
      },
    });

    return NextResponse.json(log);
  } catch (error) {
    console.error('POST /api/habits/[id]/logs error:', error);
    return NextResponse.json({ error: 'Failed to toggle habit' }, { status: 500 });
  }
}