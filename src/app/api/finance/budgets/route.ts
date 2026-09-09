// GET/POST /api/finance/budgets?month=yyyy-MM — budget bulanan + spent.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  asNumber,
  asString,
  badRequest,
  handleApiError,
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
    const saved = await db.weeklyBudget.upsert({
      where: { category_month: { category, month } },
      update: { amount },
      create: { category, month, amount },
    });

    const items = await fetchBudgetItems(month);
    const item = items.find((b) => b.id === saved.id) ?? null;
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'finance/budgets:POST');
  }
}
