import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/finance/transactions/[id]
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const transaction = await db.transaction.findUnique({ where: { id } });
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }
    return NextResponse.json(transaction);
  } catch (error) {
    console.error('GET /api/finance/transactions/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 });
  }
}

// PUT /api/finance/transactions/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { type, amount, category, description, date, notes, source } = body;

    const transaction = await db.transaction.update({
      where: { id },
      data: {
        ...(type !== undefined && { type }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(category !== undefined && { category: category.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(source !== undefined && { source: source?.trim() || 'Kas' }),
      },
    });

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('PUT /api/finance/transactions/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}

// DELETE /api/finance/transactions/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.transaction.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/finance/transactions/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}