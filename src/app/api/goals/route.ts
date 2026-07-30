import { db } from '@/lib/db';
import { createGoalSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const goals = await db.goal.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(goals);
  } catch (error) {
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseOr400(createGoalSchema, body);
    if (!parsed.success) return parsed.response;
    const { title, description, deadline, priority, milestones } = parsed.data;

    const goal = await db.goal.create({
      data: {
        title: title.trim(),
        description: description || null,
        deadline: deadline ? new Date(deadline) : null,
        priority: priority || 'Medium',
        milestones: milestones ? JSON.stringify(milestones) : '[]',
      },
    });
    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
  }
}