// ── Patterns builder for the daily-recap API ────────────────────────────
//
// Computes the "patterns" section of the response:
//   - bestDayThisMonth / worstDayThisMonth (lowest/highest expense day)
//   - dayOfWeekPattern (avg spend per weekday, this month)
//   - personalityTag (No-Spend Master / Big Spender / Smart Spender / etc.)
//   - transactionDiversity (unique categories today)
//   - cashFlowHealth (expense/income ratio today)
//   - savingsRate (% income not spent today)
//   - categoryAnomaly (z-score per category vs 30-day history)
//
// Also returns the intermediate `monthDailyTotals` and `catDayTotals` maps
// because downstream modules (projections.ts, category-stats.ts) need them.

import { jakartaDateKey } from '@/lib/timezone';
import type { DailyRecapContext, DailyRecapResponse } from './types';
import { DAY_NAMES, stdDev, zScore } from './helpers';

export interface PatternsResult {
  patterns: DailyRecapResponse['patterns'];
  // Intermediate maps consumed by downstream modules:
  monthDailyTotals: Map<string, number>; // dateKey → total expense
  catDayTotals: Map<string, Map<string, number>>; // category → dateKey → total
}

export function buildPatterns(ctx: DailyRecapContext): PatternsResult {
  const {
    monthTx,
    todayCategoryMap,
    todayExpense,
    todayIncome,
    dailyBudget,
    smartSpenderStreak,
    avg7d,
    allRecentTx,
  } = ctx;

  // ── Best/worst day this month (lowest/highest expense) ───────────
  const monthDailyTotals = new Map<string, number>();
  for (const tx of monthTx) {
    if (tx.type !== 'expense') continue;
    const key = jakartaDateKey(tx.date);
    monthDailyTotals.set(key, (monthDailyTotals.get(key) ?? 0) + tx.amount);
  }
  let bestDayThisMonth: { date: string; amount: number } | null = null;
  let worstDayThisMonth: { date: string; amount: number } | null = null;
  for (const [date, amount] of monthDailyTotals.entries()) {
    // Only consider days that have at least one transaction recorded.
    // (Days with no data are excluded — we don't want to falsely report
    // a 0-expense "best day" when the user simply didn't track.)
    if (!bestDayThisMonth || amount < bestDayThisMonth.amount) bestDayThisMonth = { date, amount };
    if (!worstDayThisMonth || amount > worstDayThisMonth.amount) worstDayThisMonth = { date, amount };
  }

  // ── Day-of-week pattern (this month) ─────────────────────────────
  const dowStats = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
  for (const [date, amount] of monthDailyTotals.entries()) {
    const d = new Date(date + 'T00:00:00Z');
    const dow = d.getUTCDay();
    dowStats[dow].total += amount;
    dowStats[dow].count += 1;
  }
  const dayOfWeekPattern = dowStats.map((s, i) => ({
    day: DAY_NAMES[i],
    avgAmount: s.count > 0 ? Math.round(s.total / s.count) : 0,
    count: s.count,
  }));

  // ── Personality tag ──────────────────────────────────────────────
  let personalityTag: { tag: string; emoji: string; description: string };
  if (todayExpense === 0) {
    personalityTag = { tag: 'No-Spend Master', emoji: '💎', description: 'Hari tanpa pengeluaran — disiplin!' };
  } else if (dailyBudget?.status === 'over') {
    personalityTag = { tag: 'Big Spender', emoji: '💸', description: 'Over budget hari ini — besok lebih hemat ya' };
  } else if (smartSpenderStreak >= 3) {
    personalityTag = { tag: 'Smart Spender', emoji: '🎯', description: `${smartSpenderStreak} hari hemat berturut — konsisten!` };
  } else if (todayExpense < avg7d) {
    personalityTag = { tag: 'Mindful Spender', emoji: '🧘', description: 'Hari ini di bawah rata-rata — pertahankan!' };
  } else if (todayExpense > avg7d * 1.5) {
    personalityTag = { tag: 'Wild Spender', emoji: '🎢', description: 'Spending 1.5× di atas normal — easy tiger' };
  } else {
    personalityTag = { tag: 'Steady Spender', emoji: '⚖️', description: 'Spending normal hari ini' };
  }

  // ── Transaction diversity: unique categories today ───────────────
  const transactionDiversity = todayCategoryMap.size;

  // ── Cash flow health: income vs expense ratio today ──────────────
  const ratio = todayIncome > 0 ? todayExpense / todayIncome : (todayExpense > 0 ? Infinity : 0);
  const cashFlowHealth = {
    ratio: ratio === Infinity ? -1 : Math.round(ratio * 100) / 100,
    status: (ratio === Infinity ? 'danger' : ratio > 1 ? 'danger' : ratio > 0.7 ? 'warning' : 'healthy') as 'healthy' | 'warning' | 'danger',
  };

  // ── Savings rate: % income not spent today ───────────────────────
  const savingsRate = todayIncome > 0
    ? Math.round(((todayIncome - todayExpense) / todayIncome) * 100)
    : (todayExpense === 0 ? 100 : 0);

  // ── Category anomaly: z-score per category vs 30-day history ─────
  // Re-aggregate: per category, per day, total expense.
  const catDayTotals = new Map<string, Map<string, number>>(); // category -> dateKey -> total
  for (const tx of allRecentTx) {
    if (tx.type !== 'expense') continue;
    const dateKey = jakartaDateKey(tx.date);
    if (!catDayTotals.has(tx.category)) catDayTotals.set(tx.category, new Map());
    const dayMap = catDayTotals.get(tx.category)!;
    dayMap.set(dateKey, (dayMap.get(dateKey) ?? 0) + tx.amount);
  }
  const categoryAnomaly: Array<{ category: string; zScore: number; amount: number; isAnomaly: boolean; avgAmount: number }> = [];
  for (const [cat, dayMap] of catDayTotals.entries()) {
    const todayAmount = todayCategoryMap.get(cat)?.amount ?? 0;
    if (todayAmount === 0) continue; // skip categories not spent today
    const allDailyTotals = Array.from(dayMap.values());
    const mean = allDailyTotals.reduce((a, b) => a + b, 0) / allDailyTotals.length;
    const sd = stdDev(allDailyTotals);
    const z = zScore(todayAmount, mean, sd);
    categoryAnomaly.push({
      category: cat,
      zScore: Math.round(z * 100) / 100,
      amount: todayAmount,
      avgAmount: Math.round(mean),
      isAnomaly: z > 1.5, // 1.5σ above normal
    });
  }
  categoryAnomaly.sort((a, b) => b.zScore - a.zScore);

  return {
    patterns: {
      bestDayThisMonth,
      worstDayThisMonth,
      dayOfWeekPattern,
      personalityTag,
      transactionDiversity,
      cashFlowHealth,
      savingsRate,
      // Filter to actual anomalies first, then slice — previously sliced
      // top-3 by z-score which could include non-anomalies (zScore < 1.5)
      // while dropping real anomalies further down the list.
      categoryAnomaly: categoryAnomaly.filter((c) => c.isAnomaly).slice(0, 5),
    },
    monthDailyTotals,
    catDayTotals,
  };
}
