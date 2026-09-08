import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { updateHabitOptionSchema, parseOr400 } from '@/lib/validation';

// PUT /api/habit-options/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = parseOr400(updateHabitOptionSchema, body);
    if (!parsed.success) return parsed.response;
    const d = parsed.data;

    // BUGHUNT-ROUND3 LABEL-RENAME-1: habits store category/priority/difficulty
    // as plain NAME strings (no FK to HabitOption). Renaming a label without
    // cascading silently orphaned every habit referencing the old name —
    // their category badge lost its color mapping (categoryMap lookup miss →
    // gray fallback), the habit vanished from the renamed category's filter,
    // and the Habit form's Select showed an empty value when editing.
    // Fix: when the name changes, update the matching field on all habits in
    // the same request so the label rename is a true rename, not a new label.
    const existing = await db.habitOption.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Habit option not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (d.name !== undefined) data.name = d.name.trim();
    if (d.color !== undefined) data.color = d.color;
    if (d.xp !== undefined) data.xp = d.xp;
    if (d.order !== undefined) data.order = d.order;

    const newName =
      d.name !== undefined ? d.name.trim() : undefined;
    if (newName !== undefined && newName !== existing.name) {
      // Prisma requires a concrete where/data pair — map option type → the
      // corresponding Habit column.
      const field =
        existing.type === 'category'
          ? 'category'
          : existing.type === 'priority'
            ? 'priority'
            : 'difficulty';
      await db.habit.updateMany({
        where: { [field]: existing.name },
        data: { [field]: newName },
      });
    }

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