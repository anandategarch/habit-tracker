import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import {
  startOfDay, subDays, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, format, differenceInDays,
} from 'date-fns';

// XP values by difficulty
const XP_MAP: Record<string, number> = { Easy: 10, Medium: 20, Hard: 30, Expert: 50 };

function calcLevel(totalXP: number): number {
  return Math.floor(Math.sqrt(totalXP / 100)) + 1;
}

function calcNextLevelXP(level: number): number {
  return (level * level) * 100;
}

type Period = '7d' | '1m' | '3m' | 'all';

function getStartDate(period: Period, today: Date): Date | null {
  switch (period) {
    case '7d': return subDays(today, 7);
    case '1m': return subDays(today, 30);
    case '3m': return subDays(today, 90);
    case 'all': return null; // no filter
    default: return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period: Period = (searchParams.get('period') as Period) || 'all';

    const now = new Date();
    const today = startOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Period-based start date for log filtering
    const periodStart = getStartDate(period, today);

    // Determine how many days to fetch (for chart data)
    const chartDays = period === '7d' ? 7 : period === '1m' ? 30 : period === '3m' ? 90 : 30;

    // Fetch all active habits
    const habits = await db.habit.findMany({
      where: { status: 'active' },
    });

    const totalHabits = habits.length;

    // Fetch logs with optional period filter
    const logWhere: any = {};
    if (periodStart) {
      logWhere.date = { gte: periodStart };
    } else {
      logWhere.date = { gte: subDays(today, 365) };
    }

    const allLogs = await db.habitLog.findMany({
      where: logWhere,
      include: { habit: true },
    });

    const todayLogs = allLogs.filter(l => format(l.date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'));
    const weekLogs = allLogs.filter(l => l.date >= weekStart && l.date <= weekEnd);
    const monthLogs = allLogs.filter(l => l.date >= monthStart && l.date <= monthEnd);

    // Calculate totals (within period)
    const totalCompleted = allLogs.filter(l => l.completed).length;
    const totalPossible = allLogs.length;
    const completionRate = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

    // Today's success
    const todayCompleted = todayLogs.filter(l => l.completed).length;
    const successToday = totalHabits > 0 ? Math.round((todayCompleted / totalHabits) * 100) : 0;

    // Weekly completion
    const weekCompleted = weekLogs.filter(l => l.completed).length;
    const weeklyCompletion = weekLogs.length > 0 ? Math.round((weekCompleted / weekLogs.length) * 100) : 0;

    // Monthly completion
    const monthCompleted = monthLogs.filter(l => l.completed).length;
    const monthlyCompletion = monthLogs.length > 0 ? Math.round((monthCompleted / monthLogs.length) * 100) : 0;

    // Streak calculation (within the period)
    const dailyCompletionMap = new Map<string, number>();
    const dailyTotalMap = new Map<string, number>();

    for (const log of allLogs) {
      const day = format(log.date, 'yyyy-MM-dd');
      dailyTotalMap.set(day, (dailyTotalMap.get(day) || 0) + 1);
      if (log.completed) {
        dailyCompletionMap.set(day, (dailyCompletionMap.get(day) || 0) + 1);
      }
    }

    // Current streak
    let currentStreak = 0;
    let checkDate = today;
    const todayKey = format(checkDate, 'yyyy-MM-dd');
    const todayTotal = dailyTotalMap.get(todayKey) || 0;
    const todayDone = dailyCompletionMap.get(todayKey) || 0;

    if (todayTotal > 0 && todayDone === todayTotal) {
      currentStreak = 1;
    } else {
      checkDate = subDays(checkDate, 1);
      const yKey = format(checkDate, 'yyyy-MM-dd');
      if (dailyTotalMap.get(yKey) !== dailyCompletionMap.get(yKey)) {
        currentStreak = 0;
      }
    }

    const maxStreakCheck = periodStart ? differenceInDays(today, periodStart) : 365;
    for (let i = currentStreak === 0 ? 1 : 1; i < maxStreakCheck; i++) {
      const d = subDays(today, i);
      const key = format(d, 'yyyy-MM-dd');
      const total = dailyTotalMap.get(key) || 0;
      const done = dailyCompletionMap.get(key) || 0;
      if (total > 0 && done === total) {
        currentStreak++;
      } else if (total > 0) {
        break;
      }
    }

    // Longest streak (within period)
    let longestStreak = 0;
    let tempStreak = 0;
    const allDates = [...new Set(allLogs.map(l => format(l.date, 'yyyy-MM-dd')))].sort();
    for (const dateStr of allDates) {
      const total = dailyTotalMap.get(dateStr) || 0;
      const done = dailyCompletionMap.get(dateStr) || 0;
      if (total > 0 && done === total) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else if (total > 0) {
        tempStreak = 0;
      }
    }

    // Best and worst habit (within period)
    const habitStats = new Map<string, { done: number; total: number; name: string; icon: string }>();
    for (const habit of habits) {
      habitStats.set(habit.id, { done: 0, total: 0, name: habit.name, icon: habit.icon });
    }
    for (const log of allLogs) {
      const stat = habitStats.get(log.habitId);
      if (stat) {
        stat.total++;
        if (log.completed) stat.done++;
      }
    }

    let bestHabit = { name: 'N/A', icon: '🏆', rate: 0 };
    let worstHabit = { name: 'N/A', icon: '📉', rate: 100 };

    for (const [, stat] of habitStats) {
      if (stat.total > 0) {
        const rate = Math.round((stat.done / stat.total) * 100);
        if (rate > bestHabit.rate) bestHabit = { name: stat.name, icon: stat.icon, rate };
        if (rate < worstHabit.rate) worstHabit = { name: stat.name, icon: stat.icon, rate };
      }
    }

    // XP calculation (within period)
    const totalXP = allLogs.filter(l => l.completed).reduce((sum, l) => {
      return sum + (XP_MAP[l.habit.difficulty] || 20);
    }, 0);
    const currentLevel = calcLevel(totalXP);
    const nextLevelXP = calcNextLevelXP(currentLevel);
    const currentLevelXP = calcNextLevelXP(currentLevel - 1);
    const levelProgress = nextLevelXP > currentLevelXP
      ? Math.round(((totalXP - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100)
      : 100;

    // Badges
    const unlockedBadges = await db.badge.count({ where: { unlocked: true } });
    const totalBadges = await db.badge.count();

    // Challenge progress
    const activeChallenges = await db.challenge.findMany({ where: { status: 'active' } });
    const challengeProgress = activeChallenges.length > 0
      ? Math.round(activeChallenges.reduce((s, c) => s + c.progress, 0) / activeChallenges.length)
      : 0;

    // Goal progress
    const activeGoals = await db.goal.findMany({ where: { status: 'active' } });
    const goalProgress = activeGoals.length > 0
      ? Math.round(activeGoals.reduce((s, g) => s + g.progress, 0) / activeGoals.length)
      : 0;

    // Mood & sleep averages (last 30 days, always 30 regardless of period)
    const recentDailyLogs = await db.dailyLog.findMany({
      where: { date: { gte: subDays(today, 30) } },
    });
    const moodAverage = recentDailyLogs.length > 0
      ? (recentDailyLogs.reduce((s, l) => s + l.mood, 0) / recentDailyLogs.length).toFixed(1)
      : '3.0';
    const sleepAverage = recentDailyLogs.length > 0
      ? (recentDailyLogs.reduce((s, l) => s + l.sleep, 0) / recentDailyLogs.length).toFixed(1)
      : '7.0';

    // Productivity score (weighted average of completion metrics)
    const productivityScore = Math.round(
      (completionRate * 0.4 + successToday * 0.3 + weeklyCompletion * 0.3)
    );

    // Weekly chart data (last 7 days)
    const weeklyChartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      const key = format(d, 'yyyy-MM-dd');
      const total = dailyTotalMap.get(key) || 0;
      const done = dailyCompletionMap.get(key) || 0;
      weeklyChartData.push({
        day: format(d, 'EEE'),
        date: format(d, 'MMM dd'),
        completed: done,
        total,
        rate: total > 0 ? Math.round((done / total) * 100) : 0,
      });
    }

    // Monthly chart data (adjustable by period)
    const monthlyChartData = [];
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = subDays(today, i);
      const key = format(d, 'yyyy-MM-dd');
      const total = dailyTotalMap.get(key) || 0;
      const done = dailyCompletionMap.get(key) || 0;
      monthlyChartData.push({
        day: format(d, 'MMM dd'),
        completed: done,
        total,
        rate: total > 0 ? Math.round((done / total) * 100) : 0,
      });
    }

    // Category performance (within period)
    const categoryStats = new Map<string, { done: number; total: number }>();
    for (const log of allLogs) {
      const cat = log.habit.category || 'General';
      if (!categoryStats.has(cat)) categoryStats.set(cat, { done: 0, total: 0 });
      const stat = categoryStats.get(cat)!;
      stat.total++;
      if (log.completed) stat.done++;
    }
    const categoryPerformance = [...categoryStats.entries()].map(([cat, stat]) => ({
      category: cat,
      ...stat,
      rate: stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0,
    }));

    // Today's focus - habits not yet completed today
    const todayFocus = habits
      .filter(h => !todayLogs.some(l => l.habitId === h.id && l.completed))
      .slice(0, 5)
      .map(h => ({ id: h.id, name: h.name, icon: h.icon, priority: h.priority }));

    return NextResponse.json({
      totalHabits,
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
      unlockedBadges,
      totalBadges,
      challengeProgress,
      goalProgress,
      moodAverage,
      sleepAverage,
      productivityScore,
      weeklyChartData,
      monthlyChartData,
      categoryPerformance,
      todayFocus,
      period,
    });
  } catch (error) {
    console.error('GET /api/dashboard error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 });
  }
}