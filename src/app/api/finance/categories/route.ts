import { db } from '@/lib/db';
import { createCategorySchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/finance/categories?type=expense
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const where: Record<string, unknown> = {};
    if (type) {
      if (!['income', 'expense'].includes(type)) {
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
      }
      where.type = type;
    }

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
    const parsed = parseOr400(createCategorySchema, body);
    if (!parsed.success) return parsed.response;
    const { type, name, emoji, color, trackLastDone } = parsed.data;

    const maxOrder = await db.financeCategory.findFirst({
      where: { type },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const category = await db.financeCategory.create({
      data: {
        type,
        name,
        emoji: emoji ?? '📦',
        color: color ?? '#78716c',
        trackLastDone: trackLastDone ?? false,
        order: (maxOrder?.order || 0) + 1,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('POST /api/finance/categories error:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
