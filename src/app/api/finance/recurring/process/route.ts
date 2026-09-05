import { db } from '@/lib/db';
import { signedDelta } from '@/lib/money';
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

/** Returns a Date with only year/month/day (time = midnight local). */
function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Returns the number of days in a given (0-indexed) month. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Adds `months` months to `date`, clamping the day to month-end if needed. */
function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const originalDay = d.getDate();
  d.setDate(1); // avoid overflow shifting the month
  d.setMonth(d.getMonth() + months);
  const last = daysInMonth(d.getFullYear(), d.getMonth());
  d.setDate(Math.min(originalDay, last));
  return d;
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
  if (r.endDate && dateOnly(r.endDate).getTime() < dateOnly(now).getTime()) {
    return null;
  }

  const interval = Math.max(1, r.interval);
  const anchor = r.lastRunAt ?? r.startDate;
  let next: Date;

  if (r.frequency === 'daily') {
    next = new Date(anchor.getTime() + interval * 24 * 60 * 60 * 1000);
  } else if (r.frequency === 'weekly') {
    if (r.lastRunAt == null) {
      // First run: find the first dayOfWeek on or after startDate.
      const dow = r.dayOfWeek ?? 0;
      const d = new Date(r.startDate);
      const current = d.getDay();
      const diff = (dow - current + 7) % 7;
      d.setDate(d.getDate() + diff);
      next = d;
    } else {
      // Subsequent runs: advance by exactly `interval` weeks (same weekday).
      next = new Date(r.lastRunAt.getTime() + interval * 7 * 24 * 60 * 60 * 1000);
    }
  } else {
    // monthly
    const dom = r.dayOfMonth ?? 1;
    if (r.lastRunAt == null) {
      const sy = r.startDate.getFullYear();
      const sm = r.startDate.getMonth();
      const targetDay = Math.min(dom, daysInMonth(sy, sm));
      let candidate = new Date(sy, sm, targetDay);
      // If the candidate date is before startDate (e.g. startDate=Jan 15,
      // dayOfMonth=10 → candidate=Jan 10 < Jan 15), advance by `interval`
      // months and clamp to the new month's last day.
      if (dateOnly(candidate).getTime() < dateOnly(r.startDate).getTime()) {
        candidate = addMonths(candidate, interval);
      }
      next = candidate;
    } else {
      const candidate = addMonths(r.lastRunAt, interval);
      const last = daysInMonth(candidate.getFullYear(), candidate.getMonth());
      next = new Date(
        candidate.getFullYear(),
        candidate.getMonth(),
        Math.min(dom, last)
      );
    }
  }

  return next;
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
      // Due if next's date-only <= today's date-only.
      if (dateOnly(next).getTime() > dateOnly(now).getTime()) {
        skipped++;
        continue;
      }
      // Respect endDate — don't process past the end.
      if (r.endDate && dateOnly(next).getTime() > dateOnly(r.endDate).getTime()) {
        skipped++;
        continue;
      }

      // Create transaction + update fund source balance atomically.
      // Transaction is dated for the due date (`next`), not "now" — so
      // historical catch-up reflects when the recurring SHOULD have run.
      try {
        const created = await db.$transaction(async (tx) => {
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

          // Update lastRunAt to the due date (not "now") so the next call
          // computes the correct next-run even if process was called late.
          await tx.recurringTransaction.update({
            where: { id: r.id },
            data: { lastRunAt: next },
          });

          return tx_record;
        });

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
