import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PUT /api/habit-options/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, color, xp, order } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (color !== undefined) data.color = color;
    if (xp !== undefined) data.xp = xp;
    if (order !== undefined) data.order = order;

    const option = await db.habitOption.update({
      where: { id },
      data,
    });

    return NextResponse.json(option);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Habit option not found' }, { status: 404 });
    }
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'An option with this type and name already exists' },
        { status: 409 },
      );
    }
    console.error('PUT /api/habit-options/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update habit option' }, { status: 500 });
  }
}

// DELETE /api/habit-options/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    await db.habitOption.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Habit option not found' }, { status: 404 });
    }
    console.error('DELETE /api/habit-options/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete habit option' }, { status: 500 });
  }
}