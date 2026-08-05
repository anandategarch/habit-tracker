import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { createJournalSchema, parseOr400 } from '@/lib/validation';
import { dateFromYMD } from '@/lib/timezone';

// GET /api/journals
export async function GET() {
  try {
    const journals = await db.journal.findMany({
      orderBy: { date: 'desc' },
      take: 100,
    });
    return NextResponse.json(journals);
  } catch (error) {
    console.error('GET /api/journals error:', error);
    return NextResponse.json([]);
  }
}

// POST /api/journals
export async function POST(request: NextRequest) {
  try {
    const parsed = parseOr400(createJournalSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const body = parsed.data;
    const { date, mood, stress, energy, sleep, reflection, winToday, lessonLearned, tomorrowPlan } = body;

    // BUG-10 fix: use dateFromYMD() instead of new Date(date) + setHours(0,0,0,0).
    // z.coerce.date() parses "2025-01-15" as UTC midnight. setHours() sets LOCAL
    // hours, shifting the epoch on non-UTC servers (e.g., Jakarta dev server
    // UTC+7 would shift to 2025-01-14T17:00:00Z → wrong day + uniqueness collision).
    // dateFromYMD() constructs UTC-midnight explicitly, TZ-independent.
    const dateObj = dateFromYMD(
      `${new Date(date).getFullYear()}-${String(new Date(date).getMonth() + 1).padStart(2, '0')}-${String(new Date(date).getDate()).padStart(2, '0')}`
    );

    const journal = await db.journal.upsert({
      where: { date: dateObj },
      create: {
        date: dateObj,
        mood: mood ?? 3,
        stress: stress ?? 3,
        energy: energy ?? 3,
        sleep: sleep ?? 7,
        reflection: reflection || null,
        winToday: winToday || null,
        lessonLearned: lessonLearned || null,
        tomorrowPlan: tomorrowPlan || null,
      },
      // Cast to any: Prisma SQLite nullable Int/Float types don't accept
      // null in UpdateInput at the TS level (runtime handles it correctly).
      update: {
        ...(mood !== undefined && { mood }),
        ...(stress !== undefined && { stress }),
        ...(energy !== undefined && { energy }),
        ...(sleep !== undefined && { sleep }),
        ...(reflection !== undefined && { reflection }),
        ...(winToday !== undefined && { winToday }),
        ...(lessonLearned !== undefined && { lessonLearned }),
        ...(tomorrowPlan !== undefined && { tomorrowPlan }),
      } as any,
    });

    return NextResponse.json(journal);
  } catch (error) {
    console.error('POST /api/journals error:', error);
    return NextResponse.json({ error: 'Failed to save journal' }, { status: 500 });
  }
}