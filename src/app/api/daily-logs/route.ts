import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { createDailyLogSchema, parseOr400 } from '@/lib/validation';
import { jakartaNowParts, jakartaDateKey, dateFromYMD } from '@/lib/timezone';

// GET /api/daily-logs?month=2024-01
// GET /api/daily-logs?date=2024-01-15
// GET /api/daily-logs?all=true    ← all-time (no 30-day filter) — used by
//                                    Settings → "Total Logs" / "Days Tracked"
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const date = searchParams.get('date');
    const all = searchParams.get('all') === 'true';

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
      }
      // Use explicit UTC midnight for consistent date lookup
      const dateObj = new Date(`${date}T00:00:00Z`);
      const log = await db.dailyLog.findUnique({
        where: { date: dateObj },
      });
      return NextResponse.json(log);
    }

    let startDate: Date;
    let endDate: Date;

    // Use Jakarta time for date boundaries
    if (month) {
      const [y, m] = month.split('-').map(Number);
      startDate = new Date(Date.UTC(y, m - 1, 1));
      const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
      endDate = new Date(Date.UTC(y, m - 1, daysInMonth, 23, 59, 59, 999));
    } else if (all) {
      // BUGHUNT-OTHER-1 BUG-H2: return ALL logs (no 30-day filter). Used by
      // Settings → "Total Logs" / "Days Tracked" so the count reflects
      // all-time data, not just the last 30 days. Capped at 10k for safety.
      const allLogs = await db.dailyLog.findMany({
        orderBy: { date: 'asc' },
        take: 10_000,
      });
      return NextResponse.json(allLogs);
    } else {
      // Construct the range using Jakarta wall-clock components so the result
      // matches the prior behavior of `new Date(Date.now() + 7h)` + setUTCHours
      // (i.e. UTC parts equal Jakarta wall-clock parts).
      const jp = jakartaNowParts();
      endDate = new Date(Date.UTC(jp.year, jp.month - 1, jp.day, 23, 59, 59, 999));
      startDate = new Date(endDate);
      startDate.setUTCDate(startDate.getUTCDate() - 30);
      startDate.setUTCHours(0, 0, 0, 0);
    }

    const logs = await db.dailyLog.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('GET /api/daily-logs error:', error);
    // BUGHUNT-OTHER-1 M-pattern: return proper error response instead of
    // silently swallowing the error and returning [] (which the UI cannot
    // distinguish from "no data yet").
    return NextResponse.json(
      { error: 'Failed to fetch daily logs' },
      { status: 500 }
    );
  }
}

// POST /api/daily-logs - create or update a daily log
export async function POST(request: NextRequest) {
  try {
    const parsed = parseOr400(createDailyLogSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const body = parsed.data;
    const { date, mood, energy, sleep, notes } = body;

    if (!date || isNaN(new Date(date).getTime())) {
      return NextResponse.json({ error: 'Valid date is required' }, { status: 400 });
    }

    // Build a UTC-midnight Date keyed to the YYYY-MM-DD of the (already-coerced)
    // Date object — in JAKARTA timezone. BUG-FIX-API-HIGH: previously used
    // Date.UTC(date.getUTCFullYear(), ...) which returns the UTC YMD — for a
    // Jakarta-midnight date (UTC 17:00 the previous day), this stored the log
    // under the WRONG day. Use jakartaDateKey to get the Jakarta wall-clock
    // YMD, then dateFromYMD to build the UTC-midnight Date the DB expects.
    const dateObj = dateFromYMD(jakartaDateKey(date));

    const log = await db.dailyLog.upsert({
      where: { date: dateObj },
      create: {
        date: dateObj,
        mood: mood ?? 3,
        energy: energy ?? 3,
        sleep: sleep ?? 7,
        notes: notes || null,
      },
      update: {
        ...(mood !== undefined && { mood }),
        ...(energy !== undefined && { energy }),
        ...(sleep !== undefined && { sleep }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json(log);
  } catch (error) {
    console.error('POST /api/daily-logs error:', error);
    return NextResponse.json({ error: 'Failed to save daily log' }, { status: 500 });
  }
}