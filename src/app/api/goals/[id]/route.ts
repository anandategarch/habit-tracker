import { db } from '@/lib/db';
import { updateGoalSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = parseOr400(updateGoalSchema, body);
    if (!parsed.success) return parsed.response;
    const d = parsed.data;
    const goal = await db.goal.update({
      where: { id },
      data: {
        ...(d.title !== undefined && { title: d.title }),
        ...(d.description !== undefined && { description: d.description }),
        ...(d.deadline !== undefined && { deadline: d.deadline ? new Date(d.deadline) : null }),
        ...(d.progress !== undefined && { progress: d.progress }),
        ...(d.priority !== undefined && { priority: d.priority }),
        ...(d.status !== undefined && { status: d.status }),
        ...(d.milestones !== undefined && { milestones: JSON.stringify(d.milestones) }),
        ...(d.achievement !== undefined && { achievement: d.achievement }),
      },
    });
    return NextResponse.json(goal);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.goal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 });
  }
}