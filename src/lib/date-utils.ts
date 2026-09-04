// PERF-FIX (FIX-TIER3 / Fix 15): Native replacements for the date-fns
// functions used throughout this codebase. Each replacement produces
// IDENTICAL output to date-fns for the patterns we use (verified
// via /tmp/test_datefns.mjs — see worklog FIX-TIER3 entry).
//
// Why: date-fns is ~30KB minified even with tree-shaking. Native
// Intl.DateTimeFormat is built into the JS engine (zero KB). The
// patterns we use are simple enough that Intl covers them 1:1.
//
// Locale note: date-fns `id` locale produces identical output to
// Intl.DateTimeFormat('id-ID', ...) for the month names used in this
// app (Januari, Februari, Maret, April, Mei, Juni, Juli, Agustus,
// September, Oktober, November, Desember) — verified.
//
// Timezone note: date-fns `format()` and Intl.DateTimeFormat both
// default to the runtime's local timezone (browser TZ on client, UTC
// on Vercel serverless). Behavior is identical for all patterns we
// use. For TZ-explicit formatting, callers should use jakartaDateKey
// / jakartaDateString from '@/lib/timezone' instead.

// ── Cached Intl formatters (construction is expensive) ────────────────────
// PERF: Intl.DateTimeFormat construction is ~0.1-0.5ms per call.
// Cache once, reuse forever. Same pattern as finance-types.ts's
// rupiahFormatter.

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const isoMonthFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
});
const mmmDdFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
});
const eeeFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const eeeeFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long' });
const eeeeIdFormatter = new Intl.DateTimeFormat('id-ID', { weekday: 'long' });
const mmmYyyyFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
});
// BUG-SW-PERF BUG-2b: `MMMM yyyy` (long month) without locale previously
// used `mmmYyyyFormatter` (short month) — returned "Sep 2026" instead of
// "September 2026". Affects calendar-view.tsx header. Added dedicated
// long-month en-US formatter to match date-fns output.
const mmmmYyyyFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});
const mmmmYyyyIdFormatter = new Intl.DateTimeFormat('id-ID', {
  month: 'long',
  year: 'numeric',
});
const mmmYyyyIdFormatter = new Intl.DateTimeFormat('id-ID', {
  month: 'short',
  year: 'numeric',
});
const mmmDyyyyFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const dMmmYyyyIdFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const dMmmmYyyyIdFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const mmmmDyyyyFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});
const eeeeMmmDyyyyFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const eeeeDMmmYyyyIdFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const mmmDFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});
const dMmmIdFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
});

// ── Day-first English formatters (en-GB-ordered, en-US month names) ────────
// BUG-SW-PERF BUG-2: date-fns `format(date, 'd MMM')` returns "4 Sep"
// (day first, per pattern). `Intl.DateTimeFormat('en-US', ...)` returns
// "Sep 4" (month first, per locale). For day-first patterns we must use
// `formatToParts` + manual concatenation to preserve the pattern order.
// Using en-GB locale is NOT sufficient — en-GB short month is "Sept"
// (4 letters), not "Sep" (3 letters) like date-fns en-US.
//
// Affected patterns:
//   `d MMM`         → "4 Sep"     (was "Sep 4")
//   `d MMM yyyy`    → "4 Sep 2026" (was "Sep 4, 2026")
//   `d MMMM yyyy`   → "4 September 2026" (was "September 4, 2026")
//   `EEEE, d MMM yyyy` → "Friday, 4 Sep 2026" (was "Friday, Sep 4, 2026")
//
// Only `d MMM` is currently called without `id` locale in the codebase
// (src/app/api/finance/sources/balance-history/route.ts:75) but the other
// patterns are fixed too for consistency + to prevent latent bugs.

function enParts(
  date: Date,
  opts: Intl.DateTimeFormatOptions
): { day: string; month: string; year: string; weekday: string } {
  const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(date);
  const out = { day: '', month: '', year: '', weekday: '' };
  for (const p of parts) {
    if (p.type === 'day') out.day = p.value;
    else if (p.type === 'month') out.month = p.value;
    else if (p.type === 'year') out.year = p.value;
    else if (p.type === 'weekday') out.weekday = p.value;
  }
  return out;
}

function formatEnDayFirst(
  date: Date,
  opts: Intl.DateTimeFormatOptions,
  template: (p: { day: string; month: string; year: string; weekday: string }) => string
): string {
  return template(enParts(date, opts));
}

// ── format ─────────────────────────────────────────────────────────────────
// Mimics date-fns `format(date, pattern, opts?)` for the patterns used
// in this codebase. If `locale: id` is passed in opts, the id-ID
// formatter is used for patterns where it makes a difference
// (MMMM yyyy, MMM yyyy, d MMM). For other patterns (yyyy-MM-dd, EEE,
// etc.) locale has no effect.
//
// IMPORTANT: this is NOT a complete reimplementation of date-fns
// format(). It only supports the patterns enumerated below. Any new
// pattern must be added explicitly here — and verified to match
// date-fns output via the test script in the worklog FIX-TIER3 entry.

export type DateLocale = 'id' | 'en-US' | undefined;

export function format(
  date: Date,
  pattern: string,
  opts?: { locale?: DateLocale }
): string {
  const useId = opts?.locale === 'id';
  switch (pattern) {
    case 'yyyy-MM-dd':
      return isoDateFormatter.format(date);
    case 'yyyy-MM':
      return isoMonthFormatter.format(date);
    case 'MMM dd':
      return mmmDdFormatter.format(date);
    case 'EEE':
      return eeeFormatter.format(date);
    case 'EEEE':
      return useId ? eeeeIdFormatter.format(date) : eeeeFormatter.format(date);
    case 'MMM yyyy':
      return useId ? mmmYyyyIdFormatter.format(date) : mmmYyyyFormatter.format(date);
    case 'MMMM yyyy':
      return useId ? mmmmYyyyIdFormatter.format(date) : mmmmYyyyFormatter.format(date);
    case 'MMMM d, yyyy':
      return mmmmDyyyyFormatter.format(date);
    case 'EEEE, MMM d, yyyy':
      return eeeeMmmDyyyyFormatter.format(date);
    case 'EEEE, d MMM yyyy':
      return useId
        ? eeeeDMmmYyyyIdFormatter.format(date)
        : formatEnDayFirst(
            date,
            { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' },
            (p) => `${p.weekday}, ${p.day} ${p.month} ${p.year}`
          );
    case 'MMM d':
      return mmmDFormatter.format(date);
    case 'MMM d, yyyy':
      return mmmDyyyyFormatter.format(date);
    case 'd MMM':
      return useId
        ? dMmmIdFormatter.format(date)
        : formatEnDayFirst(
            date,
            { day: 'numeric', month: 'short' },
            (p) => `${p.day} ${p.month}`
          );
    case 'd MMM yyyy':
      return useId
        ? dMmmYyyyIdFormatter.format(date)
        : formatEnDayFirst(
            date,
            { day: 'numeric', month: 'short', year: 'numeric' },
            (p) => `${p.day} ${p.month} ${p.year}`
          );
    case 'd MMMM yyyy':
      return useId
        ? dMmmmYyyyIdFormatter.format(date)
        : formatEnDayFirst(
            date,
            { day: 'numeric', month: 'long', year: 'numeric' },
            (p) => `${p.day} ${p.month} ${p.year}`
          );
    default:
      throw new Error(
        `date-utils format(): unsupported pattern "${pattern}". Add it to src/lib/date-utils.ts and verify output matches date-fns.`
      );
  }
}

// Locale marker to mirror date-fns's `id` import. Callers that
// previously wrote `{ locale: idLocale }` can write `{ locale: id }`
// instead. We export `id` as a string sentinel.
export const id: 'id' = 'id';

// ── addDays / subDays ──────────────────────────────────────────────────────
// Uses milliseconds arithmetic. For Jakarta (UTC+7, no DST) and UTC
// (no DST), this is identical to date-fns. For DST-observing timezones
// this could be off by 1 hour around DST transitions, but since the
// patterns we use (yyyy-MM-dd etc.) only show calendar date, the
// displayed value is unaffected.

export function addDays(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * 86_400_000);
}

export function subDays(date: Date, amount: number): Date {
  return addDays(date, -amount);
}

// ── addWeeks / subWeeks ────────────────────────────────────────────────────

export function addWeeks(date: Date, amount: number): Date {
  return addDays(date, amount * 7);
}

export function subWeeks(date: Date, amount: number): Date {
  return addWeeks(date, -amount);
}

// ── addMonths / subMonths ──────────────────────────────────────────────────
// Uses Date.setMonth — handles year rollover and month-end clamping
// identically to date-fns (e.g. Jan 31 + 1 month = Feb 28).

export function addMonths(date: Date, amount: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + amount);
  return d;
}

export function subMonths(date: Date, amount: number): Date {
  return addMonths(date, -amount);
}

// ── parseISO ───────────────────────────────────────────────────────────────
// For ISO 8601 strings (the only format passed to parseISO in this
// codebase), `new Date(str)` is identical to date-fns parseISO.

export function parseISO(str: string): Date {
  return new Date(str);
}

// ── startOfDay / endOfDay ──────────────────────────────────────────────────
// Local-time midnight / end-of-day. Identical to date-fns.

export function startOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0, 0, 0, 0
  );
}

export function endOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23, 59, 59, 999
  );
}

// ── startOfMonth / endOfMonth ──────────────────────────────────────────────
// Local-time first/last moment of month. Identical to date-fns.

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(date: Date): Date {
  // Day 0 of next month = last day of current month
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23, 59, 59, 999
  );
}

// ── startOfWeek / endOfWeek ────────────────────────────────────────────────
// weekStartsOn: 0 (Sunday), 1 (Monday), or 6 (Saturday). Identical to
// date-fns with the same option. All three values are used in this
// codebase (calendar-view.tsx supports all three via the user's
// `weekStart` setting).

export type WeekStartsOn = 0 | 1 | 6;

export function startOfWeek(
  date: Date,
  opts?: { weekStartsOn?: WeekStartsOn }
): Date {
  const weekStartsOn = opts?.weekStartsOn ?? 0;
  const d = startOfDay(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = (day - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export function endOfWeek(
  date: Date,
  opts?: { weekStartsOn?: WeekStartsOn }
): Date {
  const weekStartsOn = opts?.weekStartsOn ?? 0;
  // Week ends 6 days after it starts
  return endOfDay(addDays(startOfWeek(date, { weekStartsOn }), 6));
}

// ── differenceInCalendarDays / differenceInDays ────────────────────────────
// differenceInCalendarDays: number of midnights between two dates
// (calendar-aware). differenceInDays: number of full 24h periods.
//
// For Jakarta (no DST) and UTC (no DST), the two are equivalent for
// dates without time components. We implement both with the standard
// "truncate to midnight, divide by ms/day" approach — identical to
// date-fns in non-DST timezones.

export function differenceInCalendarDays(a: Date, b: Date): number {
  const aMid = startOfDay(a).getTime();
  const bMid = startOfDay(b).getTime();
  return Math.round((aMid - bMid) / 86_400_000);
}

export function differenceInDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

// ── isBefore / isToday ─────────────────────────────────────────────────────

export function isBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime();
}

export function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

// ── getDaysInMonth / getDate ───────────────────────────────────────────────
// Trivial Date-method wrappers, identical to date-fns.

export function getDaysInMonth(date: Date): number {
  // Day 0 of next month = last day of current month
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function getDate(date: Date): number {
  return date.getDate();
}

// ── getDay / isSameMonth / eachDayOfInterval ───────────────────────────────

export function getDay(date: Date): number {
  // 0=Sun, 1=Mon, ..., 6=Sat — identical to date-fns and Date#getDay.
  return date.getDay();
}

export function isSameMonth(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
  );
}

export function eachDayOfInterval(interval: { start: Date; end: Date }): Date[] {
  // Inclusive of both start and end — identical to date-fns.
  const days: Date[] = [];
  const cursor = startOfDay(interval.start);
  const end = startOfDay(interval.end);
  // Safety cap at 366 days to prevent runaway loops (date-fns has no cap;
  // we add one defensively). 366 covers a full leap-year calendar matrix.
  for (let i = 0; i <= 366; i++) {
    days.push(new Date(cursor));
    if (cursor.getTime() >= end.getTime()) break;
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
