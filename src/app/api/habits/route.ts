import { db } from '@/lib/db';
import { createHabitSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/habits - list all habits
export async function GET() {
  try {
    const habits = await db.habit.findMany({
      where: { status: { in: ['active', 'paused'] } },
      orderBy: { order: 'asc' },
      include: {
        _count: { select: { logs: true } },
      },
    });
    return NextResponse.json(habits);
  } catch (error) {
    console.error('GET /api/habits error:', error);
    return NextResponse.json([]);
  }
}

// POST /api/habits - create a new habit
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseOr400(createHabitSchema, body);
    if (!parsed.success) return parsed.response;
    const d = parsed.data;

    const maxOrder = await db.habit.findFirst({
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const habit = await db.habit.create({
      data: {
        name: d.name,
        icon: d.icon ?? '🎯',
        category: d.category ?? 'General',
        priority: d.priority ?? 'Medium',
        difficulty: d.difficulty ?? 'Medium',
        target: d.target ?? 1,
        targetType: d.targetType ?? 'daily',
        color: d.color ?? '#22c55e',
        reminder: d.reminder ?? null,
        startDate: d.startDate ?? new Date(),
        endDate: d.endDate ?? null,
        notes: d.notes ?? null,
        trackTime: d.trackTime ?? false,
        targetTime: d.targetTime ?? null,
        trackLastDone: d.trackLastDone ?? false,
        lastDoneInterval: d.lastDoneInterval ?? null,
        groupId: d.groupId ?? null,
        order: (maxOrder?.order || 0) + 1,
      },
    });

    return NextResponse.json(habit, { status: 201 });
  } catch (error) {
    console.error('POST /api/habits error:', error);
    return NextResponse.json({ error: 'Failed to create habit' }, { status: 500 });
  }
}
