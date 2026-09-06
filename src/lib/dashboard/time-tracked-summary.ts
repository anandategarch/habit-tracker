// ── Time-tracked habits summary for the dashboard API ────────────────────
//
// Pure function: takes the habits + the pre-fetched allTimeLogs (Phase 2
// parallel query) + date params and returns the per-habit time-tracked
// summary array embedded in the dashboard response.
//
// For each habit with `trackTime=true`, computes:
//   - todayTime / todayDone (today's HH:mm completion time + done flag)
//   - weekAvg (mean HH:mm of completed times this week)
//   - weekOnTarget / weekTotal / weekOnTargetRate (count + % at or before
//     targetTime)
//   - prevAvg (mean HH:mm of completed times last week)
//   - trend (minutes diff vs last week; negative = improving/earlier)
//   - weekTimes (per-day HH:mm + minutes for the 7-day mini chart)
//
// All loops + format strings are LIFTED VERBATIM from the original inline
// implementation in route.ts (lines ~577-691 pre-split). Only the call
// site moved.

import { subDays, format } from '@/lib/date-utils';
import type { Habit } from '@prisma/client';
import type { TimeHabitLogRow, TimeHabitSummary } from './types';
import { toMinutesFromISO, minutesToHHmm } from './helpers';

export function computeTimeTrackedSummary(
  habits: Habit[],
  allTimeLogs: TimeHabitLogRow[],
  weekStart: Date,
  weekEnd: Date,
  today: Date,
  todayKey: string,
): TimeHabitSummary[] {
  const timeHabits = habits.filter(h => h.trackTime);
  const timeTrackedSummary: TimeHabitSummary[] = [];

  // Group by habitId
  const timeLogsByHabit = new Map<string, TimeHabitLogRow[]>();
  for (const log of allTimeLogs) {
    if (!timeLogsByHabit.has(log.habitId)) timeLogsByHabit.set(log.habitId, []);
    timeLogsByHabit.get(log.habitId)!.push(log);
  }

  for (const habit of timeHabits) {
    const targetMins = habit.targetTime
      ? (() => { const [h, m] = habit.targetTime!.split(':').map(Number); return h * 60 + m; })()
      : null;

    const habitTimeLogs = timeLogsByHabit.get(habit.id) || [];
    const weekLogs = habitTimeLogs.filter(l => l.date >= weekStart && l.date <= weekEnd);
    const prevWeekLogs = habitTimeLogs.filter(l => l.date >= subDays(weekStart, 7) && l.date <= subDays(weekStart, 1));

    // N+1 fix: pre-build a Map<dateKey, log> for weekLogs so we can do O(1)
    // lookups instead of .find() scanning the array per day.
    // Previously: weekLogs.find(l => format(l.date, 'yyyy-MM-dd') === key)
    // was called inside a nested loop (7 days × N habits = N×7 scans).
    const weekLogsByDate = new Map<string, TimeHabitLogRow>();
    for (const l of weekLogs) {
      weekLogsByDate.set(format(l.date, 'yyyy-MM-dd'), l);
    }

    // Today's time — O(1) Map lookup
    const todayLog = weekLogsByDate.get(todayKey);
    const todayTime = todayLog?.completedAt ? minutesToHHmm(toMinutesFromISO(todayLog.completedAt)) : null;

    // This week average
    const weekMins = weekLogs.map(l => l.completedAt ? toMinutesFromISO(l.completedAt) : null).filter((m): m is number => m !== null);
    const weekAvg = weekMins.length > 0 ? minutesToHHmm(Math.round(weekMins.reduce((a, b) => a + b, 0) / weekMins.length)) : null;

    // On-target count
    const weekOnTarget = targetMins !== null
      ? weekMins.filter(m => m <= targetMins).length
      : 0;

    // Previous week average
    const prevMins = prevWeekLogs.map(l => l.completedAt ? toMinutesFromISO(l.completedAt) : null).filter((m): m is number => m !== null);
    const prevAvg = prevMins.length > 0 ? minutesToHHmm(Math.round(prevMins.reduce((a, b) => a + b, 0) / prevMins.length)) : null;

    // Trend (minutes diff)
    const currentAvgMins = weekMins.length > 0 ? Math.round(weekMins.reduce((a, b) => a + b, 0) / weekMins.length) : null;
    const prevAvgMins = prevMins.length > 0 ? Math.round(prevMins.reduce((a, b) => a + b, 0) / prevMins.length) : null;
    const trend = currentAvgMins !== null && prevAvgMins !== null ? currentAvgMins - prevAvgMins : null;

    // Per-day times for mini chart — O(1) Map lookup per day
    const weekTimes: { day: string; time: string | null; minutes: number | null }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      const key = format(d, 'yyyy-MM-dd');
      const log = weekLogsByDate.get(key);
      if (log?.completedAt) {
        const mins = toMinutesFromISO(log.completedAt);
        weekTimes.push({ day: format(d, 'EEE'), time: minutesToHHmm(mins), minutes: mins });
      } else {
        weekTimes.push({ day: format(d, 'EEE'), time: null, minutes: null });
      }
    }

    timeTrackedSummary.push({
      id: habit.id,
      name: habit.name,
      icon: habit.icon,
      color: habit.color,
      targetTime: habit.targetTime,
      todayTime,
      todayDone: !!todayLog,
      weekAvg,
      weekOnTarget,
      weekTotal: weekMins.length,
      weekOnTargetRate: weekMins.length > 0 && targetMins !== null
        ? Math.round((weekOnTarget / weekMins.length) * 100)
        : 0,
      prevAvg,
      trend,
      weekTimes,
    });
  }

  return timeTrackedSummary;
}
