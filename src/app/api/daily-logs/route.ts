import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { createDailyLogSchema, parseOr400 } from '@/lib/validation';
import { startOfMonth, endOfMonth } from 'date-fns';
import { jakartaNowParts } from '@/lib/timezone';

// GET /api/daily-logs?month=2024-01
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const date = searchParams.get('date');

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
    return NextResponse.json([]);
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
    // Date object. Previously this used `new Date(`${date}T00:00:00Z`)`, but
    // `date` is a `Date` (z.coerce.date()), so `${date}` stringifies via
    // `Date.prototype.toString()` → e.g.
    //   "Wed Jan 15 2025 00:00:00 GMT+0000 (Coordinated Universal Time)T00:00:00Z"
    // which is unparseable and yields Invalid Date — the entire endpoint was
    // broken. Extract the YMD from the UTC components and rebuild.
    const dateObj = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

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