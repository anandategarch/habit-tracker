import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { jakartaDateKey } from '@/lib/timezone';

// ── Lazy-load all-time per-category stats ───────────────────────────────
// Called ONLY when the user switches to the "All-time" tab in the Daily
// Recap's "Insight per Kategori" section. Returns all-time max/avg per-tx
// and per-day stats for the requested category names.
//
// This was extracted from the daily-recap API for performance: the all-time
// query fetches ALL expense transactions (potentially thousands for long-
// term users), which adds significant latency on every daily-recap load.
// By making it lazy, the initial page load is fast, and the all-time data
// loads on-demand only when needed.
//
// Request body: { categories: string[] } — the category names to compute
//   stats for (usually the categories that have transactions today).
//
// Response: { [categoryName]: { maxTransaction, avgTransaction, maxDaily, avgDaily } }

interface AllTimeStats {
  maxTransaction: number;
  avgTransaction: number;
  maxDaily: number;
  avgDaily: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const categories: string[] = Array.isArray(body?.categories) ? body.categories : [];

    if (categories.length === 0) {
      return NextResponse.json({});
    }

    // Fetch ALL expense transactions for the requested categories.
    // Using `in` filter so we only fetch relevant categories (not ALL
    // transactions across all categories). For users with many categories,
    // this is much smaller than fetching everything.
    const allTx = await db.transaction.findMany({
      where: {
        type: 'expense',
        category: { in: categories },
      },
      select: { amount: true, date: true, category: true },
    });

    // Bucket per category: tx amounts + day totals
    const catTxAmounts = new Map<string, number[]>();
    const catDayTotals = new Map<string, Map<string, number>>();

    for (const tx of allTx) {
      if (!catTxAmounts.has(tx.category)) {
        catTxAmounts.set(tx.category, []);
        catDayTotals.set(tx.category, new Map());
      }
      catTxAmounts.get(tx.category)!.push(tx.amount);
      const dk = jakartaDateKey(tx.date);
      const dm = catDayTotals.get(tx.category)!;
      dm.set(dk, (dm.get(dk) ?? 0) + tx.amount);
    }

    // Compute stats per category
    const result: Record<string, AllTimeStats> = {};
    for (const cat of categories) {
      const txAmounts = catTxAmounts.get(cat) ?? [];
      const dailyTotals = Array.from((catDayTotals.get(cat) ?? new Map()).values());

      result[cat] = {
        maxTransaction: txAmounts.length > 0 ? Math.max(...txAmounts) : 0,
        avgTransaction: txAmounts.length > 0
          ? Math.round(txAmounts.reduce((a, b) => a + b, 0) / txAmounts.length)
          : 0,
        maxDaily: dailyTotals.length > 0 ? Math.max(...dailyTotals) : 0,
        avgDaily: dailyTotals.length > 0
          ? Math.round(dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length)
          : 0,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/finance/category-alltime error:', error);
    return NextResponse.json({ error: 'Failed to load all-time stats' }, { status: 500 });
  }
}
