import { db } from '@/lib/db';
import { updateCategorySchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

// PUT /api/finance/categories/[id]
// Renaming a category also updates all Transaction.category and Budget.category rows atomically.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = parseOr400(updateCategorySchema, body);
    if (!parsed.success) return parsed.response;
    const { name, emoji, color, order, trackLastDone } = parsed.data;

    const existing = await db.financeCategory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const oldName = existing.name;
    const newName = name ?? oldName;

    const category = await db.$transaction(async (tx) => {
      const updated = await tx.financeCategory.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: newName }),
          ...(emoji !== undefined && { emoji }),
          ...(color !== undefined && { color }),
          ...(order !== undefined && { order }),
          ...(trackLastDone !== undefined && { trackLastDone }),
        },
      });

      if (newName !== oldName) {
        await tx.transaction.updateMany({
          where: { category: oldName, type: existing.type },
          data: { category: newName },
        });
        await tx.budget.updateMany({
          where: { category: oldName },
          data: { category: newName },
        });
      }
      return updated;
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error('PUT /api/finance/categories/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

// DELETE /api/finance/categories/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await db.financeCategory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const txCount = await db.transaction.count({
      where: { category: existing.name, type: existing.type },
    });
    if (txCount > 0) {
      return NextResponse.json(
        { error: `Tidak bisa hapus "${existing.name}" karena masih ada ${txCount} transaksi yang menggunakan kategori ini` },
        { status: 400 }
      );
    }

    await db.$transaction([
      db.budget.deleteMany({ where: { category: existing.name } }),
      db.financeCategory.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/finance/categories/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
