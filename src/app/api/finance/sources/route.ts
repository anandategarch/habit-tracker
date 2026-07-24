import { db } from '@/lib/db';
import { createFundSourceSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/finance/sources
export async function GET() {
  try {
    const sources = await db.fundSource.findMany({
      orderBy: { order: 'asc' },
    });
    return NextResponse.json(sources);
  } catch (error) {
    console.error('GET /api/finance/sources error:', error);
    return NextResponse.json([]);
  }
}

// POST /api/finance/sources
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseOr400(createFundSourceSchema, body);
    if (!parsed.success) return parsed.response;
    const { name, emoji, balance, order } = parsed.data;

    // Check duplicate name
    const existing = await db.fundSource.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: 'Sumber dana sudah ada' }, { status: 400 });
    }

    const maxOrder = await db.fundSource.findFirst({
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const source = await db.fundSource.create({
      data: {
        name,
        emoji: emoji ?? '💵',
        balance: balance ?? 0,
        order: order ?? (maxOrder?.order || 0) + 1,
      },
    });

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    console.error('POST /api/finance/sources error:', error);
    return NextResponse.json({ error: 'Failed to create source' }, { status: 500 });
  }
}
