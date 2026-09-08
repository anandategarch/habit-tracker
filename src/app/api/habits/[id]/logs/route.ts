import { db } from '@/lib/db';
import { jakartaNowIso, dateFromYMD, jakartaDateKey } from '@/lib/timezone';
import { createHabitLogSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/habits/[id]/logs?month=2024-01
// GET /api/habits/[id]/logs?year=2024        (PHASE3-HABIT — full year of logs)
// GET /api/habits/[id]/logs                  (default: last 30 days)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
    }
    if (year && !/^\d{4}$/.test(year)) {
      return NextResponse.json({ error: 'Invalid year format. Use YYYY' }, { status: 400 });
    }
    // Reject well-formed but impossible months ("2026-13", "2026-00") —
    // they silently roll over into another year's range.
    if (month) {
      const [y, m] = month.split('-').map(Number);
      if (y < 1970 || y > 2200 || m < 1 || m > 12) {
        return NextResponse.json({ error: 'Invalid month. Use YYYY-MM (01-12)' }, { status: 400 });
      }
    }

    let startDate: Date;
    let endDate: Date;

    const today = new Date();
    if (month) {
      const [y, m] = month.split('-').map(Number);
      startDate = new Date(Date.UTC(y, m - 1, 1));
      const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
      endDate = new Date(Date.UTC(y, m - 1, daysInMonth, 23, 59, 59, 999));
    } else if (year) {
      // PHASE3-HABIT — full year window (Jan 1 → Dec 31). Used by the yearly
      // heatmap + milestone badges. Also fetches a 7-day buffer before Jan 1
      // so the heatmap's first column (which may start in late Dec of the
      // previous year) shows accurate data.
      const y = parseInt(year, 10);
      startDate = new Date(Date.UTC(y, 0, 1) - 7 * 86_400_000); // 7 days before Jan 1
      endDate = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
    } else {
      startDate = new Date(today);
      startDate.setUTCDate(startDate.getUTCDate() - 30);
      startDate.setUTCHours(0, 0, 0, 0);
      endDate = new Date(today);
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
    const { id } = await params;
    const body = await request.json();
    const parsed = parseOr400(createHabitLogSchema, body);
    if (!parsed.success) return parsed.response;
    const { date, completed, value, completedAt } = parsed.data;

    // Normalize date to a YYYY-MM-DD string in Jakarta timezone for the DB
    // unique key. BUG-FIX-API-HIGH: previously used date.toISOString().slice(0,10)
    // which returns the UTC YMD — for a Jakarta-midnight date (UTC 17:00 the
    // previous day), this stored the log under the WRONG day.
    const ymd = jakartaDateKey(date);
    const dateObj = dateFromYMD(ymd);

    // Build the completedAt value (stored as ISO string with +07:00 offset).
    let completedAtStr: string | null = null;
    if (completed && completedAt) {
      completedAtStr = completedAt;
      // Prevent times older than 7 days
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const completedAtMs = new Date(completedAtStr).getTime();
      if (completedAtMs < sevenDaysAgo) {
        return NextResponse.json({ error: 'Cannot set completion time more than 7 days ago' }, { status: 400 });
      }
    } else if (completed) {
      // BUG-6 fix: only auto-stamp completedAt for trackTime habits.
      // Non-trackTime habits don't need a precise completion time — setting it
      // caused the UI to show a misleading "done at HH:mm" badge that was
      // really just "now". Fetch the habit to check trackTime.
      const habit = await db.habit.findUnique({
        where: { id },
        select: { trackTime: true },
      });
      if (habit?.trackTime) {
        completedAtStr = jakartaNowIso();
      }
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
