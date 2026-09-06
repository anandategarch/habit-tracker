// ── Comparisons + 7-day stats + sparkline for the daily-recap API ──────────
//
// Pure module: computes the comparison fields (vs yesterday, vs 7-day
// average), the 7-day daily expense totals array, yesterday's expense, and
// the sparkline "is today lowest/highest in 7d" booleans. No DB calls.
//
// Exports:
//   - computeComparisons: returns daily7d, last7dExpenses, avg7d,
//     yesterdayKey, yesterdayExpense, vsYesterdayChangePct,
//     vsYesterdayDirection, vs7dChangePct, vs7dDirection, isTodayLowest,
//     isTodayHighest.

import { jakartaDateKey } from '@/lib/timezone';
import type { TransactionRow } from './types';

export interface ComparisonsResult {
  daily7d: Array<{ date: string; amount: number; isToday: boolean }>;
  last7dExpenses: number[];
  avg7d: number;
  yesterdayKey: string;
  yesterdayExpense: number;
  vsYesterdayChangePct: number | null;
  vsYesterdayDirection: 'up' | 'down' | 'same' | 'unknown';
  vs7dChangePct: number | null;
  vs7dDirection: 'up' | 'down' | 'same' | 'unknown';
  isTodayLowest: boolean;
  isTodayHighest: boolean;
}

export function computeComparisons(
  txByDate: Map<string, TransactionRow[]>,
  todayStr: string,
  todayExpense: number
): ComparisonsResult {
  // ── Last 7 days expense totals (including today) ─────────────────
  const daily7d: Array<{ date: string; amount: number; isToday: boolean }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = jakartaDateKey(d);
    const dayTx = txByDate.get(key) ?? [];
    const expense = dayTx
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    daily7d.push({ date: key, amount: expense, isToday: key === todayStr });
  }

  const last7dExpenses = daily7d.map((d) => d.amount);
  const avg7d = last7dExpenses.reduce((a, b) => a + b, 0) / 7;

  // ── Yesterday ────────────────────────────────────────────────────
  const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const yesterdayKey = jakartaDateKey(yesterdayDate);
  const yesterdayTx = txByDate.get(yesterdayKey) ?? [];
  const yesterdayExpense = yesterdayTx
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  // ── Comparison ───────────────────────────────────────────────────
  const vsYesterdayChangePct = yesterdayExpense > 0
    ? Math.round(((todayExpense - yesterdayExpense) / yesterdayExpense) * 100)
    : null;
  const vsYesterdayDirection: 'up' | 'down' | 'same' | 'unknown' =
    vsYesterdayChangePct === null ? 'unknown'
    : vsYesterdayChangePct > 0 ? 'up'
    : vsYesterdayChangePct < 0 ? 'down'
    : 'same';

  const vs7dChangePct = avg7d > 0
    ? Math.round(((todayExpense - avg7d) / avg7d) * 100)
    : null;
  const vs7dDirection: 'up' | 'down' | 'same' | 'unknown' =
    vs7dChangePct === null ? 'unknown'
    : vs7dChangePct > 0 ? 'up'
    : vs7dChangePct < 0 ? 'down'
    : 'same';

  // ── Sparkline: is today the lowest / highest in 7d? ──────────────
  const sorted7d = [...daily7d].sort((a, b) => a.amount - b.amount);
  const isTodayLowest = todayExpense > 0 && sorted7d[0].isToday;
  const isTodayHighest = todayExpense > 0 && sorted7d[sorted7d.length - 1].isToday;

  return {
    daily7d,
    last7dExpenses,
    avg7d,
    yesterdayKey,
    yesterdayExpense,
    vsYesterdayChangePct,
    vsYesterdayDirection,
    vs7dChangePct,
    vs7dDirection,
    isTodayLowest,
    isTodayHighest,
  };
}
