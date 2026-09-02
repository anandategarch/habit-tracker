/**
 * Money handling utilities.
 *
 * All monetary amounts are stored in the database as Int (whole rupiah).
 * Never use Float for money — it causes rounding errors like
 * `0.1 + 0.2 === 0.30000000000000004`.
 *
 * Frontend input is a digit-only string (e.g. "1500000"); the API receives
 * either a string or number and converts to Int via `toMoneyInt`.
 */

/**
 * Convert any user input (string | number | undefined) into a safe integer
 * of whole rupiah. Returns 0 for empty/invalid input.
 *
 * - "1.500.000"  -> 1500000   (Indonesian thousand separators stripped)
 * - "1500000"    -> 1500000
 * - 1500000      -> 1500000
 * - "abc"        -> 0
 * - undefined    -> 0
 */
export function toMoneyInt(input: unknown): number {
  if (input == null) return 0;
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return 0;
    return Math.trunc(input);
  }
  if (typeof input === 'string') {
    // Strip everything except digits (handles "1.500.000", "1,500,000", " 1500 ")
    const digits = input.replace(/[^\d]/g, '');
    if (!digits) return 0;
    const n = parseInt(digits, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Validate that an amount is a positive integer of whole rupiah.
 * Returns a validated integer or throws.
 */
export function assertPositiveMoney(input: unknown): number {
  const n = toMoneyInt(input);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error('Amount must be a positive whole number');
  }
  return n;
}

/**
 * Returns the signed delta to apply to a balance for a given transaction.
 * Income: +amount, Expense: -amount.
 *
 * Use this with Prisma's atomic `increment` operator:
 *   `data: { balance: { increment: signedDelta(amount, type) } }`
 * to avoid the lost-update race in read-modify-write patterns.
 *
 * Accepts `string` for `type` because the Prisma schema stores it as `String`
 * (not an enum). Invalid values are treated as expense (the safer default for
 * a personal finance app — better to under-count than over-count).
 */
export function signedDelta(
  amount: number,
  type: 'income' | 'expense' | string
): number {
  return type === 'income' ? amount : -amount;
}

/**
 * Apply a transaction delta to a fund source balance.
 * Income adds, expense subtracts. Returns the new balance.
 *
 * NOTE: Prefer `signedDelta` + Prisma's atomic `increment` for writes to
 * avoid lost-update races. This helper is kept only for read-only calculations.
 */
export function applyDelta(
  balance: number,
  amount: number,
  type: 'income' | 'expense' | string
): number {
  return balance + signedDelta(amount, type);
}

/**
 * Returns the inverse transaction type. Used when reverting a transaction's
 * effect on a fund source balance.
 */
export function inverseType(type: 'income' | 'expense' | string): 'income' | 'expense' {
  return type === 'income' ? 'expense' : 'income';
}
