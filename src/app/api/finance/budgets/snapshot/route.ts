import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { jakartaMonthString } from '@/lib/timezone';

// POST /api/finance/budgets/snapshot
// Creates a BudgetSnapshot for the specified month (or current month if not specified).
// Calculates rollover from previous month's snapshot.
// This should be called:
// - On app load (auto-checks if current month snapshot exists)
// - On demand (manual close month)
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // Use Jakarta wall-clock month for the default. Previously used
    // `format(new Date(), 'yyyy-MM')` which reads server-LOCAL components —
    // on Vercel (UTC) at Jakarta midnight rollover (e.g. 2024-12-31 17:30 UTC
    // = 2025-01-01 00:30 WIB), this returned "2024-12" instead of "2025-01".
    const month = searchParams.get('month') || jakartaMonthString();
    const [year, mon] = month.split('-').map(Number);

    // Use UTC midnight to match the Jakarta wall-clock month exactly.
    const monthStart = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));

    // Previous month for rollover
    const prevDate = subMonths(monthStart, 1);
    const prevMonth = format(prevDate, 'yyyy-MM');

    // Get all budgets
    const budgets = await db.budget.findMany();

    // Get all transactions for this month (expenses only)
    const transactions = await db.transaction.findMany({
      where: {
        date: { gte: monthStart, lte: monthEnd },
        type: 'expense',
      },
    });

    // Group spending by category
    const spendingByCategory = new Map<string, number>();
    for (const tx of transactions) {
      spendingByCategory.set(
        tx.category,
        (spendingByCategory.get(tx.category) || 0) + tx.amount
      );
    }

    // Get previous month snapshots for rollover calculation
    const prevSnapshots = await db.budgetSnapshot.findMany({
      where: { month: prevMonth },
    });
    const prevSnapshotMap = new Map(prevSnapshots.map(s => [s.category, s]));

    // Create or update snapshots for each budget
    const results: Array<{
      category: string;
      month: string;
      budget: number;
      spent: number;
      rolloverIn: number;
      effectiveBudget: number;
      rolloverOut: number;
      percentage: number;
      status: string;
    }> = [];

    for (const budget of budgets) {
      const spent = spendingByCategory.get(budget.category) || 0;

      // Calculate rollover from previous month
      const prevSnapshot = prevSnapshotMap.get(budget.category);
      let rolloverIn = 0;
      if (prevSnapshot) {
        // Rollover = what was NOT spent (if positive)
        const prevRemaining = prevSnapshot.effectiveBudget - prevSnapshot.spentAmount;
        rolloverIn = Math.max(0, prevRemaining);
      }

      const effectiveBudget = budget.amount + rolloverIn;
      const percentage = effectiveBudget > 0
        ? Math.round((spent / effectiveBudget) * 100)
        : 0;
      const rolloverOut = Math.max(0, effectiveBudget - spent);

      // Upsert snapshot
      const snapshot = await db.budgetSnapshot.upsert({
        where: { category_month: { category: budget.category, month } },
        create: {
          category: budget.category,
          month,
          budgetAmount: budget.amount,
          spentAmount: spent,
          rolloverIn,
          rolloverOut,
          effectiveBudget,
          percentage,
          status: 'active',
        },
        update: {
          budgetAmount: budget.amount,
          spentAmount: spent,
          rolloverIn,
          rolloverOut,
          effectiveBudget,
          percentage,
        },
      });

      const result: {
        category: string;
        month: string;
        budget: number;
        spent: number;
        rolloverIn: number;
        effectiveBudget: number;
        rolloverOut: number;
        percentage: number;
        status: string;
      } = {
        category: budget.category,
        month,
        budget: budget.amount,
        spent,
        rolloverIn,
        effectiveBudget,
        rolloverOut,
        percentage,
        status: snapshot.status,
      };

      results.push(result);
    }

    return NextResponse.json({
      month,
      snapshots: results,
      count: results.length,
    });
  } catch (error) {
    console.error('Budget snapshot error:', error);
    return NextResponse.json({ error: 'Failed to create budget snapshot' }, { status: 500 });
  }
}

// GET /api/finance/budgets/snapshot?month=2025-07
// Returns snapshots for the specified month (or all if no month specified)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    let where = {};
    if (month) {
      where = { month };
    } else {
      // Return all, ordered by month desc
      where = {};
    }

    const snapshots = await db.budgetSnapshot.findMany({
      where,
      orderBy: month ? { category: 'asc' } : [{ month: 'desc' }, { category: 'asc' }],
    });

    return NextResponse.json(snapshots);
  } catch (error) {
    console.error('GET budget snapshots error:', error);
    return NextResponse.json([]);
  }
}
