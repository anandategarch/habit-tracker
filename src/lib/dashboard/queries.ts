// ── Dashboard DB queries ─────────────────────────────────────────────────
//
// Two-phase fetch model:
//   Phase 1 — fetchDashboardBaseData: 6 independent queries run in parallel
//     (habitOptions, habits, goals, dailyLogs, monthTransactions, budgets).
//     Each is wrapped in `safe()` so one failure (e.g. missing table on a
//     fresh DB) doesn't abort the others.
//
//   Phase 2 — fetchDashboardLogData: 3 dependent queries run in parallel
//     (allLogs for the period, allTimeLogs for time-tracked habits,
//     latestLogs for last-done habits). Conditional: time/allTime/latest
//     queries are skipped (resolved to []) when there are no relevant habit
//     IDs to avoid needless DB round-trips.
//
// `select` clauses drop unused columns to reduce payload + DB wire time.
// The response shape consumed by the rest of the dashboard is UNCHANGED
// from the pre-split inline implementation — only the call site moved.

import { db } from '@/lib/db';
import { subDays } from '@/lib/date-utils';
import { safe } from './helpers';
import type {
  DashboardBaseData,
  DashboardLogData,
  TimeHabitLogRow,
} from './types';

// ── Phase 1: parallel fetch of all independent queries ────────────────────

export async function fetchDashboardBaseData(
  today: Date,
  monthStart: Date,
  monthEnd: Date,
): Promise<DashboardBaseData> {
  const [
    diffOptions,
    habits,
    activeGoals,
    recentDailyLogs,
    monthTransactions,
    budgets,
  ] = await Promise.all([
    safe(db.habitOption.findMany({
      where: { type: 'difficulty' },
      select: { name: true, xp: true },
    }), []),
    safe(db.habit.findMany({ where: { status: 'active' } }), []),
    safe(db.goal.findMany({
      where: { status: 'active' },
      select: { progress: true },
    }), []),
    safe(db.dailyLog.findMany({
      where: { date: { gte: subDays(today, 30) } },
      select: { mood: true, sleep: true },
    }), []),
    safe(db.transaction.findMany({
      where: { date: { gte: monthStart, lte: monthEnd } },
      select: { type: true, amount: true, category: true },
    }), []),
    safe(db.budget.findMany({
      select: { category: true, amount: true },
    }), []),
  ]);

  return {
    diffOptions,
    habits,
    activeGoals,
    recentDailyLogs,
    monthTransactions,
    budgets,
  };
}

// ── Phase 2: parallel fetch of dependent queries ──────────────────────────

export async function fetchDashboardLogData(
  periodStart: Date,
  today: Date,
  weekStart: Date,
  weekEnd: Date,
  timeHabitIds: string[],
  lastDoneIds: string[],
): Promise<DashboardLogData> {
  const [
    allLogsRaw,
    allTimeLogs,
    latestLogs,
  ] = await Promise.all([
    safe(db.habitLog.findMany({
      where: { date: { gte: periodStart, lte: today } },
      select: {
        date: true,
        habitId: true,
        completed: true,
        completedAt: true,
        habit: { select: { difficulty: true } },
      },
    }), []),
    timeHabitIds.length > 0
      ? safe(db.habitLog.findMany({
          where: {
            habitId: { in: timeHabitIds },
            completed: true,
            completedAt: { not: null },
            date: { gte: subDays(weekStart, 7), lte: weekEnd },
          },
          orderBy: { date: 'asc' },
          select: { date: true, completedAt: true, habitId: true },
        }), [])
      : Promise.resolve([] as TimeHabitLogRow[]),
    lastDoneIds.length > 0
      ? safe(db.habitLog.findMany({
          where: { habitId: { in: lastDoneIds }, completed: true },
          distinct: ['habitId'],
          orderBy: { date: 'desc' },
          select: { date: true, completedAt: true, habitId: true },
        }), [])
      : Promise.resolve([] as TimeHabitLogRow[]),
  ]);

  return { allLogsRaw, allTimeLogs, latestLogs };
}
