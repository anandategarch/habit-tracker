import { db } from '@/lib/db';
import { ensureTimeTrackingColumns } from '@/lib/ensure-columns';
import { NextRequest, NextResponse } from 'next/server';

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

// GET /api/habits/batch-logs?month=2024-01&habitIds=id1,id2,id3
export async function GET(request: NextRequest) {
  try {
    await ensureTimeTrackingColumns();
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

    if (habitIds.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 habit IDs allowed' },
        { status: 400 },
      );
    }

    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
    }

    let startDate: Date;
    let endDate: Date;

    // Use Jakarta time for date boundaries
    const jakartaNow = new Date(Date.now() + JAKARTA_OFFSET_MS);
    if (month) {
      // Date-only strings parse as UTC per spec; build both consistently
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