import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/finance/analytics?months=3
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get('months') || '6', 10);

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const transactions = await db.transaction.findMany({
      where: { date: { gte: startDate } },
      orderBy: { date: 'asc' },
    });

    // Monthly trend
    const monthlyTrend: { month: string; income: number; expense: number; balance: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthTx = transactions.filter(t => {
        const td = new Date(t.date);
        return td >= d && td <= monthEnd;
      });

      const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

      monthlyTrend.push({ month: label, income, expense, balance: income - expense });
    }

    // Category breakdown (all time in range)
    const allExpense = transactions.filter(t => t.type === 'expense');
    const categoryBreakdown: Record<string, number> = {};
    allExpense.forEach(t => {
      categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + t.amount;
    });

    const totalExpenseInRange = allExpense.reduce((s, t) => s + t.amount, 0);

    // Top spending categories
    const topCategories = Object.entries(categoryBreakdown)
      .sort(([, a], [, b]) => b - a)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenseInRange > 0 ? Math.round((amount / totalExpenseInRange) * 100) : 0,
      }));

    // Weekly pattern (day of week spending)
    const dayOfWeekSpending = [0, 0, 0, 0, 0, 0, 0];
    const dayOfWeekCount = [0, 0, 0, 0, 0, 0, 0];
    allExpense.forEach(t => {
      const day = new Date(t.date).getDay();
      dayOfWeekSpending[day] += t.amount;
      dayOfWeekCount[day]++;
    });
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyPattern = dayLabels.map((label, i) => ({
      day: label,
      total: Math.round(dayOfWeekSpending[i] * 100) / 100,
      avg: dayOfWeekCount[i] > 0 ? Math.round((dayOfWeekSpending[i] / dayOfWeekCount[i]) * 100) / 100 : 0,
      count: dayOfWeekCount[i],
    }));

    // Income sources
    const allIncome = transactions.filter(t => t.type === 'income');
    const incomeBreakdown: Record<string, number> = {};
    allIncome.forEach(t => {
      incomeBreakdown[t.category] = (incomeBreakdown[t.category] || 0) + t.amount;
    });

    const totalIncomeInRange = allIncome.reduce((s, t) => s + t.amount, 0);

    const incomeSources = Object.entries(incomeBreakdown)
      .sort(([, a], [, b]) => b - a)
      .map(([source, amount]) => ({
        source,
        amount,
        percentage: totalIncomeInRange > 0 ? Math.round((amount / totalIncomeInRange) * 100) : 0,
      }));

    // Savings rate
    const savingsRate = totalIncomeInRange > 0
      ? Math.round(((totalIncomeInRange - totalExpenseInRange) / totalIncomeInRange) * 100)
      : 0;

    // Largest transactions
    const largestExpenses = allExpense
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        category: t.category,
        description: t.description,
        amount: t.amount,
        date: t.date,
      }));

    return NextResponse.json({
      monthlyTrend,
      topCategories,
      categoryBreakdown,
      weeklyPattern,
      incomeSources,
      savingsRate,
      totalIncomeInRange,
      totalExpenseInRange,
      largestExpenses,
    });
  } catch (error) {
    console.error('GET /api/finance/analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch finance analytics' }, { status: 500 });
  }
}