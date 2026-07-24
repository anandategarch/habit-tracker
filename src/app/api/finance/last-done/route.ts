import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

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

    const categoryNames = trackedCategories.map(c => c.name);

    // Get the latest transaction for each tracked category
    const lastTransactions = await db.transaction.findMany({
      where: { category: { in: categoryNames } },
      orderBy: { date: 'desc' },
      distinct: ['category'],
    });

    // Build a map of category name -> last transaction
    const lastTxMap = new Map<string, { date: Date; amount: number; description: string | null }>();
    for (const tx of lastTransactions) {
      if (!lastTxMap.has(tx.category)) {
        lastTxMap.set(tx.category, { date: tx.date, amount: tx.amount, description: tx.description });
      }
    }

    // Jakarta timezone helper
    const toJakarta = (d: Date) => {
      const utc = d.getTime() + d.getTimezoneOffset() * 60000;
      return new Date(utc + 7 * 60 * 60000);
    };
    const nowJakarta = toJakarta(new Date());
    const todayStart = new Date(nowJakarta.getFullYear(), nowJakarta.getMonth(), nowJakarta.getDate()).getTime();

    const result = trackedCategories.map(cat => {
      const lastTx = lastTxMap.get(cat.name);
      if (!lastTx) {
        return { category: cat.name, emoji: cat.emoji, color: cat.color, type: cat.type, lastDate: null, daysAgo: null, lastAmount: null, description: null };
      }

      const jakartaDate = toJakarta(lastTx.date);
      const txDateOnly = new Date(jakartaDate.getFullYear(), jakartaDate.getMonth(), jakartaDate.getDate()).getTime();
      const daysAgo = Math.floor((todayStart - txDateOnly) / (1000 * 60 * 60 * 24));

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