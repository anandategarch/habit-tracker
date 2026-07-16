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
  } catch { /* duplicate column → already exists */ }
  try {
    await db.$executeRawUnsafe('ALTER TABLE "Habit" ADD COLUMN "targetTime" TEXT');
  } catch { /* duplicate column → already exists */ }
  // completedAt on HabitLog
  try {
    await db.$executeRawUnsafe('ALTER TABLE "HabitLog" ADD COLUMN "completedAt" TEXT');
  } catch { /* duplicate column → already exists */ }
  // trackLastDone, lastDoneInterval on Habit
  try {
    await db.$executeRawUnsafe('ALTER TABLE "Habit" ADD COLUMN "trackLastDone" BOOLEAN NOT NULL DEFAULT 0');
  } catch { /* duplicate column → already exists */ }
  try {
    await db.$executeRawUnsafe('ALTER TABLE "Habit" ADD COLUMN "lastDoneInterval" TEXT');
  } catch { /* duplicate column → already exists */ }
  // groupId on Habit
  try {
    await db.$executeRawUnsafe('ALTER TABLE "Habit" ADD COLUMN "groupId" TEXT');
  } catch { /* duplicate column → already exists */ }
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
  } catch { /* table already exists */ }
  // Add FK column to HabitGroup for habits relation (reverse FK)
  try {
    await db.$executeRawUnsafe(`ALTER TABLE "Habit" ADD CONSTRAINT "Habit_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "HabitGroup"("id") ON DELETE SET NULL`);
  } catch { /* constraint already exists or column not yet ready */ }
  ensured = true;
}