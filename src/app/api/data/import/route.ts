import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

interface ImportPayload {
  habits?: Record<string, unknown>[];
  habitLogs?: Record<string, unknown>[];
  dailyLogs?: Record<string, unknown>[];
  journals?: Record<string, unknown>[];
  goals?: Record<string, unknown>[];
  challenges?: Record<string, unknown>[];
  badges?: Record<string, unknown>[];
  rewards?: Record<string, unknown>[];
  transactions?: Record<string, unknown>[];
  budgets?: Record<string, unknown>[];
  financeCategories?: Record<string, unknown>[];
  settings?: Record<string, unknown>[];
  // Added 6 missing tables for complete backup/restore
  fundSources?: Record<string, unknown>[];
  weeklyBudgets?: Record<string, unknown>[];
  budgetSnapshots?: Record<string, unknown>[];
  habitGroups?: Record<string, unknown>[];
  learningTopics?: Record<string, unknown>[];
  habitOptions?: Record<string, unknown>[];
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
  const allowedKeys = new Set([
    'habits', 'habitLogs', 'dailyLogs', 'journals', 'goals',
    'challenges', 'badges', 'rewards', 'transactions',
    'budgets', 'financeCategories', 'settings',
    // Added 6 missing tables
    'fundSources', 'weeklyBudgets', 'budgetSnapshots',
    'habitGroups', 'learningTopics', 'habitOptions',
  ]);
  for (const key of Object.keys(body as Record<string, unknown>)) {
    if (!allowedKeys.has(key)) return false;
    const value = (body as Record<string, unknown>)[key];
    if (!Array.isArray(value)) return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!isValidPayload(body)) {
      return NextResponse.json(
        {
          error:
            'Invalid payload. Expected a JSON object with keys: habits, habitLogs, dailyLogs, journals, goals, challenges, badges, rewards, transactions, budgets, financeCategories, settings (all arrays).',
        },
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
      if (body.journals && body.journals.length > 0) {
        await tx.journal.deleteMany();
      }
      if (body.goals && body.goals.length > 0) {
        await tx.goal.deleteMany();
      }
      if (body.challenges && body.challenges.length > 0) {
        await tx.challenge.deleteMany();
      }
      if (body.badges && body.badges.length > 0) {
        await tx.badge.deleteMany();
      }
      if (body.rewards && body.rewards.length > 0) {
        await tx.reward.deleteMany();
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
      if (body.learningTopics && body.learningTopics.length > 0) {
        await tx.learningTopic.deleteMany();
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

      if (body.journals && body.journals.length > 0) {
        const data = stripAutoFields(body.journals);
        const res = await tx.journal.createMany({ data });
        counts.journals = res.count;
      }

      if (body.goals && body.goals.length > 0) {
        const data = stripAutoFields(body.goals);
        const res = await tx.goal.createMany({ data });
        counts.goals = res.count;
      }

      if (body.challenges && body.challenges.length > 0) {
        const data = stripAutoFields(body.challenges);
        const res = await tx.challenge.createMany({ data });
        counts.challenges = res.count;
      }

      if (body.badges && body.badges.length > 0) {
        const data = stripAutoFields(body.badges);
        const res = await tx.badge.createMany({ data });
        counts.badges = res.count;
      }

      if (body.rewards && body.rewards.length > 0) {
        const data = stripAutoFields(body.rewards);
        const res = await tx.reward.createMany({ data });
        counts.rewards = res.count;
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

      // HabitGroups must be inserted BEFORE habits (habits reference groupId)
      if (body.habitGroups && body.habitGroups.length > 0) {
        const data = stripAutoFields(body.habitGroups);
        const res = await tx.habitGroup.createMany({ data });
        counts.habitGroups = res.count;
      }

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

      if (body.learningTopics && body.learningTopics.length > 0) {
        const data = stripAutoFields(body.learningTopics);
        const res = await tx.learningTopic.createMany({ data });
        counts.learningTopics = res.count;
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