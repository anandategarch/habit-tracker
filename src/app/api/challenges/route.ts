import { db } from '@/lib/db';
import { createChallengeSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';
import { jakartaDateString } from '@/lib/timezone';

export async function GET() {
  try {
    const challenges = await db.challenge.findMany({ orderBy: { createdAt: 'desc' } });

    // BUGHUNT-OTHER-1 BUG-M7: auto-fail active challenges whose end date has
    // passed (and that didn't reach 100% completion). Without this, a
    // challenge stays 'active' forever even after its end date — polluting
    // the "Active" section and never moving to "Past". We do this here (in
    // GET) so the change applies without a separate cron/migration. Only
    // challenges with `progress < duration` and `endDate < today` are
    // updated; completed challenges stay completed.
    const todayYmd = jakartaDateString();
    const toFail = challenges.filter((c) => {
      if (c.status !== 'active') return false;
      if (c.progress >= c.duration) return false; // already complete
      if (!c.endDate) return false;
      // endDate is stored as UTC midnight; its YMD prefix is the
      // user-meaningful calendar date.
      const endYmd = c.endDate.toISOString().slice(0, 10);
      return endYmd < todayYmd;
    });

    if (toFail.length > 0) {
      await Promise.all(
        toFail.map((c) =>
          db.challenge.update({ where: { id: c.id }, data: { status: 'failed' } })
        )
      );
      // Reflect the updated status in the response.
      const failedIds = new Set(toFail.map((c) => c.id));
      return NextResponse.json(
        challenges.map((c) => (failedIds.has(c.id) ? { ...c, status: 'failed' } : c))
      );
    }

    return NextResponse.json(challenges);
  } catch (error) {
    console.error('GET /api/challenges error:', error);
    // BUGHUNT-OTHER-1 M-pattern: return proper error instead of silent [].
    return NextResponse.json(
      { error: 'Failed to fetch challenges' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseOr400(createChallengeSchema, body);
    if (!parsed.success) return parsed.response;
    const { title, description, duration, startDate, endDate } = parsed.data;

    const challenge = await db.challenge.create({
      data: {
        title: title.trim(),
        description: description || null,
        duration: duration || 30,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
      },
    });
    return NextResponse.json(challenge, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create challenge' }, { status: 500 });
  }
}