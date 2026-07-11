import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

let columnsEnsured = false;

async function ensureColumns() {
  if (columnsEnsured) return;
  try {
    await db.$executeRawUnsafe('ALTER TABLE "Habit" ADD COLUMN "trackTime" BOOLEAN NOT NULL DEFAULT 0');
  } catch { /* already exists */ }
  try {
    await db.$executeRawUnsafe('ALTER TABLE "Habit" ADD COLUMN "targetTime" TEXT');
  } catch { /* already exists */ }
  try {
    await db.$executeRawUnsafe('ALTER TABLE "HabitLog" ADD COLUMN "completedAt" TEXT');
  } catch { /* already exists */ }
  columnsEnsured = true;
}

// GET /api/habits - list all habits
export async function GET() {
  try {
    await ensureColumns();
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
    return NextResponse.json({ error: 'Failed to fetch habits' }, { status: 500 });
  }
}

// POST /api/habits - create a new habit
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, icon, category, priority, difficulty, target, targetType, color, reminder, startDate, endDate, notes, trackTime, targetTime } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Habit name is required' }, { status: 400 });
    }

    // Get the max order to place new habit at the end
    const maxOrder = await db.habit.findFirst({
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const habit = await db.habit.create({
      data: {
        name: name.trim(),
        icon: icon || '🎯',
        category: category || 'General',
        priority: priority || 'Medium',
        difficulty: difficulty || 'Medium',
        target: target || 1,
        targetType: targetType || 'daily',
        color: color || '#22c55e',
        reminder: reminder || null,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        notes: notes || null,
        trackTime: trackTime === true,
        targetTime: targetTime || null,
        order: (maxOrder?.order || 0) + 1,
      },
    });

    return NextResponse.json(habit, { status: 201 });
  } catch (error) {
    console.error('POST /api/habits error:', error);
    return NextResponse.json({ error: 'Failed to create habit' }, { status: 500 });
  }
}