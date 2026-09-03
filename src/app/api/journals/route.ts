import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { createJournalSchema, parseOr400 } from '@/lib/validation';
import { dateFromYMD } from '@/lib/timezone';

// GET /api/journals
// BUGHUNT-OTHER-1 BUG-L14: previously capped at `take: 100` with no
// pagination — users with >100 journal entries silently lost access to
// the older ones. The journal UI shows an infinite-scroll-free list, so
// remove the cap entirely (journal entries are bounded by 1/day → ~365/yr,
// which is well within SQLite's comfort zone).
// BUGHUNT-OTHER-1 BUG-L13: previously returned `[]` on error (silent
// failure) — the UI then rendered an empty list indistinguishable from
// "no entries yet". Return a proper error response so the client can
// show an error/retry state.
export async function GET() {
  try {
    const journals = await db.journal.findMany({
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(journals);
  } catch (error) {
    console.error('GET /api/journals error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch journals' },
      { status: 500 }
    );
  }
}

// POST /api/journals
export async function POST(request: NextRequest) {
  try {
    const parsed = parseOr400(createJournalSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const body = parsed.data;
    const { date, mood, stress, energy, sleep, reflection, winToday, lessonLearned, tomorrowPlan } = body;

    // BUG-10 + BUGHUNT-OTHER-1 BUG-M1: z.coerce.date() parses "2025-01-15" as
    // UTC midnight. Previously used `new Date(date).getFullYear()` etc., which
    // reads LOCAL components → on a non-UTC server (e.g. Jakarta dev server
    // UTC+7) the epoch shifts to 2025-01-14T17:00:00Z and getFullYear/getMonth/
    // getDate return Jan 14 → wrong day, uniqueness collision with the next
    // journal entry. Use UTC components to extract the YMD consistently.
    const dateObj = dateFromYMD(
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
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