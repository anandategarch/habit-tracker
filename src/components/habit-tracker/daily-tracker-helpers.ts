// ---------------------------------------------------------------------------
// Helpers
// Extracted from daily-tracker.tsx during SPLIT-PHASE3.
// ---------------------------------------------------------------------------

import { format, subDays, parseISO } from '@/lib/date-utils';
// PERF-FIX (FIX-TIER3 / Fix 15): replaced `date-fns` with native Intl-based
// utility module. Output is identical for the patterns used here
// ('yyyy-MM-dd') and the `subDays`/`parseISO` helpers — verified via
// test script in worklog FIX-TIER3 entry.
import { jakartaDateKey } from '@/lib/timezone';
import type { HabitLog } from './daily-tracker-types';

export function toDateString(isoLike: string): string {
  return jakartaDateKey(new Date(isoLike));
}

/**
 * Format a completedAt ISO string to "HH:mm" in Jakarta timezone.
 * BUG-4 fix: previously used `new Date(iso).getHours()` which reads
 * the BROWSER's local TZ. Inconsistent with daily-recap.tsx and
 * finance-transactions.tsx which use `timeZone: 'Asia/Jakarta'`.
 * Now uses Intl.DateTimeFormat for TZ-correct display on any device.
 */
export function formatJakartaTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

export function timeDiffMinutes(time: string, target: string): number {
  const [th, tm] = target.split(':').map(Number);
  const [ah, am] = time.split(':').map(Number);
  return (ah * 60 + am) - (th * 60 + tm);
}

// NOTE: `toLocalISO(date)` was removed (BUG-17 fix). It converted a Date to an
// ISO string using the BROWSER's local timezone offset, which produced wrong
// results on non-Jakarta browsers since the rest of the app uses Asia/Jakarta.
// Callers now use `jakartaNowIso()` (for "now") or build the ISO directly with
// a `+07:00` offset (for user-entered date+time).

/**
 * Compute the current streak (consecutive completed days ending at `date`)
 * for a single habit, using its month-cached logs.
 */
export function computeStreak(logs: HabitLog[], dateStr: string): number {
  if (!logs || logs.length === 0) return 0;
  const completedDays = new Set(
    logs.filter((l) => l.completed).map((l) => toDateString(l.date)),
  );
  if (completedDays.size === 0) return 0;

  let streak = 0;
  const cursor = parseISO(dateStr);
  // If today isn't completed yet, streak can still count up to yesterday.
  if (!completedDays.has(dateStr)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  // Walk backwards counting consecutive completed days (cap at 365 for safety).
  for (let i = 0; i < 365; i++) {
    const key = format(cursor, 'yyyy-MM-dd');
    if (completedDays.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/**
 * ANIM-3: Last-7-days status for the FlipCard back face.
 * Returns 7 entries (oldest → newest) with `done` flag + day-of-month label.
 * Uses the month-cached logs (same source as computeStreak). Days outside the
 * cached month are treated as not-done — acceptable for a quick stats view.
 */
export function getLast7DaysStatus(
  logs: HabitLog[] | undefined,
  todayStr: string,
): { done: boolean; dateNum: number }[] {
  const completedDays = new Set(
    (logs || []).filter((l) => l.completed).map((l) => toDateString(l.date)),
  );
  const today = parseISO(todayStr);
  const result: { done: boolean; dateNum: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = subDays(today, i);
    const key = format(day, 'yyyy-MM-dd');
    result.push({ done: completedDays.has(key), dateNum: day.getDate() });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Category colour system — premium pastel tints per category
// ---------------------------------------------------------------------------

export const CATEGORY_STYLES: Record<
  string,
  { tint: string; ring: string; glow: string; text: string; hex: string }
> = {
  Productivity: { tint: 'cat-emerald', ring: '#10b981', glow: 'rgba(16,185,129,0.25)', text: 'text-success dark:text-success/80', hex: '#10b981' },
  Learning: { tint: 'cat-emerald', ring: '#10b981', glow: 'rgba(16,185,129,0.25)', text: 'text-success dark:text-success/80', hex: '#10b981' },
  Fitness: { tint: 'cat-orange', ring: '#f97316', glow: 'rgba(249,115,22,0.25)', text: 'text-orange-600 dark:text-orange-400', hex: '#f97316' },
  Health: { tint: 'cat-teal', ring: '#14b8a6', glow: 'rgba(20,184,166,0.25)', text: 'text-teal-600 dark:text-teal-400', hex: '#14b8a6' },
  // FIX-COLOR-P2: Reading was cat-sky/#0ea5e9 — replaced with orange.
  Reading: { tint: 'cat-orange', ring: '#f97316', glow: 'rgba(249,115,22,0.25)', text: 'text-orange-600 dark:text-orange-400', hex: '#f97316' },
  Personal: { tint: 'cat-rose', ring: '#ec4899', glow: 'rgba(236,72,153,0.25)', text: 'text-rose-600 dark:text-rose-400', hex: '#ec4899' },
  Creative: { tint: 'cat-fuchsia', ring: '#d946ef', glow: 'rgba(217,70,239,0.25)', text: 'text-fuchsia-600 dark:text-fuchsia-400', hex: '#d946ef' },
  // FIX-COLOR-P2: Mindfulness was cat-violet/#8b5cf6 — replaced with rose.
  Mindfulness: { tint: 'cat-rose', ring: '#ec4899', glow: 'rgba(236,72,153,0.25)', text: 'text-rose-600 dark:text-rose-400', hex: '#ec4899' },
  Social: { tint: 'cat-red', ring: '#ef4444', glow: 'rgba(239,68,68,0.25)', text: 'text-destructive dark:text-destructive/80', hex: '#ef4444' },
  General: { tint: 'cat-slate', ring: '#64748b', glow: 'rgba(100,116,139,0.25)', text: 'text-slate-600 dark:text-slate-400', hex: '#64748b' },
};

export function getCategoryStyle(category: string) {
  return CATEGORY_STYLES[category] || CATEGORY_STYLES.General;
}
