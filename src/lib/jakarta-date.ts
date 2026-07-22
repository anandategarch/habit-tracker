import { format, addHours } from 'date-fns';

const JAKARTA_OFFSET_HOURS = 7;

/**
 * Returns the current date string in Jakarta timezone (UTC+7).
 * e.g., "2025-01-15"
 * Use this instead of `new Date().toISOString().split('T')[0]` which returns UTC date.
 */
export function jakartaDateString(): string {
  return format(addHours(new Date(), JAKARTA_OFFSET_HOURS), 'yyyy-MM-dd');
}

/**
 * Returns the current month string in Jakarta timezone (UTC+7).
 * e.g., "2025-01"
 */
export function jakartaMonthString(): string {
  return format(addHours(new Date(), JAKARTA_OFFSET_HOURS), 'yyyy-MM');
}
