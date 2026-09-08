import { db } from '@/lib/db';
import { signedDelta } from '@/lib/money';
import { jakartaDateKey } from '@/lib/timezone';
import { NextResponse } from 'next/server';
import type { RecurringTransaction } from '@prisma/client';

// POST /api/finance/recurring/process
//
// Process all active recurring transactions whose next due date has passed.
// For each due recurring:
//   - Create a Transaction dated for the due date (not "now") so historical
//     catch-up reflects when it SHOULD have happened.
//   - Atomically update the matching FundSource balance (same pattern as
//     POST /api/finance/transactions).
//   - Update `lastRunAt` to the due date so the next call computes the
//     correct next-run.
//
// Single-step semantics: each recurring creates AT MOST one transaction per
// process call. If the user doesn't process for a long time, only the latest
// missed run is created (not all of them) — this avoids flooding the database
// with backdated transactions on the first call after a long absence. Users
// can call process repeatedly to catch up further if desired (each call
// advances lastRunAt by one interval).
//
// Idempotency: `lastRunAt` is updated inside the same transaction as the
// transaction create, so a crash mid-call leaves a consistent state (either
// both happened or neither).
//
// Returns: { processed: number, skipped: number, total: number, items: [...] }

// BUG-PHASE12: all date math in this file previously used server-local TZ
// (`date.getFullYear()`, `new Date(y, m, d)`, etc.). On a UTC server (the
// Vercel default) this caused a 1-day offset for Jakarta users — a recurring
// with `startDate` "2026-01-15" (sent from the form as 2026-01-14T17:00:00Z,
// i.e. Jakarta midnight) was read by `getFullYear/getMonth/getDate` as
// Jan 14 (UTC), so the transaction was dated Jan 14 instead of Jan 15. Now
// every Date is converted to a Jakarta YMD triplet up front, and all
// arithmetic + comparisons happen in YMD space. The resulting Date object
// is constructed via `ymdToDate()` (= server-local midnight of the Jakarta
// YMD), which round-trips correctly through `jakartaDateKey()` regardless
// of the server's TZ.

interface YMD {
  y: number;
  m: number; // 0-indexed (Jan = 0) — matches Date.getMonth()
  d: number;
}

/** Convert any Date to its Jakarta-TZ YMD triplet (month 0-indexed). */
function toYMD(date: Date): YMD {
  const [y, m, d] = jakartaDateKey(date).split('-').map(Number);
  return { y, m: m - 1, d };
}

/** Construct a Date at server-local midnight for the given YMD. Because the
 * YMD was extracted in Jakarta TZ, `jakartaDateKey(ymdToDate(...))` always
 * returns the same YMD back — the storage round-trip is TZ-consistent. */
function ymdToDate(ymd: YMD): Date {
  return new Date(ymd.y, ymd.m, ymd.d);
}

/** Number of days in a given (0-indexed) month. */
function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

/** Day of week (0=Sun..6=Sat) for a YMD. Uses Date.UTC so the result is
 * independent of the server's TZ. */
function dayOfWeek(ymd: YMD): number {
  return new Date(Date.UTC(ymd.y, ymd.m, ymd.d)).getUTCDay();
}

/** Add `months` to a YMD, clamping the day to the new month's last day. */
function addMonths(ymd: YMD, months: number): YMD {
  let ny = ymd.y;
  let nm = ymd.m + months;
  // Normalize month into [0, 11], carrying years.
  while (nm < 0) {
    ny--;
    nm += 12;
  }
  while (nm > 11) {
    ny++;
    nm -= 12;
  }
  const last = daysInMonth(ny, nm);
  return { y: ny, m: nm, d: Math.min(ymd.d, last) };
}

/** Add `days` to a YMD. Uses Date.UTC so the day arithmetic is exact. */
function addDays(ymd: YMD, days: number): YMD {
  const ms = Date.UTC(ymd.y, ymd.m, ymd.d) + days * 86_400_000;
  const dt = new Date(ms);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate() };
}

/** Signed day difference: b - a (both YMDs). Positive if b is after a. */
function diffDays(a: YMD, b: YMD): number {
  const aMs = Date.UTC(a.y, a.m, a.d);
  const bMs = Date.UTC(b.y, b.m, b.d);
  return Math.round((bMs - aMs) / 86_400_000);
}

/**
 * Compute the next due Date for a recurring transaction.
 * Returns null if the recurring is inactive or has ended.
 *
 * The "anchor" for computing the next run is `lastRunAt` if set, otherwise
 * `startDate`. This means a brand-new recurring uses startDate as the
 * reference point for its first run.
 */
function computeNextDue(r: RecurringTransaction, now: Date): Date | null {
  if (!r.isActive) return null;
  const todayYMD = toYMD(now);
  if (r.endDate) {
    const endYMD = toYMD(r.endDate);
    // End date exclusive: if today is past the end date, no more runs.
    // diffDays(endYMD, todayYMD) = todayYMD - endYMD; > 0 means today is
    // past endDate.
    if (diffDays(endYMD, todayYMD) > 0) return null;
  }

  const interval = Math.max(1, r.interval);
  const anchorDate = r.lastRunAt ?? r.startDate;
  const anchorYMD = toYMD(anchorDate);
  let nextYMD: YMD;

  if (r.frequency === 'daily') {
    nextYMD = addDays(anchorYMD, interval);
  } else if (r.frequency === 'weekly') {
    if (r.lastRunAt == null) {
      // First run: find the first dayOfWeek on or after startDate.
      const dow = r.dayOfWeek ?? 0;
      const currentDow = dayOfWeek(anchorYMD);
      const diff = (dow - currentDow + 7) % 7;
      nextYMD = addDays(anchorYMD, diff);
    } else {
      // Subsequent runs: advance by exactly `interval` weeks (same weekday).
      nextYMD = addDays(anchorYMD, interval * 7);
    }
  } else {
    // monthly
    const dom = r.dayOfMonth ?? 1;
    if (r.lastRunAt == null) {
      const targetDay = Math.min(dom, daysInMonth(anchorYMD.y, anchorYMD.m));
      let candidate: YMD = { y: anchorYMD.y, m: anchorYMD.m, d: targetDay };
      // If the candidate date is before startDate (e.g. startDate=Jan 15,
      // dayOfMonth=10 → candidate=Jan 10 < Jan 15), advance by `interval`
      // months and clamp to the new month's last day.
      const startYMD = toYMD(r.startDate);
      if (diffDays(startYMD, candidate) < 0) {
        candidate = addMonths(candidate, interval);
      }
      nextYMD = candidate;
    } else {
      const candidate = addMonths(anchorYMD, interval);
      const last = daysInMonth(candidate.y, candidate.m);
      nextYMD = { y: candidate.y, m: candidate.m, d: Math.min(dom, last) };
    }
  }

  return ymdToDate(nextYMD);
}

interface ProcessedItem {
  id: string;
  recurringId: string;
  category: string;
  amount: number;
  type: string;
  dueDate: string;
}

export async function POST() {
  try {
    const now = new Date();
    const allRecurring = await db.recurringTransaction.findMany({
      where: { isActive: true },
    });

    const processed: ProcessedItem[] = [];
    let skipped = 0;

    for (const r of allRecurring) {
      const next = computeNextDue(r, now);
      if (!next) {
        skipped++;
        continue;
      }
      // Due if next's Jakarta date <= today's Jakarta date. Both are
      // converted to YMD so the comparison is TZ-independent.
      // diffDays(todayYMD, nextYMD) = nextYMD - todayYMD; > 0 means next
      // is in the future → skip. <= 0 means next is due (today or past).
      const nextYMD = toYMD(next);
      const todayYMD = toYMD(now);
      if (diffDays(todayYMD, nextYMD) > 0) {
        // next is in the future (today < next).
        skipped++;
        continue;
      }
      // Respect endDate — don't process past the end.
      // diffDays(endYMD, nextYMD) = nextYMD - endYMD; > 0 means next is
      // past endDate → skip.
      if (r.endDate) {
        const endYMD = toYMD(r.endDate);
        if (diffDays(endYMD, nextYMD) > 0) {
          // next is past endDate.
          skipped++;
          continue;
        }
      }

      // Create transaction + update fund source balance atomically.
      // Transaction is dated for the due date (`next`), not "now" — so
      // historical catch-up reflects when the recurring SHOULD have run.
      try {
        const created = await db.$transaction(async (tx) => {
          // BUGHUNT-ROUND2 RECUR-RACE: atomic claim gate (compare-and-set).
          // The outer findMany read `lastRunAt` outside any transaction, so
          // two concurrent process calls (two tabs, PWA + browser, or a
          // double-click before the button re-renders as disabled) could
          // BOTH compute the same due date and BOTH create the transaction —
          // duplicating the money movement. This updateMany only succeeds
          // when `lastRunAt` is still the value we read (and the recurring
          // is still active); the losing call matches 0 rows and skips.
          // Single-statement UPDATE = atomic in SQLite/libsql.
          const claimed = await tx.recurringTransaction.updateMany({
            where: { id: r.id, isActive: true, lastRunAt: r.lastRunAt },
            data: { lastRunAt: next },
          });
          if (claimed.count === 0) {
            // A concurrent call already processed (or deactivated) this
            // recurring — do not create a duplicate transaction.
            return null;
          }

          const tx_record = await tx.transaction.create({
            data: {
              type: r.type,
              amount: r.amount,
              category: r.category,
              description: r.description ?? null,
              date: next,
              notes: null,
              source: r.source,
            },
          });

          // Update FundSource balance (same pattern as POST /transactions).
          // Skip silently if the source doesn't exist in FundSource table —
          // the transaction is still recorded.
          const fundSource = await tx.fundSource.findUnique({
            where: { name: r.source },
          });
          if (fundSource) {
            await tx.fundSource.update({
              where: { id: fundSource.id },
              data: { balance: { increment: signedDelta(r.amount, r.type) } },
            });
          }

          // lastRunAt was already advanced by the claim above.

          return tx_record;
        });

        if (!created) {
          // Lost the race to a concurrent process call — not an error.
          skipped++;
          continue;
        }

        processed.push({
          id: created.id,
          recurringId: r.id,
          category: r.category,
          amount: r.amount,
          type: r.type,
          dueDate: next.toISOString(),
        });
      } catch (e) {
        // Don't let one recurring's failure block the rest.
        console.error(`Failed to process recurring ${r.id}:`, e);
        skipped++;
      }
    }

    return NextResponse.json({
      processed: processed.length,
      skipped,
      total: allRecurring.length,
      items: processed,
    });
  } catch (error) {
    console.error('POST /api/finance/recurring/process error:', error);
    return NextResponse.json(
      { error: 'Failed to process recurring transactions' },
      { status: 500 }
    );
  }
}
