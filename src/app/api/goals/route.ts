import { db } from '@/lib/db';
import { createGoalSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const goals = await db.goal.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(goals);
  } catch (error) {
    console.error('GET /api/goals error:', error);
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
        // `milestones` is already a JSON string from the client (the goals
        // component calls `JSON.stringify(form.milestones)` before sending).
        // Previously this called `JSON.stringify(milestones)` again, wrapping
        // it in extra quotes on every save and silently corrupting the data.
        milestones: milestones || '[]',
      },
    });
    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    console.error('POST /api/goals error:', error);
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
  }
}