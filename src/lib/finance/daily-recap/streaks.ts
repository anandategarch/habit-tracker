// ── Streak algorithms + daily-budget computation for the daily-recap API ──
//
// Pure module: walks the txByDate bucket map backwards from today to count
// consecutive days meeting a streak criteria. No DB calls.
//
// Streak edge case: if the user has NO transaction history at all (fresh
// install), we don't want to claim a 365-day streak. So the caller caps the
// lookback via `maxStreakLookback` (= 30 if there's any history, 0 otherwise).
//
// Exports:
//   - computeNoSpendStreak: consecutive days with 0 expense (today counts
//     only if 0 AND the user actually tracked something today — otherwise a
//     day where the user simply didn't log anything would falsely count as
//     a no-spend day).
//   - computeSmartSpenderStreak: consecutive days where expense < avg7d
//     (only count if today has spending — a no-spend day breaks this streak).
//   - computeDailyBudget: builds the dailyBudget response object (target,
//     spent, remaining, percentage, status) AND walks back to compute
//     budgetStreak (consecutive days under dailyTarget). Returns both.

import { jakartaDateKey } from '@/lib/timezone';
import type { DailyRecapResponse, TransactionRow } from './types';

/**
 * No-spend streak: consecutive days with 0 expense (today counts only if 0
 * AND the user actually tracked something today — otherwise a day where the
 * user simply didn't log anything would falsely count as a no-spend day).
 */
export function computeNoSpendStreak(
  txByDate: Map<string, TransactionRow[]>,
  todayExpense: number,
  hasTodayTx: boolean,
  maxStreakLookback: number
): number {
  let noSpendStreak = 0;
  if (todayExpense === 0 && hasTodayTx && maxStreakLookback > 0) {
    noSpendStreak = 1;
    for (let i = 1; i <= maxStreakLookback; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = jakartaDateKey(d);
      const dayTx = txByDate.get(key);
      // No data for this day = user didn't track, don't count as no-spend
      if (!dayTx) break;
      const exp = dayTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      if (exp === 0) noSpendStreak++;
      else break;
    }
  }
  return noSpendStreak;
}

/**
 * Smart spender streak: consecutive days where expense < avg7d
 * (only count if today has spending — a no-spend day breaks this streak).
 */
export function computeSmartSpenderStreak(
  txByDate: Map<string, TransactionRow[]>,
  todayExpense: number,
  avg7d: number,
  maxStreakLookback: number
): number {
  let smartSpenderStreak = 0;
  if (todayExpense > 0 && todayExpense < avg7d && maxStreakLookback > 0) {
    smartSpenderStreak = 1;
    for (let i = 1; i <= maxStreakLookback; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = jakartaDateKey(d);
      const dayTx = txByDate.get(key);
      if (!dayTx) break;
      const exp = dayTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      if (exp > 0 && exp < avg7d) smartSpenderStreak++;
      else break;
    }
  }
  return smartSpenderStreak;
}

export interface DailyBudgetResult {
  dailyBudget: DailyRecapResponse['dailyBudget'];
  budgetStreak: number;
}

/**
 * Daily budget (from AppSettings.dailyBudgetTarget) + budget streak.
 *
 * User sets a single daily target via the progress ring tap → dialog in the
 * Daily Recap UI. Stored in AppSettings (1 value for all days). 0 = not set
 * → dailyBudget stays null → ring hidden in UI.
 *
 * Also computes budgetStreak: consecutive days under the daily target.
 *
 * Caller must fetch appSettings + extract dailyTarget before calling this
 * (the DB hit can't be inside a pure function).
 */
export function computeDailyBudget(
  dailyTarget: number,
  todayExpense: number,
  txByDate: Map<string, TransactionRow[]>,
  maxStreakLookback: number
): DailyBudgetResult {
  let dailyBudget: DailyRecapResponse['dailyBudget'] = null;
  let budgetStreak = 0;
  if (dailyTarget > 0) {
    const spent = todayExpense;
    const remaining = dailyTarget - spent;
    const percentage = dailyTarget > 0 ? Math.round((spent / dailyTarget) * 100) : 0;
    const status: 'under' | 'on_track' | 'nearing' | 'over' =
      spent > dailyTarget ? 'over'
      : percentage >= 80 ? 'nearing'
      : percentage >= 50 ? 'on_track'
      : 'under';
    dailyBudget = { target: dailyTarget, spent, remaining, percentage, status };

    // Budget streak: consecutive days under daily target
    if (spent <= dailyTarget && maxStreakLookback > 0) {
      budgetStreak = 1;
      for (let i = 1; i <= maxStreakLookback; i++) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = jakartaDateKey(d);
        const dayTx = txByDate.get(key);
        if (!dayTx) break;
        const exp = dayTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        if (exp <= dailyTarget) budgetStreak++;
        else break;
      }
    }
  }
  return { dailyBudget, budgetStreak };
}
