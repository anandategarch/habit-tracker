import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/habit-groups
export async function GET() {
  try {
    const groups = await db.habitGroup.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: { select: { habits: true } },
        habits: {
          where: { status: 'active' },
          select: { id: true, name: true, icon: true, order: true },
          orderBy: { order: 'asc' },
        },
      },
    });
    return NextResponse.json(groups);
  } catch (error) {
    console.error('GET /api/habit-groups error:', error);
    return NextResponse.json([]);
  }
}

// POST /api/habit-groups — create group
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, emoji, color } = body as { name: string; emoji?: string; color?: string };

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Get max order
    const maxOrder = await db.habitGroup.aggregate({ _max: { order: true } });
    const order = (maxOrder._max.order ?? -1) + 1;

    const group = await db.habitGroup.create({
      data: {
        name: name.trim(),
        emoji: emoji || '📁',
        color: color || '#22c55e',
        order,
      },
    });

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    console.error('POST /api/habit-groups error:', error);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}

// PUT /api/habit-groups — update group
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, emoji, color, order } = body as {
      id: string; name?: string; emoji?: string; color?: string; order?: number;
    };

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (emoji !== undefined) data.emoji = emoji;
    if (color !== undefined) data.color = color;
    if (order !== undefined) data.order = order;

    const group = await db.habitGroup.update({
      where: { id },
      data,
    });

    return NextResponse.json(group);
  } catch (error) {
    console.error('PUT /api/habit-groups error:', error);
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
  }
}

// DELETE /api/habit-groups?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Remove groupId from all habits in this group (SetNull is handled by schema)
    await db.habit.updateMany({
      where: { groupId: id },
      data: { groupId: null },
    });

    await db.habitGroup.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/habit-groups error:', error);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}