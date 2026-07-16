import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const results: string[] = [];

    // 1. Ensure source column on Transaction
    try {
      await db.$executeRawUnsafe('ALTER TABLE [Transaction] ADD COLUMN source TEXT DEFAULT \'Kas\'');
      results.push('Column "source" added to Transaction table');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('duplicate column name')) {
        results.push('Column "source" already exists');
      } else {
        throw e;
      }
    }

    // 2. Ensure FundSource table exists
    try {
      await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS [FundSource] (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        emoji TEXT DEFAULT '💵',
        balance REAL DEFAULT 0,
        "order" INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
      )`);
      results.push('FundSource table ensured');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('already exists')) throw e;
      results.push('FundSource table already exists');
    }

    // 3. Ensure HabitOption table exists
    try {
      await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "HabitOption" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "type" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "color" TEXT NOT NULL DEFAULT 'gray',
        "xp" INTEGER NOT NULL DEFAULT 0,
        "order" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
        "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
      )`);
      results.push('HabitOption table ensured');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('already exists')) throw e;
      results.push('HabitOption table already exists');
    }

    // 3b. Ensure FundSource has balance column (for tables created before this fix)
    try {
      await db.$executeRawUnsafe('ALTER TABLE [FundSource] ADD COLUMN balance REAL DEFAULT 0');
      results.push('Column "balance" added to FundSource table');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('duplicate column name')) {
        results.push('Column "balance" already exists in FundSource');
      } else {
        results.push(`FundSource balance migration skipped: ${msg}`);
      }
    }

    // Create indexes for HabitOption
    try {
      await db.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "HabitOption_type_name_key" ON "HabitOption"("type", "name")`
      );
    } catch { /* ignore */ }
    try {
      await db.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "HabitOption_type_idx" ON "HabitOption"("type")`
      );
    } catch { /* ignore */ }

    // 4. Ensure Habit table has trackTime column
    try {
      await db.$executeRawUnsafe('ALTER TABLE "Habit" ADD COLUMN "trackTime" BOOLEAN NOT NULL DEFAULT 0');
      results.push('Column "trackTime" added to Habit table');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('duplicate column name')) {
        results.push('Column "trackTime" already exists in Habit');
      } else {
        results.push(`Habit trackTime migration skipped: ${msg}`);
      }
    }

    // 5. Ensure Habit table has targetTime column
    try {
      await db.$executeRawUnsafe('ALTER TABLE "Habit" ADD COLUMN "targetTime" TEXT');
      results.push('Column "targetTime" added to Habit table');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('duplicate column name')) {
        results.push('Column "targetTime" already exists in Habit');
      } else {
        results.push(`Habit targetTime migration skipped: ${msg}`);
      }
    }

    // 6. Ensure HabitLog table has completedAt column
    try {
      await db.$executeRawUnsafe('ALTER TABLE "HabitLog" ADD COLUMN "completedAt" TEXT');
      results.push('Column "completedAt" added to HabitLog table');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('duplicate column name')) {
        results.push('Column "completedAt" already exists in HabitLog');
      } else {
        results.push(`HabitLog completedAt migration skipped: ${msg}`);
      }
    }

    // 7. Ensure Habit table has trackLastDone column
    try {
      await db.$executeRawUnsafe('ALTER TABLE "Habit" ADD COLUMN "trackLastDone" BOOLEAN NOT NULL DEFAULT 0');
      results.push('Column "trackLastDone" added to Habit table');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('duplicate column name')) {
        results.push('Column "trackLastDone" already exists in Habit');
      } else {
        results.push(`Habit trackLastDone migration skipped: ${msg}`);
      }
    }

    // 8. Ensure Habit table has lastDoneInterval column
    try {
      await db.$executeRawUnsafe('ALTER TABLE "Habit" ADD COLUMN "lastDoneInterval" TEXT');
      results.push('Column "lastDoneInterval" added to Habit table');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('duplicate column name')) {
        results.push('Column "lastDoneInterval" already exists in Habit');
      } else {
        results.push(`Habit lastDoneInterval migration skipped: ${msg}`);
      }
    }

    // 10. Create HabitGroup table + add groupId to Habit
    try {
      await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "HabitGroup" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "emoji" TEXT NOT NULL DEFAULT '📁',
        "color" TEXT NOT NULL DEFAULT '#22c55e',
        "order" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      )`);
      results.push('HabitGroup table created/verified');
    } catch (e: unknown) {
      results.push(`HabitGroup table: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      await db.$executeRawUnsafe('ALTER TABLE "Habit" ADD COLUMN "groupId" TEXT REFERENCES "HabitGroup"("id") ON DELETE SET NULL');
      results.push('Added groupId column to Habit');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('duplicate column name')) {
        results.push('Column "groupId" already exists in Habit');
      } else {
        results.push(`Habit groupId migration skipped: ${msg}`);
      }
    }

    // 9. Seed default sources if empty
    try {
      const count = await db.fundSource.count();
      if (count === 0) {
        const defaults = [
          { name: 'Kas', emoji: '💵', order: 0 },
          { name: 'Bank BCA', emoji: '🏦', order: 1 },
          { name: 'Bank BRI', emoji: '🏦', order: 2 },
          { name: 'Bank Mandiri', emoji: '🏦', order: 3 },
          { name: 'Bank BNI', emoji: '🏦', order: 4 },
          { name: 'Bank BSI', emoji: '🏦', order: 5 },
          { name: 'Bank Permata', emoji: '🏦', order: 6 },
          { name: 'GoPay', emoji: '💚', order: 7 },
          { name: 'OVO', emoji: '💜', order: 8 },
          { name: 'DANA', emoji: '💙', order: 9 },
          { name: 'ShopeePay', emoji: '🧡', order: 10 },
          { name: 'E-Money Lainnya', emoji: '💳', order: 11 },
        ];
        for (const src of defaults) {
          await db.fundSource.create({ data: src });
        }
        results.push('Seeded 12 default fund sources');
      } else {
        results.push(`FundSource table has ${count} entries`);
      }
    } catch (e: unknown) {
      results.push(`Seed check skipped: ${e instanceof Error ? e.message : String(e)}`);
    }

    return NextResponse.json({ success: true, message: results.join('; ') });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}