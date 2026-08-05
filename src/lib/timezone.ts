/**
 * Jakarta (Asia/Jakarta, UTC+7) timezone helpers.
 *
 * IMPORTANT: Avoid the previous pattern of `addHours(new Date(), 7)` which
 * produces a Date object whose internal epoch is shifted — that leads to
 * subtle bugs when the value is later serialized or compared.
 *
 * Instead, we use the standard Intl API to read "wall clock" components
 * in the target timezone without mutating the underlying epoch.
 */

export const JAKARTA_TZ = 'Asia/Jakarta';

/** Returns the current Date (real epoch). */
export function nowUtc(): Date {
  return new Date();
}

/**
 * Returns the current date string in Jakarta timezone (UTC+7).
 * e.g. "2025-01-15"
 */
export function jakartaDateString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Returns the current month string in Jakarta timezone (UTC+7).
 * e.g. "2025-01"
 */
export function jakartaMonthString(): string {
  return jakartaDateString().slice(0, 7);
}

/**
 * Returns the wall-clock components of "now" in Jakarta timezone.
 */
export function jakartaNowParts(): {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hours: number; // 0-23
  minutes: number; // 0-59
  seconds: number; // 0-59
} {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: JAKARTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    hours: parseInt(get('hour'), 10) % 24, // handle "24" returned by some runtimes
    minutes: parseInt(get('minute'), 10),
    seconds: parseInt(get('second'), 10),
  };
}

/**
 * Returns an ISO string with +07:00 offset representing the current Jakarta
 * wall-clock time. The epoch is the real current epoch; only the displayed
 * offset and components reflect Jakarta time.
 */
export function jakartaNowIso(): string {
  const p = jakartaNowParts();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hours)}:${pad(p.minutes)}:${pad(p.seconds)}+07:00`;
}

/**
 * Convert a YYYY-MM-DD string into a UTC midnight Date object.
 * Used for storing "day" buckets in the database independent of local TZ.
 */
export function dateFromYMD(ymd: string): Date {
  // Validate basic format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error(`Invalid date format: ${ymd}. Expected YYYY-MM-DD.`);
  }
  return new Date(`${ymd}T00:00:00Z`);
}

/**
 * Given any Date (real epoch), return its 'yyyy-MM-dd' representation in
 * Jakarta timezone. Use this instead of the legacy
 * `format(new Date(d.getTime() + JAKARTA_OFFSET_MS), 'yyyy-MM-dd')` pattern
 * which depends on the server's local timezone.
 */
export function jakartaDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Returns a Date whose UTC components match Jakarta's wall-clock components.
 *
 * NOTE: This produces a "shifted epoch" (not a real current-time Date) and
 * should ONLY be used when you need to extract components via `format()` from
 * date-fns (which reads local components). On a UTC server (e.g. Vercel) the
 * result of `format(jakartaShiftedNow(), 'yyyy-MM-dd')` equals today's
 * Jakarta date. Prefer `jakartaDateString()` or `jakartaDateKey(date)` for
 * new code.
 */
export function jakartaShiftedNow(): Date {
  return new Date(Date.now() + 7 * 60 * 60 * 1000);
}

/**
 * Returns a Date whose UTC components match the Jakarta wall-clock
 * components of the input date. Same caveat as `jakartaShiftedNow`.
 */
export function jakartaShifted(date: Date): Date {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000);
}

/**
 * Returns the week number (1-4) for a given day of month.
 * Week 1: days 1-7, Week 2: days 8-14, Week 3: days 15-21, Week 4: days 22-end.
 * Shared between weekly-budget API and finance-explorer component.
 */
export function dayToWeek(day: number): number {
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

/**
 * Returns minutes since midnight (0-1439) for a given Date in Jakarta TZ.
 * Replaces the fragile `new Date(d.getTime() + OFFSET).getUTCHours() * 60 + getUTCMinutes()`
 * pattern. Uses Intl.DateTimeFormat with explicit timeZone — works on ANY
 * server timezone (UTC, local dev, etc.).
 *
 * @param date - the Date to extract time from
 * @returns minutes since midnight (e.g. 08:30 → 510, 14:00 → 840)
 */
export function jakartaTimeMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: JAKARTA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10) % 24;
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  return h * 60 + m;
}

/**
 * Returns a Date representing today-at-midnight in Jakarta (local Date object
 * with year/month/day from jakartaNowParts). Used for date-range calculations
 * where you need a "start of today" boundary.
 *
 * Replaces the `new Date(Date.now() + OFFSET)` + `getFullYear/getMonth/getDate`
 * pattern that produced a shifted-epoch Date.
 *
 * @returns Date for today at 00:00 (Jakarta wall-clock components in local TZ)
 */
export function jakartaToday(): Date {
  const p = jakartaNowParts();
  return new Date(p.year, p.month - 1, p.day);
}
