import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/finance/categories?type=expense
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const where: Record<string, unknown> = {};
    if (type) where.type = type;

    const categories = await db.financeCategory.findMany({
      where,
      orderBy: { order: 'asc' },
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error('GET /api/finance/categories error:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

// POST /api/finance/categories
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, name, emoji, color } = body;

    if (!type || !['income', 'expense'].includes(type)) {
      return NextResponse.json({ error: 'Valid type (income/expense) is required' }, { status: 400 });
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const maxOrder = await db.financeCategory.findFirst({
      where: { type },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const category = await db.financeCategory.create({
      data: {
        type,
        name: name.trim(),
        emoji: emoji || '📦',
        color: color || '#78716c',
        order: (maxOrder?.order || 0) + 1,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('POST /api/finance/categories error:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}