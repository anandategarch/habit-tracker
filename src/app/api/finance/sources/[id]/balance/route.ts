import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// PATCH /api/finance/sources/[id]/balance
// Update only the balance of a fund source
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { balance } = body;

    if (typeof balance !== 'number') {
      return NextResponse.json({ error: 'Balance harus berupa angka' }, { status: 400 });
    }

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