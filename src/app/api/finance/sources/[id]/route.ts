import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// PUT /api/finance/sources/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, emoji, type, initialBalance } = body;

    const existing = await db.fundSource.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    const oldName = existing.name;
    const newName = name?.trim() || oldName;

    // Check duplicate name if renaming
    if (newName !== oldName) {
      const duplicate = await db.fundSource.findUnique({ where: { name: newName } });
      if (duplicate) {
        return NextResponse.json({ error: 'Nama sumber dana sudah digunakan' }, { status: 400 });
      }
    }

    const validTypes = ['tunai', 'bank', 'dompet_digital', 'tabungan', 'investasi'];

    const source = await db.fundSource.update({
      where: { id },
      data: {
        ...(name && { name: newName }),
        ...(emoji && { emoji }),
        ...(type && validTypes.includes(type) && { type }),
        ...(initialBalance !== undefined && { initialBalance }),
      },
    });

    // If name changed, update all transactions that use the old name
    if (newName !== oldName) {
      await db.transaction.updateMany({
        where: { source: oldName },
        data: { source: newName },
      });
    }

    return NextResponse.json(source);
  } catch (error) {
    console.error('PUT /api/finance/sources/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update source' }, { status: 500 });
  }
}

// DELETE /api/finance/sources/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await db.fundSource.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Check if source is used in transactions
    const txCount = await db.transaction.count({
      where: { source: existing.name },
    });
    if (txCount > 0) {
      return NextResponse.json(
        { error: `Tidak bisa hapus "${existing.name}" karena masih ada ${txCount} transaksi yang menggunakan sumber ini` },
        { status: 400 }
      );
    }

    await db.fundSource.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/finance/sources/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete source' }, { status: 500 });
  }
}