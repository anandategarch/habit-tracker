import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { jakartaDateString, jakartaDateKey, dateFromYMD } from '@/lib/timezone';

// GET /api/finance/last-done
// Returns the last transaction date for each category with trackLastDone = true
export async function GET() {
  try {
    const trackedCategories = await db.financeCategory.findMany({
      where: { trackLastDone: true },
      select: { name: true, emoji: true, color: true, type: true },
    });

    if (trackedCategories.length === 0) {
      return NextResponse.json([]);
    }

    // PERF-API-1 FIX-TIER1: previously fetched ALL transactions for tracked
    // categories (unbounded — could be thousands of rows). Replaced with a
    // parallel `findFirst({ orderBy: date desc })` per category — exactly
    // one row per category (the latest), fetched in parallel. Bounded by
    // trackedCategories.length queries (typically 5-20) instead of one
    // huge unbounded query.
    //
    // Note: this avoids the `distinct: ['category'] + orderBy: { date: 'desc' }`
    // pattern that Prisma docs warn against (combining distinct with orderBy
    // on a non-distinct field yields implementation-defined results on
    // SQLite). `findFirst` per category is the safe equivalent.
    const lastTransactions = await Promise.all(
      trackedCategories.map((c) =>
        db.transaction.findFirst({
          where: { category: c.name },
          orderBy: { date: 'desc' },
        })
      )
    );

    // Build a map of category name -> last transaction.
    // `findFirst` returns null if no transactions exist for that category.
    const lastTxMap = new Map<string, { date: Date; amount: number; description: string | null }>();
    trackedCategories.forEach((c, i) => {
      const tx = lastTransactions[i];
      if (tx) {
        lastTxMap.set(c.name, { date: tx.date, amount: tx.amount, description: tx.description });
      }
    });

    // BUG-2 fix: replace legacy getTimezoneOffset() shifted-epoch pattern
    // with proper Intl-based helpers from lib/timezone. The old pattern
    // only worked on UTC servers; on non-UTC servers daysAgo was wrong.
    const todayKey = jakartaDateString(); // "yyyy-MM-dd"
    const todayDate = dateFromYMD(todayKey); // UTC-midnight Date for diff calc

    const result = trackedCategories.map(cat => {
      const lastTx = lastTxMap.get(cat.name);
      if (!lastTx) {
        return { category: cat.name, emoji: cat.emoji, color: cat.color, type: cat.type, lastDate: null, daysAgo: null, lastAmount: null, description: null };
      }

      // Get Jakarta date key for the transaction, then compute daysAgo
      const txKey = jakartaDateKey(lastTx.date); // "yyyy-MM-dd"
      const txDate = dateFromYMD(txKey); // UTC-midnight Date
      const daysAgo = Math.round((todayDate.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        category: cat.name,
        emoji: cat.emoji,
        color: cat.color,
        type: cat.type,
        lastDate: lastTx.date,
        daysAgo,
        lastAmount: lastTx.amount,
        description: lastTx.description,
      };
    });

    // Sort: categories with no transactions first, then by daysAgo descending (oldest first)
    result.sort((a, b) => {
      if (a.daysAgo === null && b.daysAgo === null) return 0;
      if (a.daysAgo === null) return -1;
      if (b.daysAgo === null) return 1;
      return b.daysAgo - a.daysAgo;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/finance/last-done error:', error);
    return NextResponse.json([]);
  }
}