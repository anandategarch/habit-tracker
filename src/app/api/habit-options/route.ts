import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const VALID_TYPES = ['category', 'priority', 'difficulty'] as const;

const DEFAULTS = [
  // Categories
  { type: 'category', name: 'General', color: 'slate', xp: 0, order: 0 },
  { type: 'category', name: 'Health', color: 'emerald', xp: 0, order: 1 },
  { type: 'category', name: 'Fitness', color: 'orange', xp: 0, order: 2 },
  { type: 'category', name: 'Learning', color: 'blue', xp: 0, order: 3 },
  { type: 'category', name: 'Mindfulness', color: 'violet', xp: 0, order: 4 },
  { type: 'category', name: 'Productivity', color: 'amber', xp: 0, order: 5 },
  { type: 'category', name: 'Social', color: 'pink', xp: 0, order: 6 },
  { type: 'category', name: 'Creative', color: 'fuchsia', xp: 0, order: 7 },
  // Priorities
  { type: 'priority', name: 'Low', color: 'green', xp: 0, order: 0 },
  { type: 'priority', name: 'Medium', color: 'amber', xp: 0, order: 1 },
  { type: 'priority', name: 'High', color: 'red', xp: 0, order: 2 },
  // Difficulties
  { type: 'difficulty', name: 'Easy', color: 'green', xp: 10, order: 0 },
  { type: 'difficulty', name: 'Medium', color: 'amber', xp: 20, order: 1 },
  { type: 'difficulty', name: 'Hard', color: 'red', xp: 40, order: 2 },
];

let seeded = false;

/** Ensure the HabitOption table exists (auto-migration for Turso/Vercel) */
async function ensureTable() {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "HabitOption" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "type" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "color" TEXT NOT NULL DEFAULT 'gray',
        "xp" INTEGER NOT NULL DEFAULT 0,
        "order" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
        "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    // Create unique index if not exists (SQLite ignores IF NOT EXISTS for indexes sometimes)
    try {
      await db.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "HabitOption_type_name_key" ON "HabitOption"("type", "name")`
      );
    } catch {
      // Index might already exist, ignore
    }
    try {
      await db.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "HabitOption_type_idx" ON "HabitOption"("type")`
      );
    } catch {
      // Index might already exist, ignore
    }
  } catch (error) {
    console.error('Failed to create HabitOption table:', error);
  }
}

async function ensureDefaults() {
  if (seeded) return;
  try {
    const count = await db.habitOption.count();
    if (count === 0) {
      await db.habitOption.createMany({ data: DEFAULTS });
    }
  } catch {
    // Table might not exist yet, try creating it
    await ensureTable();
    try {
      const count = await db.habitOption.count();
      if (count === 0) {
        await db.habitOption.createMany({ data: DEFAULTS });
      }
    } catch (err) {
      console.error('Failed to seed habit options after table creation:', err);
    }
  }
  seeded = true;
}

// GET /api/habit-options?type=category
export async function GET(request: NextRequest) {
  try {
    await ensureDefaults();

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