// GET/POST /api/finance/budgets?month=yyyy-MM — budget bulanan + spent.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  ApiError,
  asNumber,
  asString,
  badRequest,
  handleApiError,
  notFound,
  readJsonBody,
  requireNonEmptyString,
  requirePositiveNumber,
} from '@/app/api/_lib/api-utils';
import { fetchBudgetItems } from '@/app/api/_lib/budget-utils';
import { isValidMonth, jakartaMonthString } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const monthParam = new URL(req.url).searchParams.get('month');
    const month = monthParam ?? jakartaMonthString();
    if (!isValidMonth(month)) throw badRequest('Parameter month tidak valid (format yyyy-MM)');
    const budgets = await fetchBudgetItems(month);
    return NextResponse.json({ budgets });
  } catch (error) {
    return handleApiError(error, 'finance/budgets:GET');
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);
    const category = requireNonEmptyString(body.category, 'Kategori budget wajib diisi');
    if (category.length > 80) throw badRequest('Kategori terlalu panjang');

    const month = asString(body.month) ?? jakartaMonthString();
    if (!isValidMonth(month)) throw badRequest('Bulan tidak valid (format yyyy-MM)');

    const amount = requirePositiveNumber(body.amount, 'Jumlah budget harus lebih dari 0');
    if (amount > 1e12) throw badRequest('Jumlah budget tidak valid');

    // Upsert by (category, month) — unik di schema.
    // Task 60-b (audit 59-b5): tangkap error Prisma race —
    //  * P2002 (double-submit lolos ke jalur create bersamaan) → 409, bukan 500;
    //  * P2025 (budget dihapus konkuren di antara findUnique→update internal
    //    upsert / TOCTOU) → 404, bukan 500.
    // Bentuk response sukses tidak berubah (item + 201).
    let saved;
    try {
      saved = await db.weeklyBudget.upsert({
        where: { category_month: { category, month } },
        update: { amount },
        create: { category, month, amount },
      });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'P2002') {
        throw new ApiError(409, 'Anggaran untuk kategori & bulan itu sudah ada');
      }
      if (code === 'P2025') {
        throw notFound('Anggaran tidak ditemukan');
      }
      throw e;
    }

    const items = await fetchBudgetItems(month);
    const item = items.find((b) => b.id === saved.id) ?? null;
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'finance/budgets:POST');
  }
}
