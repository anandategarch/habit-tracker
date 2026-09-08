// ── Types for the dashboard API + extracted services ─────────────────────
//
// This file is the single source of truth for the response shape of
// /api/dashboard, plus the row types that mirror the Prisma `select`
// shapes used by the queries, plus the result interfaces returned by the
// split-out service modules (completion-stats, chart-builders,
// time-tracked-summary, last-done-summary, finance-overview).
//
// All shapes are LIFTED VERBATIM from the original inline definitions in
// src/app/api/dashboard/route.ts (pre-split). No new fields, no removed
// fields — the JSON response is byte-identical.

import type { Habit } from '@prisma/client';

// ── Period selector (query string ?period=...) ────────────────────────────

export type Period = '7d' | '1m' | '3m' | '6m' | '1y' | 'all';

// ── Row types (mirror the Prisma `select` shapes used by the queries) ─────

/** HabitOption rows (difficulty → XP map). */
export interface DifficultyOptionRow {
  name: string;
  xp: number;
}

/** Goal rows for active goals — only the progress field is consumed. */
export interface ActiveGoalRow {
  progress: number;
}

/** DailyLog rows for the last 30 days (mood + sleep only). */
export interface RecentDailyLogRow {
  mood: number;
  sleep: number;
}

/** Transaction rows scoped to the current month — for the finance overview. */
export interface MonthTransactionRow {
  type: string;
  amount: number;
  category: string;
}

/** Budget rows — category + amount only. */
export interface BudgetRow {
  category: string;
  amount: number;
}

/** HabitLog rows with the habit's difficulty joined (for XP calc). */
export interface HabitLogRow {
  date: Date;
  habitId: string;
  completed: boolean;
  completedAt: string | null;
  habit: { difficulty: string };
}

/** Time-tracked HabitLog rows (week + prev-week windows). */
export interface TimeHabitLogRow {
  date: Date;
  completedAt: string | null;
  habitId: string;
}

/** Latest-log HabitLog rows (one per habit, for last-done summary). */
export type LatestHabitLogRow = TimeHabitLogRow;

// ── Response-shape types ──────────────────────────────────────────────────

export interface WeeklyChartPoint {
  day: string;
  date: string;
  // ONE-CLICK (4-a): machine-readable yyyy-MM-dd twin of the `date`
  // display label — lets the dashboard weekly bar chart deep-link via
  // openTrackerDate(dateKey) without parsing "MMM dd" back to a date.
  dateKey: string;
  completed: number;
  total: number;
  rate: number;
}

export interface MonthlyChartPoint {
  day: string;
  completed: number;
  total: number;
  rate: number;
}

export interface StackedBarPoint {
  day: string;
  completed: number;
  missed: number;
  total: number;
  rate: number;
}

export interface WeeklyPatternPoint {
  day: string;
  fullDay: string;
  rate: number;
  avgCompleted: string;
}

export interface CategoryPerformancePoint {
  category: string;
  done: number;
  total: number;
  rate: number;
}

export interface TodayFocusItem {
  id: string;
  name: string;
  icon: string;
  priority: string;
}

export interface HabitDetailStat {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: string;
  completed: number;
  total: number;
  rate: number;
  streak: number;
}

export interface BestWorstHabit {
  name: string;
  icon: string;
  rate: number;
}

export interface FinanceOverview {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  transactionCount: number;
  budgetWarning: number; // >80% used
  budgetExceeded: number; // >100% used
}

export interface TimeHabitWeekTime {
  day: string;
  time: string | null;
  minutes: number | null;
}

export interface TimeHabitSummary {
  id: string;
  name: string;
  icon: string;
  color: string;
  targetTime: string | null;
  todayTime: string | null; // "HH:mm" if completed today
  todayDone: boolean;
  weekAvg: string | null; // "HH:mm" average this week
  weekOnTarget: number; // count on-target this week
  weekTotal: number; // count with time this week
  weekOnTargetRate: number; // percentage
  prevAvg: string | null; // "HH:mm" average last week
  trend: number | null; // minutes diff (negative = improving/earlier)
  weekTimes: TimeHabitWeekTime[];
}

export interface LastDoneSummaryItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  interval: string | null;
  intervalDays: number;
  lastDate: Date | null;
  daysAgo: number | null;
  completedAt: string | null;
  overdue: boolean;
}

// ── Result of computeCompletionStats ──────────────────────────────────────
//
// The completion-stats module returns the per-period completion numbers,
// streaks, XP/level, productivity score, best/worst habit, category
// performance, today's focus, and per-habit detail stats. Chart data is
// returned separately by chart-builders (it shares the dailyCompletionMap
// but has a different shape).
export interface CompletionStatsResult {
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  successToday: number;
  weeklyCompletion: number;
  monthlyCompletion: number;
  bestHabit: BestWorstHabit;
  worstHabit: BestWorstHabit;
  totalXP: number;
  currentLevel: number;
  nextLevelXP: number;
  currentLevelXP: number;
  levelProgress: number;
  goalProgress: number;
  moodAverage: string;
  sleepAverage: string;
  productivityScore: number;
  categoryPerformance: CategoryPerformancePoint[];
  todayFocus: TodayFocusItem[];
  habitDetailStats: HabitDetailStat[];
}

// ── Result of fetchDashboardBaseData (Phase 1 parallel DB queries) ────────
export interface DashboardBaseData {
  diffOptions: DifficultyOptionRow[];
  habits: Habit[];
  activeGoals: ActiveGoalRow[];
  recentDailyLogs: RecentDailyLogRow[];
  monthTransactions: MonthTransactionRow[];
  budgets: BudgetRow[];
}

// ── Result of fetchDashboardLogData (Phase 2 parallel DB queries) ─────────
export interface DashboardLogData {
  allLogsRaw: HabitLogRow[];
  allTimeLogs: TimeHabitLogRow[];
  latestLogs: LatestHabitLogRow[];
}

// ── Full dashboard response (the JSON shape returned by GET /api/dashboard)
//
// Kept in sync with the object literal returned by NextResponse.json() in
// route.ts. The orchestrator assembles this from the service-module
// results; it is NOT computed by a single function.
export interface DashboardResponse {
  totalHabits: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  successToday: number;
  weeklyCompletion: number;
  monthlyCompletion: number;
  bestHabit: BestWorstHabit;
  worstHabit: BestWorstHabit;
  totalXP: number;
  currentLevel: number;
  nextLevelXP: number;
  currentLevelXP: number;
  levelProgress: number;
  goalProgress: number;
  moodAverage: string;
  sleepAverage: string;
  productivityScore: number;
  weeklyChartData: WeeklyChartPoint[];
  monthlyChartData: MonthlyChartPoint[];
  categoryPerformance: CategoryPerformancePoint[];
  todayFocus: TodayFocusItem[];
  period: Period;
  habitDetailStats: HabitDetailStat[];
  stackedBarData: StackedBarPoint[];
  weeklyPattern: WeeklyPatternPoint[];
  financeOverview: FinanceOverview;
  timeTrackedSummary: TimeHabitSummary[];
  lastDoneSummary: LastDoneSummaryItem[];
}
