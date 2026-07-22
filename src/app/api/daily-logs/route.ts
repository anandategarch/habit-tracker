import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { startOfMonth, endOfMonth } from 'date-fns';

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

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

    const logs = await db.dailyLog.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('GET /api/daily-logs error:', error);
    return NextResponse.json({ error: 'Failed to fetch daily logs' }, { status: 500 });
  }
}

// POST /api/daily-logs - create or update a daily log
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, mood, energy, sleep, notes } = body;

    if (!date || isNaN(new Date(date).getTime())) {
      return NextResponse.json({ error: 'Valid date is required' }, { status: 400 });
    }

    // Use explicit UTC midnight for consistent date storage
    const dateObj = new Date(`${date}T00:00:00Z`);

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