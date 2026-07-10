import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// POST /api/finance/categories/ensure-table
// Auto-creates missing tables/columns (for Turso deployments where prisma db push hasn't been run)
export async function POST() {
  try {
    const migrations: string[] = [];

    // ── FinanceCategory table ──
    const catRows = await db.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='FinanceCategory'`
    );

    if (catRows.length === 0) {
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
      migrations.push('created FinanceCategory table');
    } else {
      const catCols = await db.$queryRawUnsafe<{ name: string }[]>(
        `PRAGMA table_info("FinanceCategory")`
      );
      const catColNames = catCols.map(c => c.name);
      if (!catColNames.includes('trackLastDone')) {
        await db.$executeRawUnsafe(`ALTER TABLE "FinanceCategory" ADD COLUMN "trackLastDone" BOOLEAN NOT NULL DEFAULT 0`);
        migrations.push('FinanceCategory: added trackLastDone');
      }
    }

    // ── FundSource table — create if missing, add balance column if needed ──
    const srcRows = await db.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='FundSource'`
    );
    if (srcRows.length === 0) {
      await db.$executeRawUnsafe(`
        CREATE TABLE "FundSource" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "name" TEXT NOT NULL UNIQUE,
          "emoji" TEXT NOT NULL DEFAULT '💵',
          "balance" REAL NOT NULL DEFAULT 0,
          "order" INTEGER NOT NULL DEFAULT 0,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        )
      `);
      migrations.push('created FundSource table');
    } else {
      const srcCols = await db.$queryRawUnsafe<{ name: string }[]>(
        `PRAGMA table_info("FundSource")`
      );
      const srcColNames = srcCols.map(c => c.name);
      if (!srcColNames.includes('balance')) {
        await db.$executeRawUnsafe(`ALTER TABLE "FundSource" ADD COLUMN "balance" REAL NOT NULL DEFAULT 0`);
        migrations.push('FundSource: added balance');
      }
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