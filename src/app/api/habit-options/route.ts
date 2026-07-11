import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const VALID_TYPES = ['category', 'priority', 'difficulty'] as const;

// GET /api/habit-options?type=category
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const where = type ? { type } : {};

    const options = await db.habitOption.findMany({
      where,
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json(options);
  } catch (error) {
    console.error('GET /api/habit-options error:', error);
    return NextResponse.json({ error: 'Failed to fetch habit options' }, { status: 500 });
  }
}

// POST /api/habit-options
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, name, color, xp, order } = body;

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required and must not be empty' }, { status: 400 });
    }

    const option = await db.habitOption.create({
      data: {
        type,
        name: name.trim(),
        color: color || 'gray',
        xp: xp ?? 0,
        order: order ?? 0,
      },
    });

    return NextResponse.json(option, { status: 201 });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'An option with this type and name already exists' },
        { status: 409 },
      );
    }
    console.error('POST /api/habit-options error:', error);
    return NextResponse.json({ error: 'Failed to create habit option' }, { status: 500 });
  }
}