// PUT/DELETE /api/finance/categories/[id] — rename CASCADE + guard hapus.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  asString,
  badRequest,
  handleApiError,
  notFound,
  readJsonBody,
  requireNonEmptyString,
} from '@/app/api/_lib/api-utils';

export const dynamic = 'force-dynamic';

const CATEGORY_TYPES = new Set(['expense', 'income']);

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const category = await db.financeCategory.findUnique({ where: { id } });
    if (!category) throw notFound('Kategori tidak ditemukan');

    const body = await readJsonBody(req);
    const data: Record<string, unknown> = {};
    const oldName = category.name;

    if ('name' in body) {
      const name = requireNonEmptyString(body.name, 'Nama kategori wajib diisi');
      if (name.length > 80) throw badRequest('Nama kategori terlalu panjang');
      data.name = name;
    }
    if ('emoji' in body) {
      const emoji = asString(body.emoji);
      if (emoji === null || !emoji.trim() || emoji.length > 16) throw badRequest('Emoji tidak valid');
      data.emoji = emoji.trim();
    }
    if ('color' in body) {
      const color = asString(body.color);
      if (color === null || !color.trim() || color.length > 20) throw badRequest('Warna tidak valid');
      data.color = color.trim();
    }
    if ('type' in body) {
      const type = asString(body.type);
      if (type === null || !CATEGORY_TYPES.has(type)) {
        throw badRequest('Tipe kategori tidak valid (expense atau income)');
      }
      data.type = type;
    }

    if (Object.keys(data).length === 0) throw badRequest('Tidak ada field yang bisa diperbarui');

    const newName = data.name as string | undefined;
    const renamed = newName !== undefined && newName !== oldName;

    const updated = await db.$transaction(async (tx) => {
      if (renamed) {
        // CASCADE rename: transaksi & budget menyimpan kategori by-name.
        await tx.transaction.updateMany({ where: { category: oldName }, data: { category: newName } });
        await tx.weeklyBudget.updateMany({ where: { category: oldName }, data: { category: newName } });
      }
      try {
        return await tx.financeCategory.update({ where: { id }, data });
      } catch (e) {
        if ((e as { code?: string }).code === 'P2002') {
          throw badRequest('Kategori dengan nama tersebut sudah ada');
        }
        throw e;
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'finance/categories/[id]:PUT');
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const category = await db.financeCategory.findUnique({ where: { id } });
    if (!category) throw notFound('Kategori tidak ditemukan');

    const usedCount = await db.transaction.count({ where: { category: category.name } });
    if (usedCount > 0) {
      throw badRequest(`Kategori masih dipakai ${usedCount} transaksi`);
    }

    await db.financeCategory.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'finance/categories/[id]:DELETE');
  }
}
