import { db } from '@/lib/db';
import { ensureTimeTrackingColumns } from '@/lib/ensure-columns';
import { NextRequest, NextResponse } from 'next/server';

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

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

    // Use Jakarta time for date boundaries
    const jakartaNow = new Date(Date.now() + JAKARTA_OFFSET_MS);
    if (month) {
      const [y, m] = month.split('-').map(Number);
      startDate = new Date(Date.UTC(y, m - 1, 1));
      const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
      endDate = new Date(Date.UTC(y, m - 1, daysInMonth, 23, 59, 59, 999));
    } else {
      startDate = new Date(jakartaNow);
      startDate.setUTCDate(startDate.getUTCDate() - 30);
      startDate.setUTCHours(0, 0, 0, 0);
      endDate = new Date(jakartaNow);
      endDate.setUTCHours(23, 59, 59, 999);
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

    const dateObj = new Date(`${date}T00:00:00Z`);

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
      // Store with Jakarta offset for consistency with time-tracked habits
      const nowUTC = new Date();
      const jakartaMs = nowUTC.getTime() + JAKARTA_OFFSET_MS;
      const jY = new Date(jakartaMs).getUTCFullYear();
      const jM = new Date(jakartaMs).getUTCMonth();
      const jD = new Date(jakartaMs).getUTCDate();
      const jH = new Date(jakartaMs).getUTCHours();
      const jMi = new Date(jakartaMs).getUTCMinutes();
      const jS = new Date(jakartaMs).getUTCSeconds();
      completedAtStr = `${jY}-${String(jM + 1).padStart(2, '0')}-${String(jD).padStart(2, '0')}T${String(jH).padStart(2, '0')}:${String(jMi).padStart(2, '0')}:${String(jS).padStart(2, '0')}+07:00`;
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