import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/habits/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const habit = await db.habit.findUnique({
      where: { id },
      include: { logs: { orderBy: { date: 'desc' }, take: 30 } },
    });
    if (!habit) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
    }
    return NextResponse.json(habit);
  } catch (error) {
    console.error('GET /api/habits/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch habit' }, { status: 500 });
  }
}

// PUT /api/habits/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.difficulty !== undefined) updateData.difficulty = body.difficulty;
    if (body.target !== undefined) updateData.target = body.target;
    if (body.targetType !== undefined) updateData.targetType = body.targetType;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.reminder !== undefined) updateData.reminder = body.reminder;
    if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.order !== undefined) updateData.order = body.order;

    const habit = await db.habit.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(habit);
  } catch (error) {
    console.error('PUT /api/habits/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update habit' }, { status: 500 });
  }
}

// DELETE /api/habits/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.habit.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/habits/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete habit' }, { status: 500 });
  }
}