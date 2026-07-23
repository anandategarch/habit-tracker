import { db } from '@/lib/db';
import { updateBudgetSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

// PUT /api/finance/budgets/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = parseOr400(updateBudgetSchema, body);
    if (!parsed.success) return parsed.response;
    const { category, amount, period } = parsed.data;

    const budget = await db.budget.update({
      where: { id },
      data: {
        ...(category !== undefined && { category }),
        ...(amount !== undefined && { amount }),
        ...(period !== undefined && { period }),
      },
    });

    return NextResponse.json(budget);
  } catch (error) {
    console.error('PUT /api/finance/budgets/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 });
  }
}

// DELETE /api/finance/budgets/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.budget.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/finance/budgets/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 });
  }
}
