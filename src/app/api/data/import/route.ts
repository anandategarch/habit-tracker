import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

interface ImportPayload {
  habits?: Record<string, unknown>[];
  habitLogs?: Record<string, unknown>[];
  dailyLogs?: Record<string, unknown>[];
  goals?: Record<string, unknown>[];
  transactions?: Record<string, unknown>[];
  budgets?: Record<string, unknown>[];
  financeCategories?: Record<string, unknown>[];
  settings?: Record<string, unknown>[];
  // Added 6 missing tables for complete backup/restore
  fundSources?: Record<string, unknown>[];
  weeklyBudgets?: Record<string, unknown>[];
  budgetSnapshots?: Record<string, unknown>[];
  habitGroups?: Record<string, unknown>[];
  habitOptions?: Record<string, unknown>[];
  // BUGHUNT-ROUND2 IMPORT-1: these 3 tables were missing from the export →
  // import round-trip. Savings goals, recurring templates, and rules were
  // silently lost on restore.
  savingsGoals?: Record<string, unknown>[];
  recurringTransactions?: Record<string, unknown>[];
  transactionRules?: Record<string, unknown>[];
}

const FIELDS_TO_STRIP = new Set(['id', 'createdAt', 'updatedAt']);

// Strip auto-generated fields (id, createdAt, updatedAt) from imported records
// so Prisma can generate fresh values on insert.
// Returns `any[]` because Prisma's createMany input types are model-specific
// and we validated the payload structure upstream in isValidPayload().
function stripAutoFields(records: Record<string, unknown>[]): any[] {
  return records.map((record) => {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (!FIELDS_TO_STRIP.has(key)) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  });
}

function isValidPayload(body: unknown): body is ImportPayload {
  if (typeof body !== 'object' || body === null) return false;
  // BUGHUNT-ROUND2 IMPORT-2 (HIGH): allowedKeys was missing the HABIT-side
  // keys (habits, habitLogs, dailyLogs, goals, habitGroups, habitOptions)
  // — the exact keys /api/data/export emits. Every full backup failed
  // validation with 400 "Invalid payload". The handler below already
  // processed them; only the allow-list was wrong.
  const allowedKeys = new Set([
    'habits', 'habitLogs', 'dailyLogs', 'goals',
    'transactions',
    'budgets', 'financeCategories', 'settings',
    // Added 6 missing tables
    'fundSources', 'weeklyBudgets', 'budgetSnapshots',
    'habitGroups', 'habitOptions',
    // BUGHUNT-ROUND2 IMPORT-1: 3 finance tables for complete round-trip
    'savingsGoals', 'recurringTransactions', 'transactionRules',
    // Old backups may contain these keys from the removed features —
    // kept in allowedKeys so old backups import gracefully (silently ignored).
    'challenges', 'badges', 'rewards',
  ]);
  for (const key of Object.keys(body as Record<string, unknown>)) {
    if (!allowedKeys.has(key)) return false;
    const value = (body as Record<string, unknown>)[key];
    if (!Array.isArray(value)) return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  // BUGHUNT-ROUND3 IMPORT-JSON-1: a malformed JSON body (non-JSON request /
  // truncated file) previously fell through to the outer catch → 500 with a
  // generic "Failed to import data". The UI pre-parses the file client-side,
  // but direct API callers got a 500 for what is a client error — return 400
  // so it's distinguishable from a real server-side import failure.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Body harus JSON valid (backup .json hasil export).' },
      { status: 400 }
    );
  }

  try {
    if (!isValidPayload(body)) {
      return NextResponse.json(
        { error: 'Invalid payload. Expected a JSON object with array values.' },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      const counts: Record<string, number> = {};

      // Delete children before parents to respect foreign key constraints.
      // Guard with length > 0: empty array means "skip", not "wipe all".
      // Previously `if (body.habitLogs)` was truthy for [] → silently deleted
      // all data when a partial backup was imported.
      if (body.habitLogs && body.habitLogs.length > 0) {
        await tx.habitLog.deleteMany();
      }
      if (body.habits && body.habits.length > 0) {
        await tx.habit.deleteMany();
      }
      if (body.habitOptions && body.habitOptions.length > 0) {
        await tx.habitOption.deleteMany();
      }
      if (body.habitGroups && body.habitGroups.length > 0) {
        await tx.habitGroup.deleteMany();
      }
      if (body.dailyLogs && body.dailyLogs.length > 0) {
        await tx.dailyLog.deleteMany();
      }
      if (body.goals && body.goals.length > 0) {
        await tx.goal.deleteMany();
      }
      if (body.transactions && body.transactions.length > 0) {
        await tx.transaction.deleteMany();
      }
      if (body.budgets && body.budgets.length > 0) {
        await tx.budget.deleteMany();
      }
      if (body.budgetSnapshots && body.budgetSnapshots.length > 0) {
        await tx.budgetSnapshot.deleteMany();
      }
      if (body.weeklyBudgets && body.weeklyBudgets.length > 0) {
        await tx.weeklyBudget.deleteMany();
      }
      if (body.financeCategories && body.financeCategories.length > 0) {
        await tx.financeCategory.deleteMany();
      }
      if (body.fundSources && body.fundSources.length > 0) {
        await tx.fundSource.deleteMany();
      }
      // BUGHUNT-ROUND2 IMPORT-1: wipe the 3 previously-missing finance
      // tables so a restore is a true replacement, not a merge.
      if (body.savingsGoals && body.savingsGoals.length > 0) {
        await tx.savingsGoal.deleteMany();
      }
      if (body.recurringTransactions && body.recurringTransactions.length > 0) {
        await tx.recurringTransaction.deleteMany();
      }
      if (body.transactionRules && body.transactionRules.length > 0) {
        await tx.transactionRule.deleteMany();
      }

      // Insert in dependency order: parents first, then children.
      //
      // ── FK remapping for habits → habitLogs ──────────────────────────
      // The export contains OLD habit IDs (cuid strings). When we strip `id`
      // and re-insert habits, Prisma generates NEW cuid IDs. The habitLogs
      // still reference the OLD habitId → FK constraint violation (or
      // silent orphaned logs if FK enforcement is off).
      //
      // Fix: insert habits one-by-one (not createMany), capture the
      // old→new ID mapping, then rewrite each habitLog's `habitId` before
      // inserting. This preserves the habit↔log relationship across import.
      const habitIdMap = new Map<string, string>(); // oldId → newId

      // BUG-5 fix: insert habitGroups BEFORE habits. Habits reference
      // groupId (FK to HabitGroup.id). Inserting habits first creates
      // dangling FK references. SQLite doesn't enforce FKs at runtime,
      // but strict relational DBs (PostgreSQL/MySQL) would reject.
      if (body.habitGroups && body.habitGroups.length > 0) {
        const data = stripAutoFields(body.habitGroups);
        const res = await tx.habitGroup.createMany({ data });
        counts.habitGroups = res.count;
      }

      if (body.habits && body.habits.length > 0) {
        const cleaned = stripAutoFields(body.habits);
        let habitsInserted = 0;
        for (let i = 0; i < body.habits.length; i++) {
          const oldId = body.habits[i].id;
          if (typeof oldId !== 'string') {
            // No old id to map — just insert (log will be orphaned, but
            // we can't do better without an id).
            await tx.habit.create({ data: cleaned[i] });
            habitsInserted++;
            continue;
          }
          // Insert with explicit old id preserved — this way habitLogs
          // that reference the old id still work. We only strip id if
          // there's a collision (extremely unlikely with cuid).
          try {
            await tx.habit.create({ data: { ...cleaned[i], id: oldId } });
            habitIdMap.set(oldId, oldId);
            habitsInserted++;
          } catch {
            // ID collision (rare) — let Prisma generate a new id, map it.
            const created = await tx.habit.create({ data: cleaned[i] });
            habitIdMap.set(oldId, created.id);
            habitsInserted++;
          }
        }
        counts.habits = habitsInserted;
      }

      if (body.habitLogs && body.habitLogs.length > 0) {
        const cleaned = stripAutoFields(body.habitLogs);
        // Rewrite each log's habitId using the map. If an old habitId
        // isn't in the map (e.g., habit wasn't in the import payload),
        // skip the log rather than creating an orphan.
        const validLogs: any[] = [];
        let skippedOrphaned = 0;
        for (let i = 0; i < body.habitLogs.length; i++) {
          const oldHabitId = body.habitLogs[i].habitId;
          if (typeof oldHabitId !== 'string') {
            // No habitId field — shouldn't happen, but skip defensively.
            skippedOrphaned++;
            continue;
          }
          const newHabitId = habitIdMap.get(oldHabitId);
          if (!newHabitId) {
            // Original habit wasn't imported — log would be orphaned.
            skippedOrphaned++;
            continue;
          }
          validLogs.push({ ...cleaned[i], habitId: newHabitId });
        }
        if (validLogs.length > 0) {
          const res = await tx.habitLog.createMany({ data: validLogs });
          counts.habitLogs = res.count;
        }
        if (skippedOrphaned > 0) {
          console.warn(`Import: skipped ${skippedOrphaned} orphaned habitLogs (habitId not in import)`);
        }
      }

      if (body.dailyLogs && body.dailyLogs.length > 0) {
        const data = stripAutoFields(body.dailyLogs);
        const res = await tx.dailyLog.createMany({ data });
        counts.dailyLogs = res.count;
      }

      if (body.goals && body.goals.length > 0) {
        const data = stripAutoFields(body.goals);
        const res = await tx.goal.createMany({ data });
        counts.goals = res.count;
      }

      if (body.financeCategories && body.financeCategories.length > 0) {
        const data = stripAutoFields(body.financeCategories);
        const res = await tx.financeCategory.createMany({ data });
        counts.financeCategories = res.count;
      }

      if (body.transactions && body.transactions.length > 0) {
        const data = stripAutoFields(body.transactions);
        const res = await tx.transaction.createMany({ data });
        counts.transactions = res.count;
      }

      if (body.budgets && body.budgets.length > 0) {
        const data = stripAutoFields(body.budgets);
        const res = await tx.budget.createMany({ data });
        counts.budgets = res.count;
      }

      // AppSettings: keep existing or create if none
      if (body.settings && body.settings.length > 0) {
        const existing = await tx.appSettings.findFirst();
        if (!existing) {
          const data = stripAutoFields(body.settings);
          const res = await tx.appSettings.createMany({ data });
          counts.settings = res.count;
        } else {
          // Update existing settings with imported values
          const imported = body.settings[0];
          const updateData: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(imported)) {
            if (!FIELDS_TO_STRIP.has(key)) {
              updateData[key] = value;
            }
          }
          await tx.appSettings.update({
            where: { id: existing.id },
            data: updateData,
          });
          counts.settings = 1;
        }
      }

      // ── 6 previously-missing tables ──────────────────────────────────
      // Without these, backup/restore silently destroyed fund-source
      // balances, weekly budgets, habit groups, learning topics, and
      // habit options. Now they're part of the export/import cycle.
      // Note: habitGroups already inserted above (before habits, for FK order).

      if (body.habitOptions && body.habitOptions.length > 0) {
        const data = stripAutoFields(body.habitOptions);
        const res = await tx.habitOption.createMany({ data });
        counts.habitOptions = res.count;
      }

      if (body.fundSources && body.fundSources.length > 0) {
        const data = stripAutoFields(body.fundSources);
        const res = await tx.fundSource.createMany({ data });
        counts.fundSources = res.count;
      }

      if (body.weeklyBudgets && body.weeklyBudgets.length > 0) {
        const data = stripAutoFields(body.weeklyBudgets);
        const res = await tx.weeklyBudget.createMany({ data });
        counts.weeklyBudgets = res.count;
      }

      if (body.budgetSnapshots && body.budgetSnapshots.length > 0) {
        const data = stripAutoFields(body.budgetSnapshots);
        const res = await tx.budgetSnapshot.createMany({ data });
        counts.budgetSnapshots = res.count;
      }

      // BUGHUNT-ROUND2 IMPORT-1: 3 previously-missing finance tables —
      // savings goals, recurring templates, and auto-categorization rules
      // are now part of the backup/restore cycle.
      if (body.savingsGoals && body.savingsGoals.length > 0) {
        const data = stripAutoFields(body.savingsGoals);
        const res = await tx.savingsGoal.createMany({ data });
        counts.savingsGoals = res.count;
      }

      if (body.recurringTransactions && body.recurringTransactions.length > 0) {
        const data = stripAutoFields(body.recurringTransactions);
        const res = await tx.recurringTransaction.createMany({ data });
        counts.recurringTransactions = res.count;
      }

      if (body.transactionRules && body.transactionRules.length > 0) {
        const data = stripAutoFields(body.transactionRules);
        const res = await tx.transactionRule.createMany({ data });
        counts.transactionRules = res.count;
      }

      return counts;
    });

    const totalImported = Object.values(result).reduce((sum, n) => sum + n, 0);

    return NextResponse.json({
      message: 'Data imported successfully',
      counts: result,
      totalImported,
    });
  } catch (error) {
    console.error('Import failed:', error);
    return NextResponse.json(
      { error: 'Failed to import data' },
      { status: 500 }
    );
  }
}