// ── Pure helpers for the dashboard API ───────────────────────────────────
//
// All functions in this file are PURE: no DB calls, no React, no I/O.
// They take inputs and return outputs. The orchestrator (route.ts) calls
// them; they do not call each other except where noted.
//
// Helpers that previously closed over local variables in the inline route
// handler (e.g. `habitsActiveOnDate` closed over `habitCreatedDates`) now
// take those values as explicit parameters — this is what allows them to
// be lifted out of the handler.

import {
  startOfDay,
  subDays,
  differenceInCalendarDays,
  format,
} from '@/lib/date-utils';
import { jakartaTimeMinutes } from '@/lib/timezone';
import type { Period } from './types';

// ── Promise safety wrapper ────────────────────────────────────────────────
// Used to parallelize queries that may fail (e.g. table doesn't exist yet
// on a fresh DB) without one failure aborting the entire Promise.all batch.
export async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

// ── XP / level helpers ────────────────────────────────────────────────────

export function calcLevel(totalXP: number): number {
  return Math.floor(Math.sqrt(totalXP / 100)) + 1;
}

export function calcNextLevelXP(level: number): number {
  return (level * level) * 100;
}

// ── Period helpers ────────────────────────────────────────────────────────

export function getPeriodDays(period: Period): number {
  switch (period) {
    case '7d': return 7;
    case '1m': return 30;
    case '3m': return 90;
    case '6m': return 180;
    case '1y': return 365;
    case 'all': return 365; // default, overridden below
    default: return 365;
  }
}

// ── Time-format helpers (Jakarta timezone) ────────────────────────────────
// Extract local time in minutes from an ISO string interpreted in Jakarta
// timezone. Used by both time-tracked-summary and last-done-summary.
export function toMinutesFromISO(isoStr: string): number {
  return jakartaTimeMinutes(new Date(isoStr));
}

export function minutesToHHmm(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const mn = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
}

// ── Last-done interval parser ─────────────────────────────────────────────
// "3d" → 3, "1w" → 7, null/invalid → 0.
// Used by last-done-summary to compute overdue status.
export function intervalToDays(interval: string | null): number {
  if (!interval) return 0;
  const match = interval.match(/^(\d+)(d|w)$/);
  if (!match) return 0;
  const val = parseInt(match[1], 10);
  return match[2] === 'w' ? val * 7 : val;
}

// ── Habit-active-on-date helpers (binary search) ──────────────────────────
// Pre-sort habit creation dates (as epoch ms at start-of-day) for O(log n)
// binary search lookups via `habitsActiveOnDate`. Previously this was
// computed inline in the route handler; lifting it out as a pure function
// lets both completion-stats and chart-builders share the same sorted
// array without re-sorting.

export function buildHabitCreatedDates(
  habits: { createdAt: Date }[],
): number[] {
  return habits
    .map(h => startOfDay(h.createdAt).getTime())
    .sort((a, b) => a - b);
}

// Count habits active on a given date (O(log n) via binary search on the
// pre-sorted `habitCreatedDates` array produced by buildHabitCreatedDates).
export function habitsActiveOnDate(
  date: Date,
  habitCreatedDates: number[],
): number {
  const ts = startOfDay(date).getTime();
  // Find rightmost index where createdDate <= ts
  let lo = 0, hi = habitCreatedDates.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (habitCreatedDates[mid] <= ts) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Count theoretical possible completions for a date range.
// Sum over each day: number of habits that existed on that day.
export function theoreticalMaxInRange(
  start: Date,
  end: Date,
  habitCreatedDates: number[],
): number {
  const days = differenceInCalendarDays(end, start) + 1;
  let total = 0;
  for (let i = 0; i < days; i++) {
    const d = subDays(end, i);
    total += habitsActiveOnDate(d, habitCreatedDates);
  }
  return total;
}

// ── Daily completion map builder ──────────────────────────────────────────
// Build a map: dateStr (yyyy-MM-dd) -> Set of habitIds completed that day.
// Shared between completion-stats (today's success rate, streak calc) and
// chart-builders (weekly/monthly/stacked-bar/weekly-pattern). Building it
// once in the orchestrator avoids re-iterating allLogs in each consumer.
export function buildDailyCompletionMap(
  allLogs: { date: Date; habitId: string; completed: boolean }[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const log of allLogs) {
    if (!log.completed) continue;
    const dateStr = format(log.date, 'yyyy-MM-dd');
    if (!map.has(dateStr)) map.set(dateStr, new Set());
    map.get(dateStr)!.add(log.habitId);
  }
  return map;
}
