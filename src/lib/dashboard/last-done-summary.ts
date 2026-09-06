// ── Last-done habits summary for the dashboard API ───────────────────────
//
// Pure function: takes the habits + the pre-fetched latestLogs (Phase 2
// parallel query, one log per habitId) + today and returns the per-habit
// last-done summary array embedded in the dashboard response.
//
// For each habit with `trackLastDone=true`, computes:
//   - lastDate / daysAgo (date of most recent completion + days since)
//   - completedAt (HH:mm in Jakarta timezone of the most recent completion)
//   - overdue (true if daysAgo > intervalDays AND intervalDays > 0)
//
// The returned array is sorted: overdue first, then by daysAgo desc, then
// never-done at the bottom.
//
// All loops + format strings are LIFTED VERBATIM from the original inline
// implementation in route.ts (lines ~693-783 pre-split). Only the call
// site moved.

import { differenceInCalendarDays } from '@/lib/date-utils';
import { jakartaDateKey, jakartaTimeMinutes } from '@/lib/timezone';
import type { Habit } from '@prisma/client';
import type { LatestHabitLogRow, LastDoneSummaryItem } from './types';
import { intervalToDays, minutesToHHmm } from './helpers';

export function computeLastDoneSummary(
  habits: Habit[],
  latestLogs: LatestHabitLogRow[],
  today: Date,
): LastDoneSummaryItem[] {
  const lastDoneHabits = habits.filter(h => h.trackLastDone);
  const lastDoneSummary: LastDoneSummaryItem[] = [];

  const latestLogMap = new Map(latestLogs.map(l => [l.habitId, l]));

  for (const habit of lastDoneHabits) {
    const latestLog = latestLogMap.get(habit.id) || null;
    const intervalDays = intervalToDays(habit.lastDoneInterval);

    if (!latestLog) {
      lastDoneSummary.push({
        id: habit.id,
        name: habit.name,
        icon: habit.icon,
        color: habit.color,
        interval: habit.lastDoneInterval,
        intervalDays,
        lastDate: null,
        daysAgo: null,
        completedAt: null,
        overdue: intervalDays > 0,
      });
      continue;
    }

    // Compute the log's Jakarta calendar date without the shifted-epoch trick
    const logYMD = jakartaDateKey(latestLog.date);
    const [ly, lm, ld] = logYMD.split('-').map(Number);
    const logDateOnly = new Date(ly, lm - 1, ld);
    const daysAgo = differenceInCalendarDays(today, logDateOnly);

    // Extract time in Jakarta timezone
    let timeStr: string | null = null;
    if (latestLog.completedAt) {
      try {
        const mins = jakartaTimeMinutes(new Date(latestLog.completedAt));
        timeStr = minutesToHHmm(mins);
      } catch {
        // fallback: raw extract
        const tm = latestLog.completedAt.match(/T(\d{2}:\d{2})/);
        if (tm) timeStr = tm[1];
      }
    }

    lastDoneSummary.push({
      id: habit.id,
      name: habit.name,
      icon: habit.icon,
      color: habit.color,
      interval: habit.lastDoneInterval,
      intervalDays,
      lastDate: latestLog.date,
      daysAgo,
      completedAt: timeStr,
      overdue: intervalDays > 0 && daysAgo > intervalDays,
    });
  }

  // Sort: overdue first, then by daysAgo desc, then never-done at bottom
  lastDoneSummary.sort((a, b) => {
    if (a.daysAgo === null && b.daysAgo === null) return 0;
    if (a.daysAgo === null) return 1;
    if (b.daysAgo === null) return -1;
    if (a.overdue && !b.overdue) return -1;
    if (!a.overdue && b.overdue) return 1;
    return (b.daysAgo ?? 0) - (a.daysAgo ?? 0);
  });

  return lastDoneSummary;
}
