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
}

const FIELDS_TO_STRIP = new Set(['id', 'createdAt', 'updatedAt']);

function stripAutoFields(
  records: Record<string, unknown>[]
): Record<string, unknown>[] {
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

      // Delete children before parents to respect foreign key constraints
      // HabitLog depends on Habit (onDelete: Cascade, but be explicit)
      if (body.habitLogs) {
        await tx.habitLog.deleteMany();
      }
      if (body.habits) {
        await tx.habit.deleteMany();
      }

      if (body.dailyLogs) {
        await tx.dailyLog.deleteMany();
      }
      if (body.journals) {
        await tx.journal.deleteMany();
      }
      if (body.goals) {
        await tx.goal.deleteMany();
      }
      if (body.challenges) {
        await tx.challenge.deleteMany();
      }
      if (body.badges) {
        await tx.badge.deleteMany();
      }
      if (body.rewards) {
        await tx.reward.deleteMany();
      }
      if (body.transactions) {
        await tx.transaction.deleteMany();
      }
      if (body.budgets) {
        await tx.budget.deleteMany();
      }
      if (body.financeCategories) {
        await tx.financeCategory.deleteMany();
      }

      // Insert in dependency order: parents first, then children
      if (body.habits && body.habits.length > 0) {
        const data = stripAutoFields(body.habits);
        const res = await tx.habit.createMany({ data, skipDuplicates: true });
        counts.habits = res.count;
      }

      if (body.habitLogs && body.habitLogs.length > 0) {
        const data = stripAutoFields(body.habitLogs);
        const res = await tx.habitLog.createMany({ data, skipDuplicates: true });
        counts.habitLogs = res.count;
      }

      if (body.dailyLogs && body.dailyLogs.length > 0) {
        const data = stripAutoFields(body.dailyLogs);
        const res = await tx.dailyLog.createMany({ data, skipDuplicates: true });
        counts.dailyLogs = res.count;
      }

      if (body.journals && body.journals.length > 0) {
        const data = stripAutoFields(body.journals);
        const res = await tx.journal.createMany({ data, skipDuplicates: true });
        counts.journals = res.count;
      }

      if (body.goals && body.goals.length > 0) {
        const data = stripAutoFields(body.goals);
        const res = await tx.goal.createMany({ data, skipDuplicates: true });
        counts.goals = res.count;
      }

      if (body.challenges && body.challenges.length > 0) {
        const data = stripAutoFields(body.challenges);
        const res = await tx.challenge.createMany({ data, skipDuplicates: true });
        counts.challenges = res.count;
      }

      if (body.badges && body.badges.length > 0) {
        const data = stripAutoFields(body.badges);
        const res = await tx.badge.createMany({ data, skipDuplicates: true });
        counts.badges = res.count;
      }

      if (body.rewards && body.rewards.length > 0) {
        const data = stripAutoFields(body.rewards);
        const res = await tx.reward.createMany({ data, skipDuplicates: true });
        counts.rewards = res.count;
      }

      if (body.financeCategories && body.financeCategories.length > 0) {
        const data = stripAutoFields(body.financeCategories);
        const res = await tx.financeCategory.createMany({ data, skipDuplicates: true });
        counts.financeCategories = res.count;
      }

      if (body.transactions && body.transactions.length > 0) {
        const data = stripAutoFields(body.transactions);
        const res = await tx.transaction.createMany({ data, skipDuplicates: true });
        counts.transactions = res.count;
      }

      if (body.budgets && body.budgets.length > 0) {
        const data = stripAutoFields(body.budgets);
        const res = await tx.budget.createMany({ data, skipDuplicates: true });
        counts.budgets = res.count;
      }

      // AppSettings: keep existing or create if none
      if (body.settings && body.settings.length > 0) {
        const existing = await tx.appSettings.findFirst();
        if (!existing) {
          const data = stripAutoFields(body.settings);
          const res = await tx.appSettings.createMany({ data, skipDuplicates: true });
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