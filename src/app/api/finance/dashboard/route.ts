import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
// PERF-FIX (FIX-TIER3 / Fix 15): removed unused `format` import from
// `date-fns`. The `format` symbol was imported but never called in this
// file (verified via grep — the `startOfMonth`/`endOfMonth` references
// below are LOCAL const declarations, not date-fns function calls).
import { dayToWeek, jakartaDateKey, jakartaMonthString, jakartaNowParts } from '@/lib/timezone';

// GET /api/finance/dashboard?month=2025-01
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || jakartaMonthString();

    const [year, mon] = month.split('-').map(Number);
    // Total days in the selected month — used by week-4 boundary calc and
    // by the average-daily-expense projection below. Declared early so the
    // FIN-BUG-1 weekly-spent block (which needs it for week-4 end day) can
    // safely reference it.
    const daysInMonth = new Date(year, mon, 0).getDate();
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
      // Post-query filter by Jakarta month for exact match.
      // Also exclude "Penyesuaian Saldo" and "Transfer Antar Sumber" —
      // these are internal movements (adjustment + transfer), NOT real
      // income/expense. Including them would inflate both sides equally,
      // making the dashboard summary misleading.
      transactions = allFetched.filter(
        (t) =>
          jakartaDateKey(t.date).slice(0, 7) === month &&
          t.category !== 'Penyesuaian Saldo' &&
          t.category !== 'Transfer Antar Sumber'
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

    // FIN-BUG-1 fix: weekly budgets should only count the current week's
    // spent, not the entire month's. For monthly budgets (or when viewing
    // a past/future month), keep using the month's total spent.
    //
    // Week boundaries (per lib/timezone.ts dayToWeek):
    //   Week 1: days 1-7,  Week 2: days 8-14,
    //   Week 3: days 15-21, Week 4: days 22-end.
    //
    // Only compute weekly spent when viewing the CURRENT month — for past
    // months there is no meaningful "current week"; for future months there
    // are no transactions yet anyway.
    const isCurrentMonth = month === jakartaMonthString();
    let currentWeekStartDay = 0;
    let currentWeekEndDay = 0;
    if (isCurrentMonth) {
      const jpNow = jakartaNowParts();
      const w = dayToWeek(jpNow.day);
      currentWeekStartDay = w === 1 ? 1 : w === 2 ? 8 : w === 3 ? 15 : 22;
      currentWeekEndDay = w === 4 ? daysInMonth : currentWeekStartDay + 6;
    }
    const weeklyExpenseByCategory: Record<string, number> = {};
    if (isCurrentMonth) {
      transactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
          const tDay = parseInt(jakartaDateKey(t.date).slice(8, 10), 10);
          if (tDay >= currentWeekStartDay && tDay <= currentWeekEndDay) {
            weeklyExpenseByCategory[t.category] =
              (weeklyExpenseByCategory[t.category] || 0) + t.amount;
          }
        });
    }

    // Budgets with spent amounts (resilient)
    let budgets: Awaited<ReturnType<typeof db.budget.findMany>> = [];
    try {
      budgets = await db.budget.findMany();
    } catch (e) { console.error('Finance dashboard: budgets query failed:', e); }
    const budgetStatus = budgets.map(b => {
      // FIN-BUG-1 fix: weekly budgets in the current month use the current
      // week's spent; everything else uses the full month's spent.
      const spent = (b.period === 'weekly' && isCurrentMonth)
        ? (weeklyExpenseByCategory[b.category] || 0)
        : (expenseByCategory[b.category] || 0);
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
        (t) =>
          jakartaDateKey(t.date).slice(0, 7) === prevMonth &&
          t.category !== 'Penyesuaian Saldo' &&
          t.category !== 'Transfer Antar Sumber'
      );
    } catch (e) { console.error('Finance dashboard: prevTransactions query failed:', e); }

    const prevIncome = prevTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const prevExpense = prevTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    // Transaction count
    const transactionCount = transactions.length;

    // Average daily expense
    // Use jakartaNowParts for TZ-independent day-of-month
    const jp = jakartaNowParts();
    const currentDay = (jp.year === year && jp.month === mon)
      ? jp.day
      : daysInMonth;
    // FIN-BUG-13 fix: wrap in Math.round() so money values are whole
    // rupiah (Int) — consistent with the rest of the codebase and avoids
    // float precision drift in downstream calculations/UI.
    const avgDailyExpense = currentDay > 0 ? Math.round(totalExpense / currentDay) : 0;

    // Fetch ACTUAL total balance from all fund sources — this is the real
    // money the user has right now. Each transaction's atomic increment/
    // decrement keeps FundSource.balance in sync, so this is always accurate.
    // Previously the hero card showed `totalIncome - totalExpense` (monthly
    // cash flow) which was misleading — it didn't match the actual money
    // the user has, especially after mid-month adjustments.
    let totalSourceBalance = 0;
    try {
      const sources = await db.fundSource.findMany({ select: { balance: true } });
      totalSourceBalance = sources.reduce((sum, s) => sum + (s.balance || 0), 0);
    } catch (e) { console.error('Finance dashboard: fundSource query failed:', e); }

    return NextResponse.json({
      month,
      totalIncome,
      totalExpense,
      balance: totalSourceBalance, // ACTUAL total balance (was: totalIncome - totalExpense)
      netCashFlow: totalIncome - totalExpense, // monthly cash flow (for reference)
      transactionCount,
      avgDailyExpense,
      projectedMonthlyExpense: Math.round(avgDailyExpense * daysInMonth),
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
    }, {
      headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error('GET /api/finance/dashboard error:', error);
    return NextResponse.json({ error: 'Failed to fetch finance dashboard' }, { status: 500 });
  }
}