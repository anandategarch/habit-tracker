import { db } from '@/lib/db';
import { createDailyLogSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

// PUT /api/daily-logs/[date]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date: dateStr } = await params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
    }
    const body = await request.json();
    const parsed = parseOr400(createDailyLogSchema, body);
    if (!parsed.success) return parsed.response;
    // Use explicit UTC midnight for consistent date storage
    const dateObj = new Date(`${dateStr}T00:00:00Z`);

    const updateData: Record<string, unknown> = {};
    if (parsed.data.mood !== undefined) updateData.mood = parsed.data.mood;
    if (parsed.data.energy !== undefined) updateData.energy = parsed.data.energy;
    if (parsed.data.sleep !== undefined) updateData.sleep = parsed.data.sleep;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

    const log = await db.dailyLog.upsert({
      where: { date: dateObj },
      create: {
        date: dateObj,
        mood: parsed.data.mood ?? 3,
        energy: parsed.data.energy ?? 3,
        sleep: parsed.data.sleep ?? 7,
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