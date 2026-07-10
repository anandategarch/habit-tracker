import { db } from '@/lib/db';
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
    return NextResponse.json({ error: 'Failed to fetch sources' }, { status: 500 });
  }
}

// POST /api/finance/sources
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, emoji } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Source name is required' }, { status: 400 });
    }

    // Check duplicate name
    const existing = await db.fundSource.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return NextResponse.json({ error: 'Sumber dana sudah ada' }, { status: 400 });
    }

    const maxOrder = await db.fundSource.findFirst({
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const source = await db.fundSource.create({
      data: {
        name: name.trim(),
        emoji: emoji || '💵',
        balance: typeof body.balance === 'number' ? body.balance : 0,
        order: (maxOrder?.order || 0) + 1,
      },
    });

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    console.error('POST /api/finance/sources error:', error);
    return NextResponse.json({ error: 'Failed to create source' }, { status: 500 });
  }
}