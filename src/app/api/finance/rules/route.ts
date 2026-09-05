import { db } from '@/lib/db';
import { createRuleSchema, updateRuleSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/finance/rules
// Returns all transaction rules ordered by priority (asc) then createdAt (asc).
export async function GET() {
  try {
    const rules = await db.transactionRule.findMany({
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json(rules);
  } catch (error) {
    console.error('GET /api/finance/rules error:', error);
    return NextResponse.json([]);
  }
}

// POST /api/finance/rules — create a new transaction rule.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseOr400(createRuleSchema, body);
    if (!parsed.success) return parsed.response;

    const {
      name,
      isActive,
      priority,
      conditionField,
      conditionOp,
      conditionValue,
      actionField,
      actionValue,
    } = parsed.data;

    const created = await db.transactionRule.create({
      data: {
        name,
        isActive: isActive ?? true,
        priority: priority ?? 0,
        conditionField,
        conditionOp,
        conditionValue,
        actionField,
        actionValue,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('POST /api/finance/rules error:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction rule' },
      { status: 500 }
    );
  }
}

// PUT /api/finance/rules — body-based update (id required).
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const id = body?.id;
    if (typeof id !== 'string' || !id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    const parsed = parseOr400(updateRuleSchema, body);
    if (!parsed.success) return parsed.response;

    // PHASE2-FINANCE-2: `id` is validated separately above and is NOT in
    // updateRuleSchema (it's a partial of createRuleSchema, which doesn't
    // include id). Pass parsed.data straight through as the update payload
    // — destructuring id out of parsed.data was a TS error.
    const update = parsed.data;
    const updated = await db.transactionRule.update({
      where: { id },
      data: update,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /api/finance/rules error:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction rule' },
      { status: 500 }
    );
  }
}

// DELETE /api/finance/rules?id=... — delete by id.
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    await db.transactionRule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/finance/rules error:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction rule' },
      { status: 500 }
    );
  }
}
