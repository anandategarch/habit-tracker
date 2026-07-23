import { db } from '@/lib/db';
import { updateHabitSchema, parseOr400 } from '@/lib/validation';
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
    const parsed = parseOr400(updateHabitSchema, body);
    if (!parsed.success) return parsed.response;
    const d = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (d.name !== undefined) updateData.name = d.name;
    if (d.icon !== undefined) updateData.icon = d.icon;
    if (d.category !== undefined) updateData.category = d.category;
    if (d.priority !== undefined) updateData.priority = d.priority;
    if (d.difficulty !== undefined) updateData.difficulty = d.difficulty;
    if (d.target !== undefined) updateData.target = d.target;
    if (d.targetType !== undefined) updateData.targetType = d.targetType;
    if (d.color !== undefined) updateData.color = d.color;
    if (d.reminder !== undefined) updateData.reminder = d.reminder;
    if (d.startDate !== undefined) updateData.startDate = d.startDate;
    if (d.endDate !== undefined) updateData.endDate = d.endDate;
    if (d.status !== undefined) updateData.status = d.status;
    if (d.notes !== undefined) updateData.notes = d.notes;
    if (d.order !== undefined) updateData.order = d.order;
    if (d.trackTime !== undefined) updateData.trackTime = d.trackTime;
    if (d.targetTime !== undefined) updateData.targetTime = d.targetTime;
    if (d.trackLastDone !== undefined) updateData.trackLastDone = d.trackLastDone;
    if (d.lastDoneInterval !== undefined) updateData.lastDoneInterval = d.lastDoneInterval;
    if (d.groupId !== undefined) updateData.groupId = d.groupId;

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
