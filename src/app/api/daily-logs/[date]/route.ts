import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { startOfDay } from 'date-fns';

// PUT /api/daily-logs/[date]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date: dateStr } = await params;
    const body = await request.json();
    const dateObj = startOfDay(new Date(dateStr));

    const updateData: Record<string, unknown> = {};
    if (body.mood !== undefined) updateData.mood = body.mood;
    if (body.energy !== undefined) updateData.energy = body.energy;
    if (body.sleep !== undefined) updateData.sleep = body.sleep;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const log = await db.dailyLog.upsert({
      where: { date: dateObj },
      create: {
        date: dateObj,
        mood: body.mood ?? 3,
        energy: body.energy ?? 3,
        sleep: body.sleep ?? 7,
        notes: body.notes || null,
      },
      update: updateData,
    });

    return NextResponse.json(log);
  } catch (error) {
    console.error('PUT /api/daily-logs/[date] error:', error);
    return NextResponse.json({ error: 'Failed to update daily log' }, { status: 500 });
  }
}