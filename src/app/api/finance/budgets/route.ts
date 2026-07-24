import { db } from '@/lib/db';
import { createBudgetSchema, parseOr400 } from '@/lib/validation';
import { NextResponse } from 'next/server';

// GET /api/finance/budgets
export async function GET() {
  try {
    const budgets = await db.budget.findMany({ orderBy: { category: 'asc' } });
    return NextResponse.json(budgets);
  } catch (error) {
    console.error('GET /api/finance/budgets error:', error);
    return NextResponse.json([]);
  }
}

// POST /api/finance/budgets - upsert by category
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = parseOr400(createBudgetSchema, body);
    if (!parsed.success) return parsed.response;
    const { category, amount, period } = parsed.data;

    const budget = await db.budget.upsert({
      where: { category },
      create: {
        category,
        amount,
        period: period ?? 'monthly',
      },
      update: {
        amount,
        period: period ?? 'monthly',
      },
    });

    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    console.error('POST /api/finance/budgets error:', error);
    return NextResponse.json({ error: 'Failed to create/update budget' }, { status: 500 });
  }
}
