import { db } from '@/lib/db';
import { updateJournalSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';
import { dateFromYMD } from '@/lib/timezone';

// GET /api/journals/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const journal = await db.journal.findUnique({ where: { id } });
    if (!journal) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(journal);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch journal' }, { status: 500 });
  }
}

// PUT /api/journals/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = parseOr400(updateJournalSchema, body);
    if (!parsed.success) return parsed.response;
    const d = parsed.data;
    // Cast to any: Prisma's generated types for SQLite nullable Int/Float
    // fields don't accept `null` directly in UpdateInput, but the runtime
    // correctly handles null for nullable columns. Zod validation already
    // ensures correct types.
    const journal = await db.journal.update({
      where: { id },
      data: {
        // BUG-10 fix: normalize to UTC midnight via dateFromYMD, consistent
        // with POST route. Prevents TZ-shifted epochs on non-UTC servers.
        ...(d.date !== undefined && {
          date: dateFromYMD(
            `${new Date(d.date).getFullYear()}-${String(new Date(d.date).getMonth() + 1).padStart(2, '0')}-${String(new Date(d.date).getDate()).padStart(2, '0')}`
          ),
        }),
        ...(d.mood !== undefined && { mood: d.mood }),
        ...(d.stress !== undefined && { stress: d.stress }),
        ...(d.energy !== undefined && { energy: d.energy }),
        ...(d.sleep !== undefined && { sleep: d.sleep }),
        ...(d.reflection !== undefined && { reflection: d.reflection }),
        ...(d.winToday !== undefined && { winToday: d.winToday }),
        ...(d.lessonLearned !== undefined && { lessonLearned: d.lessonLearned }),
        ...(d.tomorrowPlan !== undefined && { tomorrowPlan: d.tomorrowPlan }),
      } as any,
    });
    return NextResponse.json(journal);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update journal' }, { status: 500 });
  }
}

// DELETE /api/journals/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.journal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete journal' }, { status: 500 });
  }
}