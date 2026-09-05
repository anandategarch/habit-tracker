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
 *
 * `options.invert` (PHASE3-HABIT): for "avoid" habits where checking the
 * box records a RELAPSE (not success), the streak is counted as
 * consecutive days WITHOUT a check. The walk stops at the first
 * completed=true log OR at `options.startDate` (the habit's creation
 * date) OR at the 365-day safety cap, whichever comes first. Days before
 * the habit existed don't count toward the streak (otherwise a brand-new
 * "no smoking" habit would immediately show "365 days clean").
 */
export function computeStreak(
  logs: HabitLog[],
  dateStr: string,
  options?: { onVacation?: boolean; invert?: boolean; startDate?: string },
): number {
  if (!logs || logs.length === 0) {
    // For avoid habits with no logs yet, the streak = 1 (today is clean).
    // But only if the habit has existed today — if startDate is in the
    // future or today is before startDate, the streak is 0.
    if (options?.invert && options.startDate) {
      const start = parseISO(options.startDate);
      const today = parseISO(dateStr);
      // Streak = days from startDate (inclusive) to dateStr (inclusive), capped at 365.
      const diffMs = today.getTime() - start.getTime();
      const diffDays = Math.floor(diffMs / 86_400_000) + 1;
      return Math.max(0, Math.min(365, diffDays));
    }
    if (options?.invert) return 1;
    return 0;
  }

  // ── Avoid habit (invert) ──────────────────────────────────────────────
  // Streak = consecutive days WITHOUT a relapse (a relapse = log entry
  // with completed=true). Walk backward from today, stopping at the first
  // relapse OR at the habit's startDate OR at the 365-day cap.
  if (options?.invert) {
    const relapseDays = new Set(
      logs.filter((l) => l.completed).map((l) => toDateString(l.date)),
    );
    // If today has a relapse log, streak = 0.
    if (relapseDays.has(dateStr)) return 0;

    const today = parseISO(dateStr);
    const startBound = options.startDate
      ? parseISO(options.startDate)
      : subDays(today, 365);
    // cursor starts at today (today is "clean" since no relapse log).
    let streak = 0;
    const cursor = parseISO(dateStr);
    for (let i = 0; i < 365; i++) {
      const key = format(cursor, 'yyyy-MM-dd');
      if (relapseDays.has(key)) break;
      if (cursor.getTime() < startBound.getTime()) break;
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  // ── Normal habit ──────────────────────────────────────────────────────
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
 *
 * `habit.habitType === 'avoid'` (PHASE3-HABIT): for "avoid" habits the
 * "good" outcome is NOT relapsing. So a clean day = (no log) OR
 * (log with completed=false), and a relapse = log with completed=true.
 * The strength formula becomes:
 *
 *   strength = ((days - relapses) / days) * 100
 *
 * i.e. the percentage of days in the window that were relapse-free.
 */
export function computeStrengthScore(
  logs: HabitLog[],
  habit: { target: number; targetType: string; vacationMode?: boolean; habitType?: 'normal' | 'avoid' | 'amount' },
  days: number = 30,
  dateStr?: string,
): number {
  if (!logs || logs.length === 0 || days <= 0) {
    // Avoid habit with no logs = every day is clean → strength = 100.
    if (habit.habitType === 'avoid') return 100;
    return 0;
  }

  // Build the set of "yyyy-MM-dd" keys for the last `days` days ending at
  // dateStr (defaults to today in Jakarta TZ). Uses the same jakartaDateKey
  // helper as computeStreak so the window aligns with how logs are stored.
  const anchor = dateStr ?? jakartaDateKey(new Date());
  const anchorDate = parseISO(anchor);
  const windowKeys = new Set<string>();
  for (let i = 0; i < days; i++) {
    windowKeys.add(format(subDays(anchorDate, i), 'yyyy-MM-dd'));
  }

  // PHASE3-HABIT — Avoid habit: count relapses; strength = clean days / total.
  if (habit.habitType === 'avoid') {
    const relapseDays = new Set(
      logs
        .filter((l) => l.completed)
        .map((l) => toDateString(l.date))
        .filter((key) => windowKeys.has(key)),
    );
    // Vacation days are auto-clean (no relapse).
    let cleanDays = windowKeys.size - relapseDays.size;
    if (habit.vacationMode) cleanDays = windowKeys.size; // vacation = clean
    return Math.round(Math.max(0, Math.min(100, (cleanDays / windowKeys.size) * 100)));
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
 *
 * PHASE3-HABIT: for "avoid" habits, `done` means "clean" (no relapse log that
 * day), not "checked". The habit card uses this for the 7-day mini calendar —
 * for an avoid habit, a green day = no relapse.
 */
export function getLast7DaysStatus(
  logs: HabitLog[] | undefined,
  todayStr: string,
  options?: { invert?: boolean },
): { done: boolean; dateNum: number }[] {
  const completedDays = new Set(
    (logs || []).filter((l) => l.completed).map((l) => toDateString(l.date)),
  );
  const today = parseISO(todayStr);
  const result: { done: boolean; dateNum: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = subDays(today, i);
    const key = format(day, 'yyyy-MM-dd');
    const hadActivity = completedDays.has(key);
    // For avoid habits, "done" = clean (no relapse). A day is "clean" if
    // there's no relapse log for it. (We can't distinguish "no log" from
    // "log with completed=false" without a full log list, but for the
    // mini-calendar the optimistic interpretation is fine — show green
    // unless there's a relapse.)
    const done = options?.invert ? !hadActivity : hadActivity;
    result.push({ done, dateNum: day.getDate() });
  }
  return result;
}

/**
 * PHASE3-HABIT — Compute the LONGEST streak ever achieved for a habit, from
 * its full log history. Used by the milestone badges (10/30/100/365 days).
 *
 * For normal habits: longest run of consecutive completed=true days.
 * For avoid habits (invert=true): longest run of consecutive days WITHOUT
 *   a relapse (completed=true log). Bound by startDate (or 365 days before
 *   the latest log if no startDate is provided) so a brand-new avoid habit
 *   doesn't report an artificially high streak.
 *
 * Note: this requires the FULL log history (not just the current month
 * cache). Callers should pass logs from /api/habits/[id]/logs (which
 * defaults to last 30 days — pass `?month=YYYY-MM` repeatedly OR fetch
 * without month param for last 30 days, but for the "all-time longest"
 * calculation we need a longer window). The milestone badges fetch logs
 * via the `/api/habits/[id]/logs?year=YYYY` endpoint (see below) which
 * returns the full year. For habits older than 1 year, we approximate.
 */
export function computeLongestStreak(
  logs: HabitLog[],
  options?: { invert?: boolean; startDate?: string },
): number {
  if (!logs || logs.length === 0) {
    if (options?.invert && options.startDate) {
      const start = parseISO(options.startDate);
      const today = new Date();
      const diffDays = Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1;
      return Math.max(0, Math.min(365, diffDays));
    }
    return 0;
  }

  // Sort logs by date ascending.
  const sorted = [...logs].sort((a, b) => {
    const aKey = toDateString(a.date);
    const bKey = toDateString(b.date);
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  });

  if (options?.invert) {
    // Avoid habit — longest run of consecutive days WITHOUT a relapse.
    const relapseDays = new Set(
      sorted.filter((l) => l.completed).map((l) => toDateString(l.date)),
    );
    // The earliest bound is the habit's startDate (or the earliest log date).
    const earliestLogDate = toDateString(sorted[0].date);
    const startDateStr = options.startDate
      ? format(parseISO(options.startDate), 'yyyy-MM-dd')
      : earliestLogDate;
    const startBound = parseISO(startDateStr < earliestLogDate ? startDateStr : earliestLogDate);
    // Walk from startBound to today (or latest log date, whichever later),
    // counting consecutive non-relapse days.
    const today = new Date();
    const cursor = new Date(startBound);
    let longest = 0;
    let current = 0;
    const safetyCap = 366 * 2; // 2 years max
    for (let i = 0; i < safetyCap; i++) {
      const key = format(cursor, 'yyyy-MM-dd');
      if (relapseDays.has(key)) {
        if (current > longest) longest = current;
        current = 0;
      } else {
        current++;
        if (current > longest) longest = current;
      }
      if (cursor.getTime() > today.getTime()) break;
      cursor.setDate(cursor.getDate() + 1);
    }
    return Math.min(365, longest);
  }

  // Normal habit — longest run of consecutive completed=true days.
  const completedDays = new Set(
    sorted.filter((l) => l.completed).map((l) => toDateString(l.date)),
  );
  if (completedDays.size === 0) return 0;

  // Sort the completed-day keys ascending and find the longest consecutive run.
  const sortedKeys = Array.from(completedDays).sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sortedKeys.length; i++) {
    const prev = parseISO(sortedKeys[i - 1]);
    const curr = parseISO(sortedKeys[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86_400_000);
    if (diffDays === 1) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }
  return longest;
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
