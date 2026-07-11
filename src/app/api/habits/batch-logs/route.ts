import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/habits/batch-logs?month=2024-01&habitIds=id1,id2,id3
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const habitIdsParam = searchParams.get('habitIds');

    if (!habitIdsParam) {
      return NextResponse.json(
        { error: 'habitIds query parameter is required' },
        { status: 400 },
      );
    }

    const habitIds = habitIdsParam.split(',').filter(Boolean);

    if (habitIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one habit ID is required' },
        { status: 400 },
      );
    }

    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
    }

    let startDate: Date;
    let endDate: Date;

    if (month) {
      startDate = new Date(`${month}-01`);
      endDate = new Date(
        startDate.getFullYear(),
        startDate.getMonth() + 1,
        0,
        23,
        59,
        59,
      );
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      endDate = new Date();
    }

    const logs = await db.habitLog.findMany({
      where: {
        habitId: { in: habitIds },
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    // Group logs by habitId
    const grouped: Record<string, typeof logs> = {};
    for (const id of habitIds) {
      grouped[id] = [];
    }
    for (const log of logs) {
      if (!grouped[log.habitId]) {
        grouped[log.habitId] = [];
      }
      grouped[log.habitId].push(log);
    }

    return NextResponse.json(grouped);
  } catch (error) {
    console.error('GET /api/habits/batch-logs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch batch logs' },
      { status: 500 },
    );
  }
}