import { db } from '@/lib/db';
import { updateJournalSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

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
    const journal = await db.journal.update({
      where: { id },
      data: {
        ...(d.mood !== undefined && { mood: d.mood }),
        ...(d.stress !== undefined && { stress: d.stress }),
        ...(d.energy !== undefined && { energy: d.energy }),
        ...(d.sleep !== undefined && { sleep: d.sleep }),
        ...(d.reflection !== undefined && { reflection: d.reflection }),
        ...(d.winToday !== undefined && { winToday: d.winToday }),
        ...(body.lessonLearned !== undefined && { lessonLearned: body.lessonLearned }),
        ...(body.tomorrowPlan !== undefined && { tomorrowPlan: body.tomorrowPlan }),
      },
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