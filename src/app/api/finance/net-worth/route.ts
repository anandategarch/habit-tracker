import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { format, subDays } from '@/lib/date-utils';
// PERF-FIX (FIX-TIER3 / Fix 15): replaced `date-fns` with native Intl-based
// utility module. Output is identical for the patterns and helpers used
// here (yyyy-MM-dd + subDays) — verified via test script in worklog
// FIX-TIER3 entry.
import { jakartaToday, jakartaDateKey } from '@/lib/timezone';

// GET /api/finance/net-worth?period=30d|90d|365d
//
// Returns the user's total net worth across ALL FundSource balances, plus
// historical daily values for the requested period (default 90 days), plus
// the previous period's value so the UI can show a trend (↑/↓ vs bulan lalu).
//
// Historical reconstruction mirrors the per-source balance-history route:
// we sum each source's CURRENT balance, then walk backwards day-by-day
// subtracting that day's net cash flow (income − expense) for ALL sources.
// This is mathematically equivalent to: netWorth(day) = sum of all sources'
// balance(day), where each source's balance(day) = currentBalance −
// sum(netFlow between day+1 and today).
//
// Response shape:
//   {
//     current: number,        // sum of all FundSource.balance right now
//     previous: number,       // value at end of previous-comparable period
//     change: number,         // current − previous (signed rupiah)
//     changePct: number,      // round((change / |previous|) * 100), 0 if previous=0
//     history: [{ date: 'yyyy-MM-dd', value: number }],
//     sources: [{ id, name, emoji, balance, pctOfTotal }],
//     period: '30d' | '90d' | '365d',
//     days: number
//   }
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '90d';

    let days: number;
    switch (period) {
      case '30d': days = 30; break;
      case '90d': days = 90; break;
      case '365d': days = 365; break;
      default: days = 90;
    }

    const sources = await db.fundSource.findMany({ orderBy: { order: 'asc' } });
    const current = sources.reduce((s, src) => s + (src.balance || 0), 0);

    // ── Build source breakdown ──────────────────────────────────────────
    // Each source's share of total net worth (positive only — sources with
    // negative balances contribute 0 to the pie to avoid confusion).
    const absTotal = sources.reduce((s, src) => s + Math.max(0, src.balance || 0), 0);
    const sourceBreakdown = sources.map((src) => ({
      id: src.id,
      name: src.name,
      emoji: src.emoji,
      balance: src.balance || 0,
      // Percentage of positive-total. If total is 0, fall back to 0.
      pctOfTotal: absTotal > 0 ? Math.round((Math.max(0, src.balance || 0) / absTotal) * 100) : 0,
    }));

    // ── Historical reconstruction ───────────────────────────────────────
    // We fetch ALL transactions in the period range (with ±7h TZ buffer for
    // Jakarta midnight boundaries — same pattern as balance-history route),
    // bucket them by date (Jakarta), then walk forward from startBalance to
    // today. startBalance = current − periodNetFlow (across ALL sources).
    const today = jakartaToday();
    const BUFFER_MS = 7 * 60 * 60 * 1000;
    const startDate = subDays(today, days - 1);
    const fetchStart = new Date(startDate.getTime() - BUFFER_MS);
    const fetchEnd = new Date(today.getTime() + BUFFER_MS);

    const allTransactions = await db.transaction.findMany({
      where: { date: { gte: fetchStart, lte: fetchEnd } },
      orderBy: { date: 'asc' },
      select: { amount: true, type: true, date: true },
    });

    // Sum net flow per Jakarta date (income adds, expense subtracts).
    const dailyNetFlow: Record<string, number> = {};
    let periodNetFlow = 0;
    for (const tx of allTransactions) {
      const dateStr = jakartaDateKey(tx.date);
      const flow = tx.type === 'income' ? tx.amount : -tx.amount;
      dailyNetFlow[dateStr] = (dailyNetFlow[dateStr] || 0) + flow;
      periodNetFlow += flow;
    }

    // startBalance = current balance − all net flow that happened during
    // the period. This is the net-worth value at the START of day 0
    // (i.e. just before the first day's transactions applied).
    const startBalance = current - periodNetFlow;

    // Walk forward, accumulating the daily net flow to produce the chart
    // data points. Round each point to whole rupiah (int — money is always int).
    const history: { date: string; value: number }[] = [];
    let running = startBalance;
    for (let i = 0; i < days; i++) {
      const d = subDays(today, days - 1 - i);
      const dateStr = format(d, 'yyyy-MM-dd');
      running += Math.round(dailyNetFlow[dateStr] || 0);
      history.push({ date: dateStr, value: Math.round(running) });
    }
    // Anchor the last point to the actual current net worth to prevent
    // floating-point drift over many days (90/365).
    if (history.length > 0) {
      history[history.length - 1].value = Math.round(current);
    }

    // ── Previous period comparison ──────────────────────────────────────
    // "Previous" = the value at the equivalent point in the previous period.
    // For a 30d window, previous = value 30 days before today (= start of
    // the 30d window, which is history[0]). For 90d / 365d, same logic.
    // This gives "vs bulan lalu" / "vs 3 bulan lalu" / "vs tahun lalu".
    const previous = history.length > 0 ? history[0].value : current;
    const change = current - previous;
    const changePct = previous !== 0
      ? Math.round((change / Math.abs(previous)) * 100)
      : 0;

    return NextResponse.json({
      current: Math.round(current),
      previous: Math.round(previous),
      change: Math.round(change),
      changePct,
      history,
      sources: sourceBreakdown,
      period,
      days,
    });
  } catch (error) {
    console.error('GET /api/finance/net-worth error:', error);
    return NextResponse.json({
      current: 0,
      previous: 0,
      change: 0,
      changePct: 0,
      history: [],
      sources: [],
      period: '90d',
      days: 90,
    });
  }
}
