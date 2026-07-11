import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { format, startOfDay, startOfMonth, endOfMonth } from 'date-fns';

// GET /api/daily-logs?month=2024-01
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const date = searchParams.get('date');

    if (date) {
      const dateObj = startOfDay(new Date(date));
      const log = await db.dailyLog.findUnique({
        where: { date: dateObj },
      });
      return NextResponse.json(log);
    }

    let startDate: Date;
    let endDate: Date;

    if (month) {
      startDate = startOfMonth(new Date(`${month}-01`));
      endDate = endOfMonth(new Date(`${month}-01`));
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      endDate = new Date();
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

    const dateObj = startOfDay(new Date(date));

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