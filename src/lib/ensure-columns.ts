import { db } from '@/lib/db';

let ensured = false;

/**
 * Ensures new columns (trackTime, targetTime on Habit; completedAt on HabitLog)
 * exist in the Turso production database. Safe to call multiple times — runs
 * ALTER TABLE only once per process via module-level `ensured` flag.
 */
export async function ensureTimeTrackingColumns(): Promise<void> {
  if (ensured) return;
  try {
    await db.$executeRawUnsafe('ALTER TABLE "Habit" ADD COLUMN "trackTime" BOOLEAN NOT NULL DEFAULT 0');
  } catch { /* duplicate column → already exists */ }
  try {
    await db.$executeRawUnsafe('ALTER TABLE "Habit" ADD COLUMN "targetTime" TEXT');
  } catch { /* duplicate column → already exists */ }
  try {
    await db.$executeRawUnsafe('ALTER TABLE "HabitLog" ADD COLUMN "completedAt" TEXT');
  } catch { /* duplicate column → already exists */ }
  ensured = true;
}