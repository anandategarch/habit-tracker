// PUT/DELETE /api/finance/budgets/[id].
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  asString,
  badRequest,
  handleApiError,
  notFound,
  readJsonBody,
  requireNonEmptyString,
  requirePositiveNumber,
} from '@/app/api/_lib/api-utils';
import { fetchBudgetItems } from '@/app/api/_lib/budget-utils';
import { isValidMonth } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const budget = await db.weeklyBudget.findUnique({ where: { id } });
    if (!budget) throw notFound('Budget tidak ditemukan');

    const body = await readJsonBody(req);
    const data: Record<string, unknown> = {};

    if ('category' in body) {
      const category = requireNonEmptyString(body.category, 'Kategori budget wajib diisi');
      if (category.length > 80) throw badRequest('Kategori terlalu panjang');
      data.category = category;
    }
    if ('month' in body) {
      const month = asString(body.month);
      if (month === null || !isValidMonth(month)) throw badRequest('Bulan tidak valid (format yyyy-MM)');
      data.month = month;
    }
    if ('amount' in body) {
      const amount = requirePositiveNumber(body.amount, 'Jumlah budget harus lebih dari 0');
      if (amount > 1e12) throw badRequest('Jumlah budget tidak valid');
      data.amount = amount;
    }

    if (Object.keys(data).length === 0) throw badRequest('Tidak ada field yang bisa diperbarui');

    try {
      await db.weeklyBudget.update({ where: { id }, data });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw badRequest('Budget untuk kategori dan bulan tersebut sudah ada');
      }
      throw e;
    }

    const updated = await db.weeklyBudget.findUnique({ where: { id } });
    const month = (updated?.month ?? budget.month) as string;
    const items = await fetchBudgetItems(month);
    const item = items.find((b) => b.id === id) ?? null;
    return NextResponse.json(item);
  } catch (error) {
    return handleApiError(error, 'finance/budgets/[id]:PUT');
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const budget = await db.weeklyBudget.findUnique({ where: { id }, select: { id: true } });
    if (!budget) throw notFound('Budget tidak ditemukan');
    await db.weeklyBudget.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'finance/budgets/[id]:DELETE');
  }
}
