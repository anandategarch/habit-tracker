import { db } from '@/lib/db';
import { createHabitSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/habits - list all habits
// Include 'archived' so the UI's status filter "Archived" returns results
// (BUG-2 fix). The UI filters client-side; previously archived habits were
// permanently hidden with no way to unarchive.
export async function GET() {
  try {
    const habits = await db.habit.findMany({
      where: { status: { in: ['active', 'paused', 'archived'] } },
      orderBy: { order: 'asc' },
      include: {
        _count: { select: { logs: true } },
      },
    });
    return NextResponse.json(habits);
  } catch (error) {
    console.error('GET /api/habits error:', error);
    // Return a proper 500 instead of `[]` — the old behavior silently masked
    // DB failures as "no habits", which broke the UI without any signal.
    return NextResponse.json(
      { error: 'Failed to fetch habits' },
      { status: 500 }
    );
  }
}

// POST /api/habits - create a new habit
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseOr400(createHabitSchema, body);
    if (!parsed.success) return parsed.response;
    const d = parsed.data;

    // Race-safe order assignment (BUG-27 fix): wrap the maxOrder read and
    // the create in a transaction so two concurrent POSTs cannot both read
    // the same maxOrder and create habits with duplicate `order` values.
    // SQLite (via Prisma) uses BEGIN IMMEDIATE which serializes write txns.
    const habit = await db.$transaction(async (tx) => {
      const maxOrder = await tx.habit.aggregate({ _max: { order: true } });
      return tx.habit.create({
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
          order: (maxOrder._max.order ?? 0) + 1,
        },
      });
    });

    return NextResponse.json(habit, { status: 201 });
  } catch (error) {
    console.error('POST /api/habits error:', error);
    return NextResponse.json({ error: 'Failed to create habit' }, { status: 500 });
  }
}
