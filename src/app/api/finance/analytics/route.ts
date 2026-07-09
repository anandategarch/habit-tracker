import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/finance/analytics?months=6
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get('months') || '6', 10);

    const now = new Date();
    // Use Jakarta timezone offset (UTC+7) to get current date in Jakarta
    const jakartaOffset = 7 * 60;
    const utcNow = now.getTime() + now.getTimezoneOffset() * 60000;
    const jakartaNow = new Date(utcNow + jakartaOffset * 60000);

    const startDate = new Date(jakartaNow.getFullYear(), jakartaNow.getMonth() - months + 1, 1);
    const endDate = new Date(jakartaNow.getFullYear(), jakartaNow.getMonth() + 1, 0, 23, 59, 59, 999);

    const transactions = await db.transaction.findMany({
      where: { date: { gte: startDate } },
      orderBy: { date: 'asc' },
    });

    // Monthly trend
    const monthlyTrend: { month: string; income: number; expense: number; balance: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(jakartaNow.getFullYear(), jakartaNow.getMonth() - i, 1);
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

    // ─── NEW: Daily Spending (last 90 days for heatmap) ───
    const heatmapStart = new Date(jakartaNow);
    heatmapStart.setDate(heatmapStart.getDate() - 89);
    heatmapStart.setHours(0, 0, 0, 0);

    const heatmapTx = await db.transaction.findMany({
      where: {
        date: { gte: heatmapStart },
        type: 'expense',
      },
    });

    const dailySpending: { date: string; amount: number }[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(jakartaNow);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayTotal = heatmapTx
        .filter(t => new Date(t.date).toISOString().slice(0, 10) === key)
        .reduce((s, t) => s + t.amount, 0);
      dailySpending.push({ date: key, amount: Math.round(dayTotal) });
    }

    // ─── NEW: Monthly Composition by Category (last 6 months) ───
    const monthlyComposition: { month: string; monthLabel: string; categories: Record<string, number> }[] = [];
    const allExpenseCategories = Object.keys(categoryBreakdown).sort((a, b) => categoryBreakdown[b] - categoryBreakdown[a]);

    for (let i = 5; i >= 0; i--) {
      const d = new Date(jakartaNow.getFullYear(), jakartaNow.getMonth() - i, 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const key = d.toISOString().slice(0, 7);

      const monthExpenses = transactions.filter(t => {
        const td = new Date(t.date);
        return td >= d && td <= monthEnd && t.type === 'expense';
      });

      const cats: Record<string, number> = {};
      monthExpenses.forEach(t => {
        cats[t.category] = (cats[t.category] || 0) + t.amount;
      });

      monthlyComposition.push({ month: key, monthLabel: label, categories: cats });
    }

    // ─── NEW: Monthly Savings Trend (last 6 months) ───
    const monthlySavings: { month: string; monthLabel: string; savings: number; income: number; expense: number; changePercent: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(jakartaNow.getFullYear(), jakartaNow.getMonth() - i, 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const key = d.toISOString().slice(0, 7);

      const monthTx = transactions.filter(t => {
        const td = new Date(t.date);
        return td >= d && td <= monthEnd;
      });

      const inc = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const exp = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const sav = inc - exp;

      // Calculate change percent from previous month
      let changePercent = 0;
      if (i > 0) {
        const prevD = new Date(jakartaNow.getFullYear(), jakartaNow.getMonth() - i - 1, 1);
        const prevEnd = new Date(prevD.getFullYear(), prevD.getMonth() + 1, 0, 23, 59, 59, 999);
        const prevTx = transactions.filter(t => {
          const td = new Date(t.date);
          return td >= prevD && td <= prevEnd;
        });
        const prevInc = prevTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const prevExp = prevTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const prevSav = prevInc - prevExp;
        if (prevSav !== 0) {
          changePercent = Math.round(((sav - prevSav) / Math.abs(prevSav)) * 100);
        } else if (sav > 0) {
          changePercent = 100;
        }
      }

      monthlySavings.push({ month: key, monthLabel: label, savings: Math.round(sav), income: Math.round(inc), expense: Math.round(exp), changePercent });
    }

    // ─── NEW: Category Comparison (this month vs last month) ───
    const thisMonthStart = new Date(jakartaNow.getFullYear(), jakartaNow.getMonth(), 1);
    const thisMonthEnd = new Date(jakartaNow.getFullYear(), jakartaNow.getMonth() + 1, 0, 23, 59, 59, 999);
    const lastMonthStart = new Date(jakartaNow.getFullYear(), jakartaNow.getMonth() - 1, 1);
    const lastMonthEnd = new Date(jakartaNow.getFullYear(), jakartaNow.getMonth(), 0, 23, 59, 59, 999);

    const thisMonthExpenses = transactions.filter(t => {
      const td = new Date(t.date);
      return td >= thisMonthStart && td <= thisMonthEnd && t.type === 'expense';
    });
    const lastMonthExpenses = transactions.filter(t => {
      const td = new Date(t.date);
      return td >= lastMonthStart && td <= lastMonthEnd && t.type === 'expense';
    });

    const thisMonthCats: Record<string, number> = {};
    thisMonthExpenses.forEach(t => { thisMonthCats[t.category] = (thisMonthCats[t.category] || 0) + t.amount; });
    const lastMonthCats: Record<string, number> = {};
    lastMonthExpenses.forEach(t => { lastMonthCats[t.category] = (lastMonthCats[t.category] || 0) + t.amount; });

    const allCats = new Set([...Object.keys(thisMonthCats), ...Object.keys(lastMonthCats)]);
    const categoryComparison: { category: string; thisMonth: number; lastMonth: number; change: number }[] = [];
    allCats.forEach(cat => {
      const tm = Math.round(thisMonthCats[cat] || 0);
      const lm = Math.round(lastMonthCats[cat] || 0);
      categoryComparison.push({
        category: cat,
        thisMonth: tm,
        lastMonth: lm,
        change: lm > 0 ? Math.round(((tm - lm) / lm) * 100) : (tm > 0 ? 100 : 0),
      });
    });
    categoryComparison.sort((a, b) => b.thisMonth - a.thisMonth);

    // ─── NEW: Financial Health Score ───
    const thisMonthInc = transactions.filter(t => {
      const td = new Date(t.date);
      return td >= thisMonthStart && td <= thisMonthEnd && t.type === 'income';
    }).reduce((s, t) => s + t.amount, 0);
    const thisMonthExp = thisMonthExpenses.reduce((s, t) => s + t.amount, 0);

    // 1. Rasio Tabungan (savings rate score)
    const savingsRatio = thisMonthInc > 0 ? (thisMonthInc - thisMonthExp) / thisMonthInc : 0;
    const rasioTabungan = Math.min(100, Math.max(0, Math.round(savingsRatio * 100 + 50)));

    // 2. Diversifikasi (number of unique expense categories, max score at 5+)
    const uniqueExpenseCats = new Set(thisMonthExpenses.map(t => t.category)).size;
    const diversifikasi = Math.min(100, Math.round((uniqueExpenseCats / 5) * 100));

    // 3. Disiplin Budget (percentage of budgets not exceeded)
    const budgets = await db.budget.findMany();
    let budgetDiscipline = 0;
    if (budgets.length > 0) {
      let notExceeded = 0;
      budgets.forEach(b => {
        const spent = thisMonthCats[b.category] || 0;
        if (spent <= b.amount) notExceeded++;
      });
      budgetDiscipline = Math.round((notExceeded / budgets.length) * 100);
    } else {
      budgetDiscipline = 50; // Neutral if no budgets
    }

    // 4. Konsistensi (days with transactions / days in month)
    const daysInMonth = jakartaNow.getDate();
    const daysWithTx = new Set(
      transactions
        .filter(t => {
          const td = new Date(t.date);
          return td >= thisMonthStart && td <= thisMonthEnd;
        })
        .map(t => new Date(t.date).toISOString().slice(0, 10))
    ).size;
    const konsistensi = Math.min(100, Math.round((daysWithTx / daysInMonth) * 100));

    // 5. Keseimbangan (ratio of income to expense categories)
    const incomeCats = new Set(
      transactions.filter(t => {
        const td = new Date(t.date);
        return td >= thisMonthStart && td <= thisMonthEnd && t.type === 'income';
      }).map(t => t.category)
    ).size;
    const balanceRatio = uniqueExpenseCats > 0 ? incomeCats / uniqueExpenseCats : 0;
    const keseimbangan = Math.min(100, Math.round(balanceRatio * 100));

    const overallScore = Math.round((rasioTabungan + diversifikasi + budgetDiscipline + konsistensi + keseimbangan) / 5);

    const financialHealth = {
      rasioTabungan,
      diversifikasi,
      disiplinBudget: budgetDiscipline,
      konsistensi,
      keseimbangan,
      overallScore,
    };

    // ─── NEW: Sparkline Data (last 7 days) ───
    const sparklineStart = new Date(jakartaNow);
    sparklineStart.setDate(sparklineStart.getDate() - 6);
    sparklineStart.setHours(0, 0, 0, 0);
    const sparklineTx = await db.transaction.findMany({
      where: { date: { gte: sparklineStart } },
    });
    const sparklineData: { date: string; income: number; expense: number; balance: number; dailyAvg: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(jakartaNow);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayTx = sparklineTx.filter(t => new Date(t.date).toISOString().slice(0, 10) === key);
      const inc = dayTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const exp = dayTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      sparklineData.push({
        date: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        income: Math.round(inc),
        expense: Math.round(exp),
        balance: Math.round(inc - exp),
        dailyAvg: Math.round(exp),
      });
    }

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
      dailySpending,
      monthlyComposition,
      monthlySavings,
      categoryComparison,
      financialHealth,
      sparklineData,
    });
  } catch (error) {
    console.error('GET /api/finance/analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch finance analytics' }, { status: 500 });
  }
}