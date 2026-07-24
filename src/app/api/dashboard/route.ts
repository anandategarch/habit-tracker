import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import {
  startOfDay, subDays, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, format, differenceInCalendarDays,
} from 'date-fns';

// ── Helper: wrap a promise with a fallback value if it rejects ──────────
// Used to parallelize queries that may fail (e.g. table doesn't exist yet)
// without one failure aborting the entire Promise.all batch.
async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

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

    // Fetch all active habits (resilient — won't crash on schema mismatch)
    let habits: Awaited<ReturnType<typeof db.habit.findMany>> = [];
    try {
      habits = await db.habit.findMany({ where: { status: 'active' } });
    } catch (e) { console.error('Dashboard: habits query failed:', e); }

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

    // Determine chart days for display.
    // Cap at 365 to prevent unbounded loops when period='all' and user has
    // years of data (could otherwise loop thousands of times).
    const chartDays = Math.min(
      period === '7d' ? 7 : period === '1m' ? 30 : period === '3m' ? 90 : period === '6m' ? 180 : period === '1y' ? 365 : periodDays,
      365
    );

    // ── Fetch all logs in the period (only for active habits) ────────
    const activeHabitIds = new Set(habits.map(h => h.id));
    let allLogs: Awaited<ReturnType<typeof db.habitLog.findMany<{ include: { habit: true } }>>> = [];
    try {
      allLogs = (await db.habitLog.findMany({
        where: { date: { gte: periodStart, lte: today } },
        include: { habit: true },
      })).filter(l => activeHabitIds.has(l.habitId));
    } catch (e) { console.error('Dashboard: habitLogs query failed:', e); }

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
    // Pre-compute date keys & active counts for all days in the streak range
    // to avoid redundant subDays() + format() + habitsActiveOnDate() calls
    // (previously called 2x per day in two separate loops = 730+ calls for 365 days).
    let currentStreak = 0;
    const maxStreakCheck = Math.min(periodDays, 365);

    // Pre-compute once: [{ key, activeOnDay, completedOnDay }] for each day
    const dayData: { key: string; activeOnDay: number; completedOnDay: number }[] = [];
    for (let i = 0; i < maxStreakCheck; i++) {
      const d = subDays(today, i);
      const key = format(d, 'yyyy-MM-dd');
      const activeOnDay = habitsActiveOnDate(d);
      const completedOnDay = dailyCompletionMap.get(key)?.size || 0;
      dayData.push({ key, activeOnDay, completedOnDay });
    }

    // Current streak (consecutive perfect days from today backwards)
    for (const day of dayData) {
      if (day.activeOnDay === 0) continue; // no habits existed yet, skip
      if (day.completedOnDay >= day.activeOnDay) {
        currentStreak++;
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

    // ── Parallel fetch: badges, challenges, goals, dailyLogs, learningHabit ──
    // These 6 queries are independent of each other and of `habits`/`allLogs`.
    // Running them in parallel via Promise.all cuts wait time from sum() to max().
    const [
      unlockedBadgesCount,
      totalBadgesCount,
      activeChallenges,
      activeGoals,
      recentDailyLogs,
      learningHabit,
    ] = await Promise.all([
      safe(db.badge.count({ where: { unlocked: true } }), 0),
      safe(db.badge.count(), 0),
      safe(db.challenge.findMany({ where: { status: 'active' } }), []),
      safe(db.goal.findMany({ where: { status: 'active' } }), []),
      safe(db.dailyLog.findMany({ where: { date: { gte: subDays(today, 30) } } }), []),
      safe(db.habit.findFirst({ where: { name: 'Daily Learning' } }), null),
    ]);

    // ── Badges ───────────────────────────────────────────────────────
    const unlockedBadges = unlockedBadgesCount;
    const totalBadges = totalBadgesCount;

    // ── Challenge progress ───────────────────────────────────────────
    const challengeProgress = activeChallenges.length > 0
      ? Math.round(activeChallenges.reduce((s, c) => s + c.progress, 0) / activeChallenges.length)
      : 0;

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

    // ── Weekly chart data (last 7 days) ──────────────────────────────
    const weeklyChartData: { day: string; date: string; completed: number; total: number; rate: number }[] = [];
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
    const monthlyChartData: { day: string; completed: number; total: number; rate: number }[] = [];
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
    // (learningHabit already fetched in the parallel batch above)
    let learningStatus = { completedToday: false, streak: 0, longestStreak: 0, totalDays: 0 };
    if (learningHabit) {
      let learningLogs: Awaited<ReturnType<typeof db.habitLog.findMany>> = [];
      try {
        learningLogs = await db.habitLog.findMany({
          where: { habitId: learningHabit.id, completed: true },
          orderBy: { date: 'asc' },
        });
      } catch (e) { console.error('Dashboard: learningLogs query failed:', e); }
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
    const stackedBarData: { day: string; completed: number; missed: number; total: number; rate: number }[] = [];
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
      // Parallel fetch: monthTransactions + budgets (wrapped in safe for resilience)
      const [monthTransactions, budgets] = await Promise.all([
        safe(db.transaction.findMany({
          where: { date: { gte: monthStart, lte: monthEnd } },
        }), []),
        safe(db.budget.findMany(), []),
      ]);

      financeOverview.totalIncome = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      financeOverview.totalExpense = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      financeOverview.netBalance = financeOverview.totalIncome - financeOverview.totalExpense;
      financeOverview.transactionCount = monthTransactions.length;

      // Budget status
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

    // ── Time-Tracked Habits Summary (this week) ──────────────────────
    interface TimeHabitSummary {
      id: string;
      name: string;
      icon: string;
      color: string;
      targetTime: string | null;
      todayTime: string | null;       // "HH:mm" if completed today
      todayDone: boolean;
      weekAvg: string | null;         // "HH:mm" average this week
      weekOnTarget: number;           // count on-target this week
      weekTotal: number;              // count with time this week
      weekOnTargetRate: number;       // percentage
      prevAvg: string | null;         // "HH:mm" average last week
      trend: number | null;           // minutes diff (negative = improving/earlier)
      weekTimes: { day: string; time: string | null; minutes: number | null }[];
    }

    const timeHabits = habits.filter(h => h.trackTime);
    const timeTrackedSummary: TimeHabitSummary[] = [];

    // Extract local time in minutes from ISO string, converting to Jakarta (UTC+7)
    function toMinutesFromISO(isoStr: string): number {
      const d = new Date(isoStr);
      const jakarta = new Date(d.getTime() + JAKARTA_OFFSET_MS);
      return jakarta.getUTCHours() * 60 + jakarta.getUTCMinutes();
    }
    function minutesToHHmm(mins: number): string {
      const h = Math.floor(mins / 60) % 24;
      const mn = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
    }

    // Bulk-fetch all time-tracked logs (this week + last week) in one query
    const timeHabitIds = timeHabits.map(h => h.id);
    let allTimeLogs: Awaited<ReturnType<typeof db.habitLog.findMany>> = [];
    try {
      allTimeLogs = timeHabitIds.length > 0
        ? await db.habitLog.findMany({
            where: {
              habitId: { in: timeHabitIds },
              completed: true,
              completedAt: { not: null },
              date: { gte: subDays(weekStart, 7), lte: weekEnd },
            },
            orderBy: { date: 'asc' },
          })
        : [];
    } catch (e) { console.error('Dashboard: timeLogs query failed:', e); }

    // Group by habitId
    const timeLogsByHabit = new Map<string, typeof allTimeLogs>();
    for (const log of allTimeLogs) {
      if (!timeLogsByHabit.has(log.habitId)) timeLogsByHabit.set(log.habitId, []);
      timeLogsByHabit.get(log.habitId)!.push(log);
    }

    for (const habit of timeHabits) {
      const targetMins = habit.targetTime
        ? (() => { const [h, m] = habit.targetTime!.split(':').map(Number); return h * 60 + m; })()
        : null;

      const habitTimeLogs = timeLogsByHabit.get(habit.id) || [];
      const weekLogs = habitTimeLogs.filter(l => l.date >= weekStart && l.date <= weekEnd);
      const prevWeekLogs = habitTimeLogs.filter(l => l.date >= subDays(weekStart, 7) && l.date <= subDays(weekStart, 1));

      // Today's time
      const todayLog = weekLogs.find(l => format(l.date, 'yyyy-MM-dd') === todayKey);
      const todayTime = todayLog?.completedAt ? minutesToHHmm(toMinutesFromISO(todayLog.completedAt)) : null;

      // This week average
      const weekMins = weekLogs.map(l => l.completedAt ? toMinutesFromISO(l.completedAt) : null).filter((m): m is number => m !== null);
      const weekAvg = weekMins.length > 0 ? minutesToHHmm(Math.round(weekMins.reduce((a, b) => a + b, 0) / weekMins.length)) : null;

      // On-target count
      const weekOnTarget = targetMins !== null
        ? weekMins.filter(m => m <= targetMins).length
        : 0;

      // Previous week average
      const prevMins = prevWeekLogs.map(l => l.completedAt ? toMinutesFromISO(l.completedAt) : null).filter((m): m is number => m !== null);
      const prevAvg = prevMins.length > 0 ? minutesToHHmm(Math.round(prevMins.reduce((a, b) => a + b, 0) / prevMins.length)) : null;

      // Trend (minutes diff)
      const currentAvgMins = weekMins.length > 0 ? Math.round(weekMins.reduce((a, b) => a + b, 0) / weekMins.length) : null;
      const prevAvgMins = prevMins.length > 0 ? Math.round(prevMins.reduce((a, b) => a + b, 0) / prevMins.length) : null;
      const trend = currentAvgMins !== null && prevAvgMins !== null ? currentAvgMins - prevAvgMins : null;

      // Per-day times for mini chart
      const weekTimes: { day: string; time: string | null; minutes: number | null }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = subDays(today, i);
        const key = format(d, 'yyyy-MM-dd');
        const log = weekLogs.find(l => format(l.date, 'yyyy-MM-dd') === key);
        if (log?.completedAt) {
          const mins = toMinutesFromISO(log.completedAt);
          weekTimes.push({ day: format(d, 'EEE'), time: minutesToHHmm(mins), minutes: mins });
        } else {
          weekTimes.push({ day: format(d, 'EEE'), time: null, minutes: null });
        }
      }

      timeTrackedSummary.push({
        id: habit.id,
        name: habit.name,
        icon: habit.icon,
        color: habit.color,
        targetTime: habit.targetTime,
        todayTime,
        todayDone: !!todayLog,
        weekAvg,
        weekOnTarget,
        weekTotal: weekMins.length,
        weekOnTargetRate: weekMins.length > 0 && targetMins !== null
          ? Math.round((weekOnTarget / weekMins.length) * 100)
          : 0,
        prevAvg,
        trend,
        weekTimes,
      });
    }

    // ── Last Done (habits with trackLastDone) ────────────────────────
    const lastDoneHabits = habits.filter(h => h.trackLastDone);
    const lastDoneSummary: {
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
    }[] = [];

    function intervalToDays(interval: string | null): number {
      if (!interval) return 0;
      const match = interval.match(/^(\d+)(d|w)$/);
      if (!match) return 0;
      const val = parseInt(match[1], 10);
      return match[2] === 'w' ? val * 7 : val;
    }

    // Bulk-fetch latest completed log for each last-done habit
    const lastDoneIds = lastDoneHabits.map(h => h.id);
    let latestLogs: Awaited<ReturnType<typeof db.habitLog.findMany>> = [];
    try {
      latestLogs = lastDoneIds.length > 0
        ? await db.habitLog.findMany({
            where: { habitId: { in: lastDoneIds }, completed: true },
            distinct: ['habitId'],
            orderBy: { date: 'desc' },
          })
        : [];
    } catch (e) { console.error('Dashboard: latestLogs query failed:', e); }
    const latestLogMap = new Map(latestLogs.map(l => [l.habitId, l]));

    for (const habit of lastDoneHabits) {
      const latestLog = latestLogMap.get(habit.id) || null;
      const intervalDays = intervalToDays(habit.lastDoneInterval);

      if (!latestLog) {
        lastDoneSummary.push({
          id: habit.id,
          name: habit.name,
          icon: habit.icon,
          color: habit.color,
          interval: habit.lastDoneInterval,
          intervalDays,
          lastDate: null,
          daysAgo: null,
          completedAt: null,
          overdue: intervalDays > 0,
        });
        continue;
      }

      const logJakarta = new Date(latestLog.date.getTime() + JAKARTA_OFFSET_MS);
      const logDateOnly = new Date(logJakarta.getFullYear(), logJakarta.getMonth(), logJakarta.getDate());
      const daysAgo = differenceInCalendarDays(today, logDateOnly);

      // Extract time in Jakarta timezone (UTC+7)
      let timeStr: string | null = null;
      if (latestLog.completedAt) {
        try {
          const d = new Date(latestLog.completedAt);
          const jakarta = new Date(d.getTime() + JAKARTA_OFFSET_MS);
          timeStr = `${String(jakarta.getUTCHours()).padStart(2, '0')}:${String(jakarta.getUTCMinutes()).padStart(2, '0')}`;
        } catch {
          // fallback: raw extract
          const tm = latestLog.completedAt.match(/T(\d{2}:\d{2})/);
          if (tm) timeStr = tm[1];
        }
      }

      lastDoneSummary.push({
        id: habit.id,
        name: habit.name,
        icon: habit.icon,
        color: habit.color,
        interval: habit.lastDoneInterval,
        intervalDays,
        lastDate: latestLog.date,
        daysAgo,
        completedAt: timeStr,
        overdue: intervalDays > 0 && daysAgo > intervalDays,
      });
    }

    // Sort: overdue first, then by daysAgo desc, then never-done at bottom
    lastDoneSummary.sort((a, b) => {
      if (a.daysAgo === null && b.daysAgo === null) return 0;
      if (a.daysAgo === null) return 1;
      if (b.daysAgo === null) return -1;
      if (a.overdue && !b.overdue) return -1;
      if (!a.overdue && b.overdue) return 1;
      return (b.daysAgo ?? 0) - (a.daysAgo ?? 0);
    });

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
      // Time-tracked habits
      timeTrackedSummary,
      // Last done habits
      lastDoneSummary,
    }, {
      headers: {
        // Cache for 30s, then allow serving stale while revalidating for 60s.
        // Dashboard data changes infrequently (user marks habits, adds transactions),
        // so brief caching is safe and significantly reduces DB load on rapid nav.
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('GET /api/dashboard error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 });
  }
}