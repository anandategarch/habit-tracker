import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { format, subDays, differenceInCalendarDays } from 'date-fns';

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
    // balance_on_day_X = currentBalance - sum(netFlow from day X+1 to today)
    const sourceResults = sources.map(src => {
      // Calculate total net flow from startDate to today for this source
      let futureNetFlow = 0; // net flow AFTER a given day
      const dailyBalances: { date: string; balance: number; netFlow: number }[] = [];

      // First pass: calculate cumulative net flow from end to start
      // We'll iterate from today backwards
      for (let i = days - 1; i >= 0; i--) {
        const d = subDays(today, i);
        const dateStr = format(d, 'yyyy-MM-dd');
        const dayFlow = dailyNetFlow[dateStr]?.[src.name] || 0;
        // balance on this day = currentBalance - futureNetFlow - dayFlow... 
        // Actually: balance_on_day = currentBalance - sum_of_netFlow_from_day+1_to_today
        // We need: balance on start date = currentBalance - all_netFlow_in_period
        // balance on day X = balance_on_start + sum_of_netFlow_from_start_to_day_X
      }

      // Simpler approach: calculate period start balance, then accumulate forward
      let periodNetFlow = 0;
      for (let i = 0; i < days; i++) {
        const d = subDays(today, days - 1 - i);
        const dateStr = format(d, 'yyyy-MM-dd');
        const dayFlow = dailyNetFlow[dateStr]?.[src.name] || 0;
        periodNetFlow += dayFlow;
      }

      const startBalance = (src.balance || 0) - periodNetFlow;
      let runningBalance = startBalance;

      const dailyData: { date: string; label: string; balance: number; netFlow: number }[] = [];
      for (let i = 0; i < days; i++) {
        const d = subDays(today, days - 1 - i);
        const dateStr = format(d, 'yyyy-MM-dd');
        const dayFlow = dailyNetFlow[dateStr]?.[src.name] || 0;
        runningBalance += dayFlow;
        dailyData.push({
          date: dateStr,
          label: format(d, 'd MMM'),
          balance: Math.round(runningBalance),
          netFlow: Math.round(dayFlow),
        });
      }

      // Period stats
      const periodIncome = allTransactions
        .filter(t => t.source === src.name && t.type === 'income')
        .reduce((s, t) => s + t.amount, 0);
      const periodExpense = allTransactions
        .filter(t => t.source === src.name && t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0);
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