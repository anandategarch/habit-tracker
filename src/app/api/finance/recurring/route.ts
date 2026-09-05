import { db } from '@/lib/db';
import { createRecurringSchema, updateRecurringSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/finance/recurring
// Returns all recurring transaction templates (active first, then newest).
export async function GET() {
  try {
    const recurring = await db.recurringTransaction.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(recurring);
  } catch (error) {
    console.error('GET /api/finance/recurring error:', error);
    return NextResponse.json([]);
  }
}

// POST /api/finance/recurring — create a new recurring transaction template.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseOr400(createRecurringSchema, body);
    if (!parsed.success) return parsed.response;

    const {
      type,
      amount,
      category,
      description,
      source,
      frequency,
      dayOfMonth,
      dayOfWeek,
      interval,
      startDate,
      endDate,
      isActive,
    } = parsed.data;

    const created = await db.recurringTransaction.create({
      data: {
        type,
        amount,
        category,
        description: description ?? null,
        source: source ?? 'Kas',
        frequency,
        dayOfMonth: dayOfMonth ?? null,
        dayOfWeek: dayOfWeek ?? null,
        interval: interval ?? 1,
        startDate: startDate ?? new Date(),
        endDate: endDate ?? null,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('POST /api/finance/recurring error:', error);
    return NextResponse.json(
      { error: 'Failed to create recurring transaction' },
      { status: 500 }
    );
  }
}

// PUT /api/finance/recurring — body-based update (id required).
// We follow the same body-based PUT pattern as /api/habit-groups (since
// the recurring route has no [id] dynamic segment).
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const id = body?.id;
    if (typeof id !== 'string' || !id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    const parsed = parseOr400(updateRecurringSchema, body);
    if (!parsed.success) return parsed.response;

    // PHASE2-FINANCE-2: `id` is validated separately above and is NOT in
    // updateRecurringSchema (it's a partial of createRecurringSchema, which
    // doesn't include id). Pass parsed.data straight through as the update
    // payload — destructuring id out of parsed.data was a TS error.
    const update = parsed.data;
    const updated = await db.recurringTransaction.update({
      where: { id },
      data: update,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /api/finance/recurring error:', error);
    return NextResponse.json(
      { error: 'Failed to update recurring transaction' },
      { status: 500 }
    );
  }
}

// DELETE /api/finance/recurring?id=... — delete by id.
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    await db.recurringTransaction.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/finance/recurring error:', error);
    return NextResponse.json(
      { error: 'Failed to delete recurring transaction' },
      { status: 500 }
    );
  }
}
