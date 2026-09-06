// ── Context assembly for the daily-recap API ──────────────────────────────
//
// Pure module: bundles the 35-key shared context object threaded between
// the daily-recap service modules (alerts, patterns, projections,
// category-stats). Mechanical assembly — no computation, no DB calls.
//
// Caller computes each piece (today aggregates, comparisons, streaks,
// daily-budget, etc.) and passes them in. This function just spreads them
// into the DailyRecapContext shape that the downstream services consume.
//
// Keeping this assembly in its own module means the route handler doesn't
// have a 60-line inline object literal cluttering the orchestration flow.

import type {
  AppSettingsRow,
  DailyRecapContext,
  FinanceCategoryMeta,
  FinanceCategoryRow,
  TransactionRow,
} from './types';
import type { ComparisonsResult } from './comparisons';
import type { TodayAggregates } from './today-aggregates';
import type { DailyBudgetResult } from './streaks';

export interface BuildDailyRecapContextInput {
  // ── Time basics (Jakarta) ─────────────────────────────────────────
  todayStr: string;
  todayParts: { year: number; month: number; day: number; hours: number };
  monthKey: string;
  yy: number;
  mm: number;
  daysInMonth: number;
  daysElapsed: number;

  // ── Raw transactions ─────────────────────────────────────────────
  allRecentTx: TransactionRow[];
  monthTx: TransactionRow[];
  txByDate: Map<string, TransactionRow[]>;
  todayTx: TransactionRow[];

  // ── Categories ────────────────────────────────────────────────────
  financeCategories: FinanceCategoryRow[];
  financeCategoryMap: Map<string, FinanceCategoryMeta>;
  metaFor: (name: string) => { emoji: string; color: string };

  // ── Pre-computed aggregates (from sibling modules) ────────────────
  todayAggregates: TodayAggregates;
  comparisons: ComparisonsResult;

  // ── Streaks ───────────────────────────────────────────────────────
  noSpendStreak: number;
  smartSpenderStreak: number;
  hasHistory: boolean;
  maxStreakLookback: number;

  // ── Budget ────────────────────────────────────────────────────────
  appSettings: AppSettingsRow | null;
  dailyTarget: number;
  dailyBudgetResult: DailyBudgetResult;
}

/**
 * Build the DailyRecapContext object from the pre-computed pieces.
 *
 * The route orchestrator computes each piece (today aggregates,
 * comparisons, streaks, daily-budget) via the sibling modules, then this
 * function spreads them into the context shape that the downstream service
 * modules (alerts, patterns, projections, category-stats) consume.
 */
export function buildDailyRecapContext(input: BuildDailyRecapContextInput): DailyRecapContext {
  const {
    todayStr,
    todayParts,
    monthKey,
    yy,
    mm,
    daysInMonth,
    daysElapsed,
    allRecentTx,
    monthTx,
    txByDate,
    todayTx,
    financeCategories,
    financeCategoryMap,
    metaFor,
    todayAggregates,
    comparisons,
    noSpendStreak,
    smartSpenderStreak,
    hasHistory,
    maxStreakLookback,
    appSettings,
    dailyTarget,
    dailyBudgetResult,
  } = input;

  return {
    // Time basics
    todayStr,
    todayParts,
    monthKey,
    yy,
    mm,
    daysInMonth,
    daysElapsed,

    // Raw transactions
    allRecentTx,
    monthTx,
    txByDate,
    todayTx,
    yesterdayKey: comparisons.yesterdayKey,
    yesterdayExpense: comparisons.yesterdayExpense,

    // Categories
    financeCategories,
    financeCategoryMap,
    metaFor,

    // Today aggregates (spread from TodayAggregates)
    todayIncome: todayAggregates.todayIncome,
    todayExpense: todayAggregates.todayExpense,
    todayCategoryMap: todayAggregates.todayCategoryMap,
    todaySourceMap: todayAggregates.todaySourceMap,
    hourlyBreakdown: todayAggregates.hourlyBreakdown,
    todayTransactions: todayAggregates.todayTransactions,
    todayCategories: todayAggregates.todayCategories,
    todaySources: todayAggregates.todaySources,
    peakHour: todayAggregates.peakHour,
    topTransaction: todayAggregates.topTransaction,
    todayTxCount: todayAggregates.todayTxCount,

    // 7-day window (from comparisons)
    daily7d: comparisons.daily7d,
    last7dExpenses: comparisons.last7dExpenses,
    avg7d: comparisons.avg7d,

    // Streaks
    noSpendStreak,
    smartSpenderStreak,
    hasHistory,
    maxStreakLookback,

    // Budget
    appSettings,
    dailyTarget,
    dailyBudget: dailyBudgetResult.dailyBudget,
    budgetStreak: dailyBudgetResult.budgetStreak,
  };
}
