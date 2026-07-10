import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// POST /api/finance/categories/ensure-table
// Auto-creates FinanceCategory table if missing (for Turso deployments where prisma db push hasn't been run)
export async function POST() {
  try {
    // Check if FinanceCategory table exists
    const rows = await db.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='FinanceCategory'`
    );
    const tableExists = rows.length > 0;

    if (!tableExists) {
      // Create the full table
      await db.$executeRawUnsafe(`
        CREATE TABLE "FinanceCategory" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "type" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "emoji" TEXT NOT NULL DEFAULT '📦',
          "color" TEXT NOT NULL DEFAULT '#78716c',
          "order" INTEGER NOT NULL DEFAULT 0,
          "trackLastDone" BOOLEAN NOT NULL DEFAULT 0,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        )
      `);
      return NextResponse.json({ success: true, action: 'created_table' });
    }

    // Table exists — check for missing columns
    const columns = await db.$queryRawUnsafe<{ name: string }[]>(
      `PRAGMA table_info("FinanceCategory")`
    );
    const columnNames = columns.map(c => c.name);

    const migrations: string[] = [];

    if (!columnNames.includes('trackLastDone')) {
      await db.$executeRawUnsafe(
        `ALTER TABLE "FinanceCategory" ADD COLUMN "trackLastDone" BOOLEAN NOT NULL DEFAULT 0`
      );
      migrations.push('added trackLastDone');
    }

    if (!columnNames.includes('color')) {
      await db.$executeRawUnsafe(
        `ALTER TABLE "FinanceCategory" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#78716c'`
      );
      migrations.push('added color');
    }

    if (!columnNames.includes('emoji')) {
      await db.$executeRawUnsafe(
        `ALTER TABLE "FinanceCategory" ADD COLUMN "emoji" TEXT NOT NULL DEFAULT '📦'`
      );
      migrations.push('added emoji');
    }

    if (!columnNames.includes('order')) {
      await db.$executeRawUnsafe(
        `ALTER TABLE "FinanceCategory" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0`
      );
      migrations.push('added order');
    }

    return NextResponse.json({
      success: true,
      action: migrations.length > 0 ? `migrated: ${migrations.join(', ')}` : 'already_up_to_date',
    });
  } catch (error) {
    console.error('Ensure table error:', error);
    return NextResponse.json({ error: 'Failed to ensure table' }, { status: 500 });
  }
}