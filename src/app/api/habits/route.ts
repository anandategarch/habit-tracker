import { db } from '@/lib/db';
import { createHabitSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';
import { jakartaDateString } from '@/lib/jakarta-date';

// GET /api/habits - list all habits
// Include 'archived' so the UI's status filter "Archived" returns results
// (BUG-2 fix). The UI filters client-side; previously archived habits were
// permanently hidden with no way to unarchive.
//
// PHASE1-HABIT: auto-resume expired vacations. Any habit with
// vacationMode=true AND vacationEnd < today (Jakarta midnight) is updated
// to vacationMode=false in-place before returning. This makes the resume
// "automatic" without needing a cron job — every time the user opens the
// app, expired vacations are cleared. The update is non-blocking: errors
// are logged but don't fail the GET (so the user still sees their habits).
export async function GET() {
  try {
    // ── Auto-resume expired vacations ─────────────────────────────────
    // Compare vacationEnd against today's Jakarta date string. vacationEnd
    // is stored as a DateTime (ISO); we compare the yyyy-MM-dd parts so a
    // vacation set to end "today" stays active through end-of-day and only
    // auto-resumes "tomorrow" (Jakarta).
    const todayStr = jakartaDateString();
    try {
      const expired = await db.habit.findMany({
        where: {
          vacationMode: true,
          vacationEnd: { not: null, lt: new Date(todayStr + 'T00:00:00+07:00') },
        },
        select: { id: true },
      });
      if (expired.length > 0) {
        await db.habit.updateMany({
          where: { id: { in: expired.map((h) => h.id) } },
          data: { vacationMode: false, vacationEnd: null },
        });
      }
    } catch (resumeErr) {
      // Non-fatal: log and continue so the user still gets their habit list.
      console.error('GET /api/habits — vacation auto-resume error:', resumeErr);
    }

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
          // PHASE1-HABIT: vacation mode defaults
          vacationMode: d.vacationMode ?? false,
          vacationEnd: d.vacationEnd ?? null,
          // PHASE3-HABIT: habit type defaults to "normal" (binary check +
          // green). "avoid" → checking = relapse (red), streak = days
          // WITHOUT a check. "amount" → daily goal with numeric target.
          habitType: d.habitType ?? 'normal',
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
