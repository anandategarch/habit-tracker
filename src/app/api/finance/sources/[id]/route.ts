import { db } from '@/lib/db';
import { updateFundSourceSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

// PUT /api/finance/sources/[id]
// Renaming the source also updates all Transaction.source fields atomically.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = parseOr400(updateFundSourceSchema.partial(), body);
    if (!parsed.success) return parsed.response;
    const { name, emoji, order } = parsed.data;

    const existing = await db.fundSource.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    const oldName = existing.name;
    const newName = name ?? oldName;

    // Check duplicate name if renaming
    if (newName !== oldName) {
      const duplicate = await db.fundSource.findUnique({ where: { name: newName } });
      if (duplicate) {
        return NextResponse.json({ error: 'Nama sumber dana sudah digunakan' }, { status: 400 });
      }
    }

    const source = await db.$transaction(async (tx) => {
      const updated = await tx.fundSource.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: newName }),
          ...(emoji !== undefined && { emoji }),
          ...(order !== undefined && { order }),
        },
      });

      // Cascade rename to transactions to keep them consistent.
      if (newName !== oldName) {
        await tx.transaction.updateMany({
          where: { source: oldName },
          data: { source: newName },
        });
      }
      return updated;
    });

    return NextResponse.json(source);
  } catch (error) {
    console.error('PUT /api/finance/sources/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update source' }, { status: 500 });
  }
}

// DELETE /api/finance/sources/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await db.fundSource.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Block deletion if transactions still reference this source.
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
