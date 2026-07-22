import { db } from '@/lib/db';
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
    const journal = await db.journal.update({
      where: { id },
      data: {
        ...(body.mood !== undefined && { mood: body.mood }),
        ...(body.stress !== undefined && { stress: body.stress }),
        ...(body.energy !== undefined && { energy: body.energy }),
        ...(body.sleep !== undefined && { sleep: body.sleep }),
        ...(body.reflection !== undefined && { reflection: body.reflection }),
        ...(body.winToday !== undefined && { winToday: body.winToday }),
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