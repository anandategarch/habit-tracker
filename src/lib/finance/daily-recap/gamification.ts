// ── Gamification for the daily-recap API ──────────────────────────────────
//
// Pure module: computes the three gamification fields (dailyBadge,
// comboMultiplier, personalRecord) from already-computed inputs. No DB calls.
//
// Exports:
//   - computeGamification: returns { dailyBadge, comboMultiplier, personalRecord }

import type { DailyRecapResponse } from './types';

export interface GamificationInput {
  todayExpense: number;
  todayHours: number; // wall-clock hour in Jakarta (0-23)
  avg7d: number;
  budgetStreak: number;
  smartSpenderStreak: number;
  dailyBudget: DailyRecapResponse['dailyBudget'];
  monthDailyTotals: Map<string, number>; // dateKey → total expense (this month)
}

export interface GamificationResult {
  dailyBadge: { id: string; name: string; emoji: string; description: string } | null;
  comboMultiplier: number;
  personalRecord: { isRecord: boolean; amount: number; rank: number; totalDays: number } | null;
}

export function computeGamification(input: GamificationInput): GamificationResult {
  const {
    todayExpense,
    todayHours,
    avg7d,
    budgetStreak,
    smartSpenderStreak,
    dailyBudget,
    monthDailyTotals,
  } = input;

  // ── Daily badge ──────────────────────────────────────────────────
  let dailyBadge: { id: string; name: string; emoji: string; description: string } | null = null;
  if (todayExpense === 0 && todayHours >= 12) {
    dailyBadge = { id: 'no_spend', name: 'No-Spend Day', emoji: '💎', description: 'Hari tanpa pengeluaran' };
  } else if (dailyBudget?.status === 'under' && dailyBudget.percentage <= 50) {
    dailyBadge = { id: 'budget_master', name: 'Budget Master', emoji: '🎯', description: 'Spending di bawah 50% budget harian' };
  } else if (smartSpenderStreak >= 5) {
    dailyBadge = { id: 'streak_master', name: 'Streak Master', emoji: '🔥', description: `${smartSpenderStreak} hari hemat berturut` };
  } else if (todayExpense > 0 && todayExpense < avg7d * 0.5) {
    dailyBadge = { id: 'frugal', name: 'Frugal Star', emoji: '⭐', description: 'Spending kurang dari setengah rata-rata' };
  }

  // ── Combo multiplier: 3+ days under budget = combo ──────────────
  const comboMultiplier = Math.max(1, budgetStreak >= 3 ? Math.floor(budgetStreak / 3) + 1 : 1);

  // ── Personal record: is today the lowest expense in 30 days? ─────
  // Use `filter(... < todayExpense).length + 1` for rank instead of
  // `indexOf` — indexOf returns the first index of a duplicate value, so
  // if two days had the same amount, the rank was wrong.
  const all30dExpenses = Array.from(monthDailyTotals.values()).sort((a, b) => a - b);
  const isRecord = todayExpense > 0 && all30dExpenses.length >= 3 && todayExpense === all30dExpenses[0];
  const personalRecord = isRecord
    ? { isRecord: true, amount: todayExpense, rank: 1, totalDays: all30dExpenses.length }
    : todayExpense > 0 && all30dExpenses.length >= 3
    ? (() => {
        // Rank = number of days with strictly less expense + 1.
        const lowerCount = all30dExpenses.filter((e) => e < todayExpense).length;
        return { isRecord: false, amount: todayExpense, rank: lowerCount + 1, totalDays: all30dExpenses.length };
      })()
    : null;

  return { dailyBadge, comboMultiplier, personalRecord };
}
