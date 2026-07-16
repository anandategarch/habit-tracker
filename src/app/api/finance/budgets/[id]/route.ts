import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// PUT /api/finance/budgets/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { category, amount, period } = body;

    const budget = await db.budget.update({
      where: { id },
      data: {
        ...(category !== undefined && { category: category.trim() }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
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