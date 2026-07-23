import { db } from '@/lib/db';
import { updateBalanceSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

// PATCH /api/finance/sources/[id]/balance
// Update only the balance of a fund source (manual adjustment / reconciliation).
// Balance must be a whole number (Int).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = parseOr400(updateBalanceSchema, body);
    if (!parsed.success) return parsed.response;
    const { balance } = parsed.data;

    const existing = await db.fundSource.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Sumber dana tidak ditemukan' }, { status: 404 });
    }

    const source = await db.fundSource.update({
      where: { id },
      data: { balance },
    });

    return NextResponse.json(source);
  } catch (error) {
    console.error('PATCH /api/finance/sources/[id]/balance error:', error);
    return NextResponse.json({ error: 'Failed to update balance' }, { status: 500 });
  }
}
