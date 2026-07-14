import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { format, subDays } from 'date-fns';

// Jakarta timezone
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
function jakartaToday(): Date {
  const now = new Date(Date.now() + JAKARTA_OFFSET_MS);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// GET /api/finance/sources/balance-history?period=7d|1m|3m
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '1m';

    const today = jakartaToday();
    let days: number;
    switch (period) {
      case '7d': days = 7; break;
      case '1m': days = 30; break;
      case '3m': days = 90; break;
      default: days = 30;
    }

    const startDate = subDays(today, days - 1);

    // Fetch all fund sources
    const sources = await db.fundSource.findMany({ orderBy: { order: 'asc' } });
    if (sources.length === 0) {
      return NextResponse.json({ sources: [], period });
    }

    // Fetch all transactions in the period (+ some buffer for today's transactions)
    const allTransactions = await db.transaction.findMany({
      where: {
        date: { gte: startDate, lte: today },
      },
      orderBy: { date: 'asc' },
    });

    // Group transactions by source name and by date
    // netFlow[date][source] = income - expense
    const dailyNetFlow: Record<string, Record<string, number>> = {};

    for (const tx of allTransactions) {
      const dateStr = format(new Date(tx.date.getTime() + JAKARTA_OFFSET_MS), 'yyyy-MM-dd');
      if (!dailyNetFlow[dateStr]) dailyNetFlow[dateStr] = {};
      const flow = tx.type === 'income' ? tx.amount : -tx.amount;
      dailyNetFlow[dateStr][tx.source] = (dailyNetFlow[dateStr][tx.source] || 0) + flow;
    }

    // For each source, calculate daily balance by working backwards from current balance
    // Formula: startBalance = currentBalance - sum(all netFlow in period)
    // Then accumulate forward day by day: balance[i] = balance[i-1] + netFlow[i]
    const sourceResults = sources.map(src => {
      // Single pass: calculate periodNetFlow and collect daily data
      let periodNetFlow = 0;
      const dailyData: { date: string; label: string; balance: number; netFlow: number }[] = [];

      for (let i = 0; i < days; i++) {
        const d = subDays(today, days - 1 - i);
        const dateStr = format(d, 'yyyy-MM-dd');
        // Round BEFORE accumulating to ensure periodNetFlow and dailyData use the same values
        const dayFlow = Math.round(dailyNetFlow[dateStr]?.[src.name] || 0);
        periodNetFlow += dayFlow;
        dailyData.push({
          date: dateStr,
          label: format(d, 'd MMM'),
          balance: 0, // placeholder, set below after startBalance is known
          netFlow: dayFlow,
        });
      }

      const startBalance = (src.balance || 0) - periodNetFlow;
      let runningBalance = startBalance;
      for (const point of dailyData) {
        runningBalance += point.netFlow;
        point.balance = Math.round(runningBalance);
      }
      // Safety anchor: force the last data point to exactly match currentBalance
      // This prevents floating-point drift over many days
      if (dailyData.length > 0) {
        dailyData[dailyData.length - 1].balance = Math.round(src.balance || 0);
      }

      // Period stats
      const periodIncome = Math.round(allTransactions
        .filter(t => t.source === src.name && t.type === 'income')
        .reduce((s, t) => s + t.amount, 0));
      const periodExpense = Math.round(allTransactions
        .filter(t => t.source === src.name && t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0));
      const periodChange = periodIncome - periodExpense;

      return {
        id: src.id,
        name: src.name,
        emoji: src.emoji,
        currentBalance: src.balance || 0,
        startBalance: Math.round(startBalance),
        periodIncome: Math.round(periodIncome),
        periodExpense: Math.round(periodExpense),
        periodChange: Math.round(periodChange),
        dailyData,
      };
    });

    return NextResponse.json({ sources: sourceResults, period, days });
  } catch (error) {
    console.error('GET /api/finance/sources/balance-history error:', error);
    return NextResponse.json({ error: 'Failed to fetch balance history' }, { status: 500 });
  }
}