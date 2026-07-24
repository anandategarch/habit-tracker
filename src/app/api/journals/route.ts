import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { createJournalSchema, parseOr400 } from '@/lib/validation';

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

    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

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
      update: {
        ...(mood !== undefined && { mood }),
        ...(stress !== undefined && { stress }),
        ...(energy !== undefined && { energy }),
        ...(sleep !== undefined && { sleep }),
        ...(reflection !== undefined && { reflection }),
        ...(winToday !== undefined && { winToday }),
        ...(lessonLearned !== undefined && { lessonLearned }),
        ...(tomorrowPlan !== undefined && { tomorrowPlan }),
      },
    });

    return NextResponse.json(journal);
  } catch (error) {
    console.error('POST /api/journals error:', error);
    return NextResponse.json({ error: 'Failed to save journal' }, { status: 500 });
  }
}