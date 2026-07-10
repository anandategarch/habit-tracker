import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// PUT /api/finance/categories/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, emoji, color, order, trackLastDone } = body;

    // If renaming, also update all transactions and budgets that use the old name
    const existing = await db.financeCategory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const oldName = existing.name;
    const newName = name?.trim() || oldName;

    const category = await db.financeCategory.update({
      where: { id },
      data: {
        ...(name && { name: newName }),
        ...(emoji && { emoji }),
        ...(color && { color }),
        ...(order !== undefined && { order }),
        ...(trackLastDone !== undefined && { trackLastDone: !!trackLastDone }),
      },
    });

    // If category name changed, update existing transactions & budgets
    if (newName !== oldName) {
      await db.transaction.updateMany({
        where: { category: oldName, type: existing.type },
        data: { category: newName },
      });
      await db.budget.updateMany({
        where: { category: oldName },
        data: { category: newName },
      });
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error('PUT /api/finance/categories/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

// DELETE /api/finance/categories/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await db.financeCategory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Check if category is used in transactions
    const txCount = await db.transaction.count({
      where: { category: existing.name, type: existing.type },
    });
    if (txCount > 0) {
      return NextResponse.json(
        { error: `Tidak bisa hapus "${existing.name}" karena masih ada ${txCount} transaksi yang menggunakan kategori ini` },
        { status: 400 }
      );
    }

    // Also delete budget if exists
    await db.budget.deleteMany({ where: { category: existing.name } });
    await db.financeCategory.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/finance/categories/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}