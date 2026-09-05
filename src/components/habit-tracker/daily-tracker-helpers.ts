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
 *
 * `options.onVacation` (PHASE1-HABIT): when true, the current `dateStr` is
 * treated as auto-completed so a vacationing habit's streak continues
 * through the pause without breaking. The vacation day itself counts as
 * +1 to the streak (the user is "on break" and the habit is considered
 * satisfied for them).
 */
export function computeStreak(
  logs: HabitLog[],
  dateStr: string,
  options?: { onVacation?: boolean },
): number {
  if (!logs || logs.length === 0) return 0;
  const completedDays = new Set(
    logs.filter((l) => l.completed).map((l) => toDateString(l.date)),
  );
  // Vacation mode: treat the current day as auto-completed so the streak
  // doesn't break during the pause.
  if (options?.onVacation) {
    completedDays.add(dateStr);
  }
  if (completedDays.size === 0) return 0;

  let streak = 0;
  const cursor = parseISO(dateStr);
  // If today isn't completed yet, streak can still count up to yesterday.
  // (For vacation habits, today was just added to completedDays above, so
  // the streak starts from today.)
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
 * PHASE1-HABIT — Strength score (inspired by uhabits).
 *
 * Instead of a binary streak that resets to 0 on any miss, the strength
 * score decays gradually as the user skips days. It is computed as:
 *
 *   strength = (completions in last `days` days / expected completions) * 100
 *
 * - `expected` = `days * target` for daily habits (target is currently
 *   always 1 per BUG-3, but the formula is forward-compatible).
 * - `expected` = `(days / 7) * target` for weekly habits.
 * - `expected` = `(days / 30) * target` for monthly habits.
 *
 * Returns an integer 0-100. This is ADDITIONAL to the streak — it does not
 * replace it. The streak stays binary (break = reset); the strength score
 * reflects overall consistency over a rolling window.
 *
 * Vacation days (habit.vacationMode === true) are counted as auto-completed
 * so a vacation doesn't tank the strength score.
 */
export function computeStrengthScore(
  logs: HabitLog[],
  habit: { target: number; targetType: string; vacationMode?: boolean },
  days: number = 30,
  dateStr?: string,
): number {
  if (!logs || logs.length === 0 || days <= 0) return 0;

  // Build the set of "yyyy-MM-dd" keys for the last `days` days ending at
  // dateStr (defaults to today in Jakarta TZ). Uses the same jakartaDateKey
  // helper as computeStreak so the window aligns with how logs are stored.
  const anchor = dateStr ?? jakartaDateKey(new Date());
  const anchorDate = parseISO(anchor);
  const windowKeys = new Set<string>();
  for (let i = 0; i < days; i++) {
    windowKeys.add(format(subDays(anchorDate, i), 'yyyy-MM-dd'));
  }

  let completions = 0;
  for (const log of logs) {
    if (!log.completed) continue;
    const key = toDateString(log.date);
    if (windowKeys.has(key)) completions++;
  }

  // Vacation mode: each day in the window counts as auto-completed (the
  // user is on a deliberate pause — that shouldn't reduce consistency).
  if (habit.vacationMode) {
    // Count vacation days that fall inside the window. We don't have a
    // vacationStart; the approximation is "today is on vacation", which
    // means at least today is auto-credited. To avoid double-counting
    // already-completed days, we cap at the window size.
    const alreadyCounted = completions;
    const maxVacationCredits = windowKeys.size - alreadyCounted;
    if (maxVacationCredits > 0) {
      // Credit 1 vacation day (today) — minimal but safe. We can't reliably
      // know how many past days were vacation without a vacationStart field.
      completions += 1;
    }
  }

  // Expected completions over the window.
  const target = habit.target || 1;
  let expected: number;
  if (habit.targetType === 'weekly') {
    expected = Math.max(1, (days / 7) * target);
  } else if (habit.targetType === 'monthly') {
    expected = Math.max(1, (days / 30) * target);
  } else {
    expected = days * target;
  }

  if (expected <= 0) return 0;
  const score = (completions / expected) * 100;
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * PHASE1-HABIT — Map a 0-100 strength score to a tier label + Tailwind
 * color class. Used by both the HabitCard strength bar and the StreakFlame
 * dimming logic.
 *
 *   >= 60 → "Kuat"     (green)
 *   30-59 → "Sedang"   (amber)
 *   <  30 → "Lemah"    (red)
 */
export function getStrengthTier(score: number): {
  label: string;
  colorClass: string;
  barClass: string;
  dimmed: boolean;
} {
  if (score >= 60) {
    return {
      label: 'Kuat',
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      barClass: 'bg-emerald-500',
      dimmed: false,
    };
  }
  if (score >= 30) {
    return {
      label: 'Sedang',
      colorClass: 'text-amber-600 dark:text-amber-400',
      barClass: 'bg-amber-500',
      dimmed: false,
    };
  }
  return {
    label: 'Lemah',
    colorClass: 'text-red-600 dark:text-red-400',
    barClass: 'bg-red-500',
    dimmed: true,
  };
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
