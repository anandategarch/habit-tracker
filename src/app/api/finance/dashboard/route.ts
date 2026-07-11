import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { format } from 'date-fns';

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
    const month = searchParams.get('month') || format(jakartaToday(), 'yyyy-MM');

    const [year, mon] = month.split('-').map(Number);
    const startOfMonth = new Date(year, mon - 1, 1);
    const endOfMonth = new Date(year, mon, 0, 23, 59, 59, 999);

    // All transactions for the month
    const transactions = await db.transaction.findMany({
      where: { date: { gte: startOfMonth, lte: endOfMonth } },
    });

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
        const day = format(new Date(t.date.getTime() + JAKARTA_OFFSET_MS), 'yyyy-MM-dd');
        dailySpending[day] = (dailySpending[day] || 0) + t.amount;
      });

    // Budgets with spent amounts
    const budgets = await db.budget.findMany();
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

    const prevTransactions = await db.transaction.findMany({
      where: { date: { gte: prevStart, lte: prevEnd } },
    });

    const prevIncome = prevTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const prevExpense = prevTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    // Transaction count
    const transactionCount = transactions.length;

    // Average daily expense
    const daysInMonth = new Date(year, mon, 0).getDate();
    const today = jakartaToday();
    const currentDay = (today.getFullYear() === year && today.getMonth() + 1 === mon)
      ? today.getDate()
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