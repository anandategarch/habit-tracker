import { db } from '@/lib/db';

let ensured = false;

/**
 * Ensures all custom columns exist in the Turso production database.
 * Safe to call multiple times — runs ALTER TABLE only once per process
 * via module-level `ensured` flag.
 */
export async function ensureTimeTrackingColumns(): Promise<void> {
  if (ensured) return;
  // trackTime, targetTime on Habit
  try {
    await db.$executeRawUnsafe('ALTER TABLE "Habit" ADD COLUMN "trackTime" BOOLEAN NOT NULL DEFAULT 0');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
      console.error('ensure-columns error:', msg);
    }
  }
  try {
    await db.$executeRawUnsafe('ALTER TABLE "Habit" ADD COLUMN "targetTime" TEXT');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
      console.error('ensure-columns error:', msg);
    }
  }
  // completedAt on HabitLog
  try {
    await db.$executeRawUnsafe('ALTER TABLE "HabitLog" ADD COLUMN "completedAt" TEXT');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
      console.error('ensure-columns error:', msg);
    }
  }
  // trackLastDone, lastDoneInterval on Habit
  try {
    await db.$executeRawUnsafe('ALTER TABLE "Habit" ADD COLUMN "trackLastDone" BOOLEAN NOT NULL DEFAULT 0');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
      console.error('ensure-columns error:', msg);
    }
  }
  try {
    await db.$executeRawUnsafe('ALTER TABLE "Habit" ADD COLUMN "lastDoneInterval" TEXT');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
      console.error('ensure-columns error:', msg);
    }
  }
  // groupId on Habit
  try {
    await db.$executeRawUnsafe('ALTER TABLE "Habit" ADD COLUMN "groupId" TEXT');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
      console.error('ensure-columns error:', msg);
    }
  }
  // HabitGroup table
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "HabitGroup" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "emoji" TEXT NOT NULL DEFAULT '📁',
        "color" TEXT NOT NULL DEFAULT '#22c55e',
        "order" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      );
    `);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('already exists') && !msg.includes('table')) {
      console.error('ensure-columns error:', msg);
    }
  }

  ensured = true;
}