import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { startOfDay } from 'date-fns';

// GET /api/habits/[id]/logs?month=2024-01
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

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
    const { id } = await params;
    const body = await request.json();
    const { date, completed, value } = body;

    const dateObj = startOfDay(new Date(date));

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
      },
      update: {
        completed: completed ?? true,
        value: value ?? 1,
      },
    });

    return NextResponse.json(log);
  } catch (error) {
    console.error('POST /api/habits/[id]/logs error:', error);
    return NextResponse.json({ error: 'Failed to toggle habit' }, { status: 500 });
  }
}