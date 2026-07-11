import { db } from '@/lib/db';
import { ensureTimeTrackingColumns } from '@/lib/ensure-columns';
import { NextRequest, NextResponse } from 'next/server';
import {
  startOfDay, subDays, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, format, differenceInCalendarDays,
} from 'date-fns';

// ── Jakarta timezone helpers (UTC+7) ───────────────────────────────────

function calcLevel(totalXP: number): number {
  return Math.floor(Math.sqrt(totalXP / 100)) + 1;
}

function calcNextLevelXP(level: number): number {
  return (level * level) * 100;
}

// ── Jakarta timezone helpers (UTC+7) ───────────────────────────────────
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function jakartaNow(): Date {
  return new Date(Date.now() + JAKARTA_OFFSET_MS);
}

function jakartaToday(): Date {
  const now = jakartaNow();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

type Period = '7d' | '1m' | '3m' | '6m' | '1y' | 'all';

function getPeriodDays(period: Period): number {
  switch (period) {
    case '7d': return 7;
    case '1m': return 30;
    case '3m': return 90;
    case '6m': return 180;
    case '1y': return 365;
    case 'all': return 365; // default, overridden below
    default: return 365;
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureTimeTrackingColumns();
    const { searchParams } = new URL(request.url);
    const period: Period = (searchParams.get('period') as Period) || 'all';

    // Use Jakarta timezone
    const today = jakartaToday();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    // Build XP map from database (graceful fallback if HabitOption table doesn't exist)
    const xpMap: Record<string, number> = {};
    try {
      const diffOptions = await db.habitOption.findMany({ where: { type: 'difficulty' } });
      diffOptions.forEach(d => { xpMap[d.name] = d.xp; });
    } catch {
      // HabitOption table may not exist yet — use default XP values
      xpMap['Easy'] = 10;
      xpMap['Medium'] = 20;
      xpMap['Hard'] = 40;
    }

    // Fetch all active habits (with createdAt for smart day counting)
    const habits = await db.habit.findMany({
      where: { status: 'active' },
    });

    const totalHabits = habits.length;

    // Pre-sort habit creation dates for O(log n) binary search lookups
    const habitCreatedDates = habits
      .map(h => startOfDay(h.createdAt).getTime())
      .sort((a, b) => a - b);

    // ── Determine period start date ──────────────────────────────────
    let periodStart: Date;
    if (period === 'all') {
      if (habits.length > 0) {
        const earliest = new Date(Math.min(...habits.map(h => h.createdAt.getTime())));
        periodStart = startOfDay(earliest);
      } else {
        periodStart = subDays(today, 30);
      }
    } else {
      const days = getPeriodDays(period);
      periodStart = subDays(today, days);
    }

    const periodDays = differenceInCalendarDays(today, periodStart) + 1; // inclusive

    // Determine chart days for display
    const chartDays = period === '7d' ? 7 : period === '1m' ? 30 : period === '3m' ? 90 : period === '6m' ? 180 : period === '1y' ? 365 : periodDays;

    // ── Fetch all logs in the period (only for active habits) ────────
    const activeHabitIds = new Set(habits.map(h => h.id));
    const allLogs = (await db.habitLog.findMany({
      where: { date: { gte: periodStart, lte: today } },
      include: { habit: true },
    })).filter(l => activeHabitIds.has(l.habitId));

    // Build a map: "habitId|dateStr" -> log
    const logMap = new Map<string, { completed: boolean; habitId: string }>();
    const dailyCompletionMap = new Map<string, Set<string>>(); // dateStr -> Set of habitIds completed
    const dailyLogMap = new Map<string, Set<string>>(); // dateStr -> Set of habitIds that have any log

    for (const log of allLogs) {
      const dateStr = format(log.date, 'yyyy-MM-dd');
      const key = `${log.habitId}|${dateStr}`;
      logMap.set(key, { completed: log.completed, habitId: log.habitId });

      if (!dailyCompletionMap.has(dateStr)) dailyCompletionMap.set(dateStr, new Set());
      if (!dailyLogMap.has(dateStr)) dailyLogMap.set(dateStr, new Set());
      dailyLogMap.get(dateStr)!.add(log.habitId);
      if (log.completed) {
        dailyCompletionMap.get(dateStr)!.add(log.habitId);
      }
    }

    // ── Helper: count habits active on a given date (O(log n) via binary search) ──
    function habitsActiveOnDate(date: Date): number {
      const ts = startOfDay(date).getTime();
      // Find rightmost index where createdDate <= ts
      let lo = 0, hi = habitCreatedDates.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (habitCreatedDates[mid] <= ts) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    }

    // ── Helper: count theoretical possible completions for a date range ──
    // Sum over each day: number of habits that existed on that day
    function theoreticalMaxInRange(start: Date, end: Date): number {
      const days = differenceInCalendarDays(end, start) + 1;
      let total = 0;
      for (let i = 0; i < days; i++) {
        const d = subDays(end, i);
        total += habitsActiveOnDate(d);
      }
      return total;
    }

    // ── Overall period completion rate ───────────────────────────────
    const totalCompletedInPeriod = allLogs.filter(l => l.completed).length;
    const theoreticalMaxPeriod = theoreticalMaxInRange(periodStart, today);
    const completionRate = theoreticalMaxPeriod > 0
      ? Math.round((totalCompletedInPeriod / theoreticalMaxPeriod) * 100)
      : 0;

    // ── Today's success rate ─────────────────────────────────────────
    const todayKey = format(today, 'yyyy-MM-dd');
    const todayCompleted = dailyCompletionMap.get(todayKey)?.size || 0;
    const todayActiveHabits = habitsActiveOnDate(today);
    const successToday = todayActiveHabits > 0
      ? Math.round((todayCompleted / todayActiveHabits) * 100)
      : 0;

    // ── Weekly completion ────────────────────────────────────────────
    const weekCompleted = allLogs.filter(l => {
      const d = l.date;
      return d >= weekStart && d <= weekEnd && l.completed;
    }).length;
    const theoreticalMaxWeek = theoreticalMaxInRange(weekStart, weekEnd);
    const weeklyCompletion = theoreticalMaxWeek > 0
      ? Math.round((weekCompleted / theoreticalMaxWeek) * 100)
      : 0;

    // ── Monthly completion ───────────────────────────────────────────
    const monthCompleted = allLogs.filter(l => {
      const d = l.date;
      return d >= monthStart && d <= monthEnd && l.completed;
    }).length;
    const theoreticalMaxMonth = theoreticalMaxInRange(monthStart, monthEnd);
    const monthlyCompletion = theoreticalMaxMonth > 0
      ? Math.round((monthCompleted / theoreticalMaxMonth) * 100)
      : 0;

    // ── Streak calculation ───────────────────────────────────────────
    // A "perfect day" = all habits that existed on that day were completed
    let currentStreak = 0;
    const maxStreakCheck = Math.min(periodDays, 365);

    for (let i = 0; i < maxStreakCheck; i++) {
      const d = subDays(today, i);
      const key = format(d, 'yyyy-MM-dd');
      const activeOnDay = habitsActiveOnDate(d);
      if (activeOnDay === 0) continue; // no habits existed yet, skip
      const completedOnDay = dailyCompletionMap.get(key)?.size || 0;
      if (completedOnDay >= activeOnDay) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    for (let i = 0; i < maxStreakCheck; i++) {
      const d = subDays(today, i);
      const key = format(d, 'yyyy-MM-dd');
      const activeOnDay = habitsActiveOnDate(d);
      if (activeOnDay === 0) {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 0;
        continue;
      }
      const completedOnDay = dailyCompletionMap.get(key)?.size || 0;
      if (completedOnDay >= activeOnDay) {
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

    let bestHabit = { name: 'N/A', icon: '🏆', rate: 0 };
    let worstHabit = { name: 'N/A', icon: '📉', rate: 100 };

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

    // ── Badges ───────────────────────────────────────────────────────
    const unlockedBadges = await db.badge.count({ where: { unlocked: true } });
    const totalBadges = await db.badge.count();

    // ── Challenge progress ───────────────────────────────────────────
    const activeChallenges = await db.challenge.findMany({ where: { status: 'active' } });
    const challengeProgress = activeChallenges.length > 0
      ? Math.round(activeChallenges.reduce((s, c) => s + c.progress, 0) / activeChallenges.length)
      : 0;

    // ── Goal progress ────────────────────────────────────────────────
    const activeGoals = await db.goal.findMany({ where: { status: 'active' } });
    const goalProgress = activeGoals.length > 0
      ? Math.round(activeGoals.reduce((s, g) => s + g.progress, 0) / activeGoals.length)
      : 0;

    // ── Mood & sleep averages (last 30 days) ─────────────────────────
    const recentDailyLogs = await db.dailyLog.findMany({
      where: { date: { gte: subDays(today, 30) } },
    });
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

    // ── Weekly chart data (last 7 days) ──────────────────────────────
    const weeklyChartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      const key = format(d, 'yyyy-MM-dd');
      const activeOnDay = habitsActiveOnDate(d);
      const done = dailyCompletionMap.get(key)?.size || 0;
      const rate = activeOnDay > 0 ? Math.round((done / activeOnDay) * 100) : 0;
      weeklyChartData.push({
        day: format(d, 'EEE'),
        date: format(d, 'MMM dd'),
        completed: done,
        total: activeOnDay,
        rate,
      });
    }

    // ── Monthly/period chart data ────────────────────────────────────
    const monthlyChartData = [];
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = subDays(today, i);
      const key = format(d, 'yyyy-MM-dd');
      const activeOnDay = habitsActiveOnDate(d);
      const done = dailyCompletionMap.get(key)?.size || 0;
      const rate = activeOnDay > 0 ? Math.round((done / activeOnDay) * 100) : 0;
      monthlyChartData.push({
        day: format(d, 'MMM dd'),
        completed: done,
        total: activeOnDay,
        rate,
      });
    }

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

    // ── Daily Learning Status ────────────────────────────────────────
    const learningHabit = await db.habit.findFirst({ where: { name: 'Daily Learning' } });
    let learningStatus = { completedToday: false, streak: 0, longestStreak: 0, totalDays: 0 };
    if (learningHabit) {
      const learningLogs = await db.habitLog.findMany({
        where: { habitId: learningHabit.id, completed: true },
        orderBy: { date: 'asc' },
      });
      const learningTodayLog = learningLogs.find(l => format(l.date, 'yyyy-MM-dd') === todayKey);
      learningStatus.completedToday = !!learningTodayLog;
      learningStatus.totalDays = learningLogs.length;

      // Build a Set for O(1) lookups
      const learningDateSet = new Set(learningLogs.map(l => format(l.date, 'yyyy-MM-dd')));

      // Current streak
      if (learningTodayLog) {
        learningStatus.streak = 1;
        for (let i = 1; i <= 365; i++) {
          const d = subDays(today, i);
          if (learningDateSet.has(format(d, 'yyyy-MM-dd'))) {
            learningStatus.streak++;
          } else break;
        }
      } else {
        for (let i = 1; i <= 365; i++) {
          const d = subDays(today, i);
          if (learningDateSet.has(format(d, 'yyyy-MM-dd'))) {
            learningStatus.streak++;
          } else break;
        }
      }

      // Longest streak
      let tempStreak = 0;
      for (let i = 0; i < learningLogs.length; i++) {
        if (i === 0) { tempStreak = 1; }
        else {
          const diff = Math.round((learningLogs[i].date.getTime() - learningLogs[i - 1].date.getTime()) / 86400000);
          if (diff === 1) { tempStreak++; } else { learningStatus.longestStreak = Math.max(learningStatus.longestStreak, tempStreak); tempStreak = 1; }
        }
      }
      learningStatus.longestStreak = Math.max(learningStatus.longestStreak, tempStreak);
    }

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

      return { id: h.id, name: h.name, icon: h.icon, color: h.color, category: h.category, completed, total, rate, streak: hStreak };
    }).sort((a, b) => b.rate - a.rate);

    // ── Stacked Bar Data: completed vs missed per day ────────────────
    const stackedBarData = [];
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = subDays(today, i);
      const key = format(d, 'yyyy-MM-dd');
      const activeOnDay = habitsActiveOnDate(d);
      const done = dailyCompletionMap.get(key)?.size || 0;
      const missed = Math.max(0, activeOnDay - done);
      const rate = activeOnDay > 0 ? Math.round((done / activeOnDay) * 100) : 0;
      stackedBarData.push({
        day: period === '7d' ? format(d, 'EEE') : format(d, 'MMM dd'),
        completed: done,
        missed,
        total: activeOnDay,
        rate,
      });
    }

    // ── Weekly Pattern (day-of-week) ─────────────────────────────────
    // For each day of week, calculate: total completed / total possible
    // over the last 30 days
    const dayOfWeekStats: Record<string, { completed: number; possible: number }> = {};
    for (let i = 30; i >= 0; i--) {
      const d = subDays(today, i);
      const key = format(d, 'yyyy-MM-dd');
      const dayName = format(d, 'EEEE');
      if (!dayOfWeekStats[dayName]) dayOfWeekStats[dayName] = { completed: 0, possible: 0 };
      const activeOnDay = habitsActiveOnDate(d);
      const doneOnDay = dailyCompletionMap.get(key)?.size || 0;
      dayOfWeekStats[dayName].completed += doneOnDay;
      dayOfWeekStats[dayName].possible += activeOnDay;
    }
    const weeklyPattern = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
      const s = dayOfWeekStats[day] || { completed: 0, possible: 0 };
      // Count how many instances of this day in the last 31 days
      let instances = 0;
      for (let i = 30; i >= 0; i--) {
        const d = subDays(today, i);
        if (format(d, 'EEEE') === day) instances++;
      }
      return {
        day: day.substring(0, 3),
        fullDay: day,
        rate: s.possible > 0 ? Math.round((s.completed / s.possible) * 100) : 0,
        avgCompleted: instances > 0 ? (s.completed / instances).toFixed(1) : '0',
      };
    });

    // ── Finance Overview (current month) ─────────────────────────────
    let financeOverview = {
      totalIncome: 0,
      totalExpense: 0,
      netBalance: 0,
      transactionCount: 0,
      budgetWarning: 0,  // >80% used
      budgetExceeded: 0, // >100% used
    };

    try {
      const monthTransactions = await db.transaction.findMany({
        where: {
          date: { gte: monthStart, lte: monthEnd },
        },
      });

      financeOverview.totalIncome = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      financeOverview.totalExpense = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      financeOverview.netBalance = financeOverview.totalIncome - financeOverview.totalExpense;
      financeOverview.transactionCount = monthTransactions.length;

      // Budget status
      const budgets = await db.budget.findMany();
      const monthExpensesByCategory = new Map<string, number>();
      for (const t of monthTransactions) {
        if (t.type === 'expense') {
          monthExpensesByCategory.set(
            t.category,
            (monthExpensesByCategory.get(t.category) || 0) + t.amount,
          );
        }
      }
      for (const budget of budgets) {
        const spent = monthExpensesByCategory.get(budget.category) || 0;
        const usage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
        if (usage > 100) financeOverview.budgetExceeded++;
        else if (usage > 80) financeOverview.budgetWarning++;
      }
    } catch {
      // Finance tables might not exist; silently ignore
    }

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
      // Detailed data
      learningStatus,
      habitDetailStats,
      stackedBarData,
      weeklyPattern,
      // Finance
      financeOverview,
    });
  } catch (error) {
    console.error('GET /api/dashboard error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 });
  }
}