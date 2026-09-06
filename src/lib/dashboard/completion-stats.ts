// ── Completion stats for the dashboard API ───────────────────────────────
//
// Pure function: takes already-fetched data + pre-computed maps and
// returns all per-period completion numbers, streaks, XP/level, mood/sleep
// averages, productivity score, best/worst habit, category performance,
// today's focus, and per-habit detail stats.
//
// BUG-PHASE12 / BUG-13 preserves:
//   - Streak calc is lenient about TODAY: if today is not yet a perfect
//     day, skip it and start counting from yesterday (matches
//     computeStreak in daily-tracker.tsx). Previously the dashboard would
//     report streak=0 the moment a single habit was unfinished today.
//
// All bug fixes from the original inline implementation are preserved
// verbatim — only the call site moved.

import {
  startOfDay,
  subDays,
  format,
  differenceInCalendarDays,
} from '@/lib/date-utils';
import type {
  HabitLogRow,
  ActiveGoalRow,
  RecentDailyLogRow,
  CompletionStatsResult,
  BestWorstHabit,
} from './types';
import {
  calcLevel,
  calcNextLevelXP,
  habitsActiveOnDate,
  theoreticalMaxInRange,
} from './helpers';
import type { Habit } from '@prisma/client';

// ── Context passed to computeCompletionStats ──────────────────────────────
//
// Bundles the shared state the function needs. Mirrors the
// DailyRecapContext pattern from lib/finance/daily-recap/types.ts — we
// use a context object instead of 15+ positional params.
export interface CompletionStatsContext {
  // ── Raw data ──────────────────────────────────────────────────────
  habits: Habit[];
  /** allLogs already filtered to active habits (orchestrator does the filter). */
  allLogs: HabitLogRow[];
  /** XP map: difficulty name → XP value. Built by orchestrator from diffOptions. */
  xpMap: Record<string, number>;
  activeGoals: ActiveGoalRow[];
  recentDailyLogs: RecentDailyLogRow[];

  // ── Date params (Jakarta) ─────────────────────────────────────────
  today: Date;
  todayKey: string; // yyyy-MM-dd
  weekStart: Date;
  weekEnd: Date;
  monthStart: Date;
  monthEnd: Date;
  periodStart: Date;
  periodDays: number;

  // ── Pre-computed maps ─────────────────────────────────────────────
  /** Pre-sorted epoch-ms array for binary-search lookups. */
  habitCreatedDates: number[];
  /** dateStr → Set of habitIds completed that day (built by orchestrator). */
  dailyCompletionMap: Map<string, Set<string>>;
}

// ── Main entry point ──────────────────────────────────────────────────────

export function computeCompletionStats(
  ctx: CompletionStatsContext,
): CompletionStatsResult {
  const {
    habits,
    allLogs,
    xpMap,
    activeGoals,
    recentDailyLogs,
    today,
    todayKey,
    weekStart,
    weekEnd,
    monthStart,
    monthEnd,
    periodStart,
    periodDays,
    habitCreatedDates,
    dailyCompletionMap,
  } = ctx;

  // ── Overall period completion rate ───────────────────────────────
  const totalCompletedInPeriod = allLogs.filter(l => l.completed).length;
  const theoreticalMaxPeriod = theoreticalMaxInRange(periodStart, today, habitCreatedDates);
  const completionRate = theoreticalMaxPeriod > 0
    ? Math.round((totalCompletedInPeriod / theoreticalMaxPeriod) * 100)
    : 0;

  // ── Today's success rate ─────────────────────────────────────────
  const todayCompleted = dailyCompletionMap.get(todayKey)?.size || 0;
  const todayActiveHabits = habitsActiveOnDate(today, habitCreatedDates);
  const successToday = todayActiveHabits > 0
    ? Math.round((todayCompleted / todayActiveHabits) * 100)
    : 0;

  // ── Weekly completion ────────────────────────────────────────────
  const weekCompleted = allLogs.filter(l => {
    const d = l.date;
    return d >= weekStart && d <= weekEnd && l.completed;
  }).length;
  const theoreticalMaxWeek = theoreticalMaxInRange(weekStart, weekEnd, habitCreatedDates);
  const weeklyCompletion = theoreticalMaxWeek > 0
    ? Math.round((weekCompleted / theoreticalMaxWeek) * 100)
    : 0;

  // ── Monthly completion ───────────────────────────────────────────
  const monthCompleted = allLogs.filter(l => {
    const d = l.date;
    return d >= monthStart && d <= monthEnd && l.completed;
  }).length;
  const theoreticalMaxMonth = theoreticalMaxInRange(monthStart, monthEnd, habitCreatedDates);
  const monthlyCompletion = theoreticalMaxMonth > 0
    ? Math.round((monthCompleted / theoreticalMaxMonth) * 100)
    : 0;

  // ── Streak calculation ───────────────────────────────────────────
  // A "perfect day" = all habits that existed on that day were completed.
  // Pre-compute date keys & active counts for all days in the streak range
  // to avoid redundant subDays() + format() + habitsActiveOnDate() calls
  // (previously called 2x per day in two separate loops = 730+ calls for
  // 365 days).
  const maxStreakCheck = Math.min(periodDays, 365);

  // Pre-compute once: [{ key, activeOnDay, completedOnDay }] for each day
  const dayData: { key: string; activeOnDay: number; completedOnDay: number }[] = [];
  for (let i = 0; i < maxStreakCheck; i++) {
    const d = subDays(today, i);
    const key = format(d, 'yyyy-MM-dd');
    const activeOnDay = habitsActiveOnDate(d, habitCreatedDates);
    const completedOnDay = dailyCompletionMap.get(key)?.size || 0;
    dayData.push({ key, activeOnDay, completedOnDay });
  }

  // Current streak (consecutive perfect days from today backwards).
  // BUG-13 fix: be lenient about TODAY — if today is not yet a perfect day
  // (user hasn't completed all habits yet), skip it and start counting from
  // yesterday. This matches `computeStreak` in daily-tracker.tsx, which also
  // allows today to be incomplete. Previously the dashboard would report
  // streak=0 the moment a single habit was unfinished today, even if the
  // user had a 30-day streak going into today.
  let currentStreak = 0;
  for (let i = 0; i < dayData.length; i++) {
    const day = dayData[i];
    if (day.activeOnDay === 0) continue; // no habits existed yet, skip
    if (day.completedOnDay >= day.activeOnDay) {
      currentStreak++;
    } else if (i === 0) {
      // Today is incomplete — lenient: skip today, streak continues from yesterday
      continue;
    } else {
      break;
    }
  }

  // Longest streak (scan all days, find longest run of perfect days)
  let longestStreak = 0;
  let tempStreak = 0;
  for (const day of dayData) {
    if (day.activeOnDay === 0) {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 0;
      continue;
    }
    if (day.completedOnDay >= day.activeOnDay) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  // ── Best and worst habit ─────────────────────────────────────────
  const habitStatsMap = new Map<string, { done: number; total: number; name: string; icon: string }>();
  for (const habit of habits) {
    const createdDay = startOfDay(habit.createdAt);
    const effectiveStart = createdDay > periodStart ? createdDay : periodStart;
    const totalDaysForHabit = Math.max(1, differenceInCalendarDays(today, effectiveStart) + 1);
    const hLogs = allLogs.filter(l => l.habitId === habit.id && l.completed);
    habitStatsMap.set(habit.id, {
      done: hLogs.length,
      total: totalDaysForHabit,
      name: habit.name,
      icon: habit.icon,
    });
  }

  let bestHabit: BestWorstHabit = { name: 'N/A', icon: '🏆', rate: 0 };
  let worstHabit: BestWorstHabit = { name: 'N/A', icon: '📉', rate: 100 };

  for (const [, stat] of habitStatsMap) {
    if (stat.total > 0) {
      const rate = Math.round((stat.done / stat.total) * 100);
      if (rate > bestHabit.rate) bestHabit = { name: stat.name, icon: stat.icon, rate };
      if (rate < worstHabit.rate) worstHabit = { name: stat.name, icon: stat.icon, rate };
    }
  }

  // ── XP calculation (within period) ───────────────────────────────
  const totalXP = allLogs.filter(l => l.completed).reduce((sum, l) => {
    return sum + (xpMap[l.habit.difficulty] || 20);
  }, 0);
  const currentLevel = calcLevel(totalXP);
  const nextLevelXP = calcNextLevelXP(currentLevel);
  const currentLevelXP = calcNextLevelXP(currentLevel - 1);
  const levelProgress = nextLevelXP > currentLevelXP
    ? Math.round(((totalXP - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100)
    : 100;

  // ── Goal progress ────────────────────────────────────────────────
  const goalProgress = activeGoals.length > 0
    ? Math.round(activeGoals.reduce((s, g) => s + g.progress, 0) / activeGoals.length)
    : 0;

  // ── Mood & sleep averages (last 30 days) ─────────────────────────
  const moodAverage = recentDailyLogs.length > 0
    ? (recentDailyLogs.reduce((s, l) => s + l.mood, 0) / recentDailyLogs.length).toFixed(1)
    : '3.0';
  const sleepAverage = recentDailyLogs.length > 0
    ? (recentDailyLogs.reduce((s, l) => s + l.sleep, 0) / recentDailyLogs.length).toFixed(1)
    : '7.0';

  // ── Productivity score ───────────────────────────────────────────
  const productivityScore = Math.round(
    (completionRate * 0.4 + successToday * 0.3 + weeklyCompletion * 0.3)
  );

  // ── Category performance (within period) ─────────────────────────
  const categoryStats = new Map<string, { done: number; totalPossible: number }>();
  for (const habit of habits) {
    const cat = habit.category || 'General';
    if (!categoryStats.has(cat)) categoryStats.set(cat, { done: 0, totalPossible: 0 });
    const catStat = categoryStats.get(cat)!;
    // Count days this habit existed in period
    const createdDay = startOfDay(habit.createdAt);
    const effectiveStart = createdDay > periodStart ? createdDay : periodStart;
    const daysForHabit = Math.max(0, differenceInCalendarDays(today, effectiveStart) + 1);
    catStat.totalPossible += daysForHabit;
    // Count completed logs for this habit in category
    const hCompleted = allLogs.filter(l => l.habitId === habit.id && l.completed).length;
    catStat.done += hCompleted;
  }
  const categoryPerformance = [...categoryStats.entries()].map(([cat, stat]) => ({
    category: cat,
    done: stat.done,
    total: stat.totalPossible,
    rate: stat.totalPossible > 0 ? Math.round((stat.done / stat.totalPossible) * 100) : 0,
  }));

  // ── Today's focus ────────────────────────────────────────────────
  const todayLogs = allLogs.filter(l => format(l.date, 'yyyy-MM-dd') === todayKey);
  const todayFocus = habits
    .filter(h => !todayLogs.some(l => l.habitId === h.id && l.completed))
    .slice(0, 5)
    .map(h => ({ id: h.id, name: h.name, icon: h.icon, priority: h.priority }));

  // ── Per-Habit Detail Stats ───────────────────────────────────────
  const habitDetailStats = habits.map(h => {
    const createdDay = startOfDay(h.createdAt);
    const effectiveStart = createdDay > periodStart ? createdDay : periodStart;
    const total = Math.max(1, differenceInCalendarDays(today, effectiveStart) + 1);
    const completed = allLogs.filter(l => l.habitId === h.id && l.completed).length;
    const rate = Math.round((completed / total) * 100);

    // Habit-level streak
    let hStreak = 0;
    const completedHL = allLogs
      .filter(l => l.habitId === h.id && l.completed)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    if (completedHL.length > 0) {
      hStreak = 1;
      for (let i = 1; i < completedHL.length; i++) {
        const diff = Math.round((completedHL[i - 1].date.getTime() - completedHL[i].date.getTime()) / 86400000);
        if (diff === 1) { hStreak++; } else break;
      }
    }

    return {
      id: h.id,
      name: h.name,
      icon: h.icon,
      color: h.color,
      category: h.category,
      completed,
      total,
      rate,
      streak: hStreak,
    };
  }).sort((a, b) => b.rate - a.rate);

  return {
    completionRate,
    currentStreak,
    longestStreak,
    successToday,
    weeklyCompletion,
    monthlyCompletion,
    bestHabit,
    worstHabit,
    totalXP,
    currentLevel,
    nextLevelXP,
    currentLevelXP,
    levelProgress,
    goalProgress,
    moodAverage,
    sleepAverage,
    productivityScore,
    categoryPerformance,
    todayFocus,
    habitDetailStats,
  };
}
