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

    // Build the completedAt value (stored as ISO string)
    let completedAtStr: string | null = null;
    if (completed && completedAt) {
      completedAtStr = completedAt; // already an ISO string from the client
      // Prevent times older than 7 days
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const completedAtMs = new Date(completedAtStr).getTime();
      if (completedAtMs < sevenDaysAgo) {
        return NextResponse.json({ error: 'Cannot set completion time more than 7 days ago' }, { status: 400 });
      }
    } else if (completed) {
      completedAtStr = new Date().toISOString();
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
        completedAt: completedAtStr,
      },
      update: {
        completed: completed ?? true,
        value: value ?? 1,
        completedAt: completed ? completedAtStr : null,
      },
    });

    return NextResponse.json(log);
  } catch (error) {
    console.error('POST /api/habits/[id]/logs error:', error);
    return NextResponse.json({ error: 'Failed to toggle habit' }, { status: 500 });
  }
}