import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/finance/budgets
export async function GET() {
  try {
    const budgets = await db.budget.findMany({ orderBy: { category: 'asc' } });
    return NextResponse.json(budgets);
  } catch (error) {
    console.error('GET /api/finance/budgets error:', error);
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 });
  }
}

// POST /api/finance/budgets - upsert by category
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { category, amount, period } = body;

    if (!category?.trim()) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }

    const budget = await db.budget.upsert({
      where: { category: category.trim() },
      create: {
        category: category.trim(),
        amount: numAmount,
        period: period || 'monthly',
      },
      update: {
        amount: numAmount,
        period: period || 'monthly',
      },
    });

    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    console.error('POST /api/finance/budgets error:', error);
    return NextResponse.json({ error: 'Failed to create/update budget' }, { status: 500 });
  }
}