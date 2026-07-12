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
  ensured = true;
}