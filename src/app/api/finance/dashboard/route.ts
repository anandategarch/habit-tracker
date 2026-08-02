import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { format } from 'date-fns';
import { jakartaDateKey, jakartaMonthString, jakartaNowParts } from '@/lib/timezone';

// ── Jakarta timezone helpers (UTC+7) ───────────────────────────────────
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function jakartaNow(): Date {
  return new Date(Date.now() + JAKARTA_OFFSET_MS);
}

function jakartaToday(): Date {
  const now = jakartaNow();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// GET /api/finance/dashboard?month=2025-01
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || jakartaMonthString();

    const [year, mon] = month.split('-').map(Number);
    // Fetch with 7h buffer to catch Jakarta timezone-boundary transactions.
    const startOfMonth = new Date(year, mon - 1, 1);
    const endOfMonth = new Date(year, mon, 0, 23, 59, 59, 999);
    const fetchStart = new Date(startOfMonth.getTime() - 7 * 60 * 60 * 1000);
    const fetchEnd = new Date(endOfMonth.getTime() + 7 * 60 * 60 * 1000);

    // All transactions for the month (resilient — won't crash on schema mismatch)
    let transactions: Awaited<ReturnType<typeof db.transaction.findMany>> = [];
    try {
      const allFetched = await db.transaction.findMany({
        where: { date: { gte: fetchStart, lte: fetchEnd } },
      });
      // Post-query filter by Jakarta month for exact match
      transactions = allFetched.filter(
        (t) => jakartaDateKey(t.date).slice(0, 7) === month
      );
    } catch (e) { console.error('Finance dashboard: transactions query failed:', e); }

    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const balance = totalIncome - totalExpense;

    // Expense by category
    const expenseByCategory: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
      });

    // Income by category
    const incomeByCategory: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'income')
      .forEach(t => {
        incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
      });

    // Daily spending trend for the month
    const dailySpending: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const day = jakartaDateKey(t.date);
        dailySpending[day] = (dailySpending[day] || 0) + t.amount;
      });

    // Budgets with spent amounts (resilient)
    let budgets: Awaited<ReturnType<typeof db.budget.findMany>> = [];
    try {
      budgets = await db.budget.findMany();
    } catch (e) { console.error('Finance dashboard: budgets query failed:', e); }
    const budgetStatus = budgets.map(b => {
      const spent = expenseByCategory[b.category] || 0;
      return {
        ...b,
        spent,
        remaining: Math.max(0, b.amount - spent),
        percentage: b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0,
      };
    });

    // Total budget
    const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
    const totalBudgetSpent = budgetStatus.reduce((sum, b) => sum + b.spent, 0);

    // Previous month comparison
    const prevMonth = mon === 1 ? `${year - 1}-12` : `${year}-${String(mon - 1).padStart(2, '0')}`;
    const [prevYear, prevMon] = prevMonth.split('-').map(Number);
    const prevStart = new Date(prevYear, prevMon - 1, 1);
    const prevEnd = new Date(prevYear, prevMon, 0, 23, 59, 59, 999);
    const prevFetchStart = new Date(prevStart.getTime() - 7 * 60 * 60 * 1000);
    const prevFetchEnd = new Date(prevEnd.getTime() + 7 * 60 * 60 * 1000);

    // Previous month transactions (resilient)
    let prevTransactions: Awaited<ReturnType<typeof db.transaction.findMany>> = [];
    try {
      const allPrevFetched = await db.transaction.findMany({
        where: { date: { gte: prevFetchStart, lte: prevFetchEnd } },
      });
      prevTransactions = allPrevFetched.filter(
        (t) => jakartaDateKey(t.date).slice(0, 7) === prevMonth
      );
    } catch (e) { console.error('Finance dashboard: prevTransactions query failed:', e); }

    const prevIncome = prevTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const prevExpense = prevTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    // Transaction count
    const transactionCount = transactions.length;

    // Average daily expense
    const daysInMonth = new Date(year, mon, 0).getDate();
    // Use jakartaNowParts for TZ-independent day-of-month
    const jp = jakartaNowParts();
    const currentDay = (jp.year === year && jp.month === mon)
      ? jp.day
      : daysInMonth;
    const avgDailyExpense = currentDay > 0 ? totalExpense / currentDay : 0;

    return NextResponse.json({
      month,
      totalIncome,
      totalExpense,
      balance,
      transactionCount,
      avgDailyExpense,
      projectedMonthlyExpense: avgDailyExpense * daysInMonth,
      expenseByCategory,
      incomeByCategory,
      dailySpending,
      budgetStatus,
      totalBudget,
      totalBudgetSpent,
      previousMonth: {
        month: prevMonth,
        income: prevIncome,
        expense: prevExpense,
      },
    });
  } catch (error) {
    console.error('GET /api/finance/dashboard error:', error);
    return NextResponse.json({ error: 'Failed to fetch finance dashboard' }, { status: 500 });
  }
}