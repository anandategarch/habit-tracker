import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import {
  startOfDay, subDays, format, startOfWeek,
  startOfMonth, differenceInCalendarDays,
} from 'date-fns';
import { jakartaToday, jakartaDateKey } from '@/lib/timezone';

type Period = '7d' | '1m' | '3m' | 'all';

function getPeriodDays(period: Period): number {
  switch (period) {
    case '7d': return 7;
    case '1m': return 30;
    case '3m': return 90;
    case 'all': return 365;
    default: return 365;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period: Period = (searchParams.get('period') as Period) || 'all';

    const today = jakartaToday();

    // BUG-12 fix: include ALL habits (active + paused + archived) so that
    // historical statistics reflect reality. Previously, archiving a habit
    // erased its past contributions to success-rate / longest-streak / etc.,
    // distorting historical stats the moment a user tidied up their list.
    const habits = await db.habit.findMany();

    const allHabitIds = new Set(habits.map(h => h.id));

    // ── Determine period start date ──────────────────────────────
    // BUG-11 fix: use startDate (user-set habit start) instead of createdAt
    // (DB row insert time). These can differ when the user back-dates a habit
    // to count earlier completions; createdAt would ignore that back-date and
    // shrink the period.
    let periodStart: Date;
    if (period === 'all') {
      if (habits.length > 0) {
        const earliest = new Date(Math.min(...habits.map(h => h.startDate.getTime())));
        periodStart = startOfDay(earliest);
      } else {
        periodStart = subDays(today, 30);
      }
    } else {
      const days = getPeriodDays(period);
      periodStart = subDays(today, days);
    }

    const periodDays = differenceInCalendarDays(today, periodStart) + 1; // inclusive

    // ── Fetch logs only for known habits ─────────────────────────
    const allLogs = (await db.habitLog.findMany({
      where: { date: { gte: periodStart, lte: today } },
      include: { habit: true },
    })).filter(l => allHabitIds.has(l.habitId));

    // Pre-sort habit start dates for O(log n) binary search lookups.
    // BUG-11 fix: was createdAt; now startDate.
    const habitStartDates = habits
      .map(h => startOfDay(h.startDate).getTime())
      .sort((a, b) => a - b);

    // ── Helper: count habits active on a given date (O(log n) via binary search) ──
    function habitsActiveOnDate(date: Date): number {
      const ts = startOfDay(date).getTime();
      let lo = 0, hi = habitStartDates.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (habitStartDates[mid] <= ts) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    }

    // ── Helper: count theoretical possible completions for a range ──
    function theoreticalMaxInRange(start: Date, end: Date): number {
      const days = differenceInCalendarDays(end, start) + 1;
      let total = 0;
      for (let i = 0; i < days; i++) {
        const d = subDays(end, i);
        total += habitsActiveOnDate(d);
      }
      return total;
    }

    // ── Build daily map: dateStr -> { completed count, theoretical max } ──
    const dailyStats = new Map<string, { done: number; total: number }>();
    for (let i = 0; i < periodDays; i++) {
      const d = subDays(today, i);
      const key = format(d, 'yyyy-MM-dd');
      const activeCount = habitsActiveOnDate(d);
      if (activeCount > 0) {
        dailyStats.set(key, { done: 0, total: activeCount });
      }
    }

    // Populate completed counts from logs
    // BUG-25 fix: use jakartaDateKey (TZ-explicit) instead of format() which
    // reads the server's local TZ. On Vercel (UTC) the two produce the same
    // result, but on a non-UTC server (e.g. local dev in Pacific) format()
    // would shift the date by up to a day, mis-bucketing logs and producing
    // empty dailyStats entries.
    const dailyCompletionMap = new Map<string, Set<string>>();
    for (const log of allLogs) {
      if (!log.completed) continue;
      const key = jakartaDateKey(log.date);
      if (!dailyCompletionMap.has(key)) dailyCompletionMap.set(key, new Set());
      dailyCompletionMap.get(key)!.add(log.habitId);
    }

    for (const [date, stat] of dailyStats) {
      stat.done = dailyCompletionMap.get(date)?.size || 0;
    }

    // ── Overall stats ────────────────────────────────────────────
    const theoreticalMaxPeriod = theoreticalMaxInRange(periodStart, today);
    const totalCompletion = allLogs.filter(l => l.completed).length;
    const totalEntries = theoreticalMaxPeriod; // total possible completions
    const missCount = Math.max(0, theoreticalMaxPeriod - totalCompletion);
    const successRate = theoreticalMaxPeriod > 0
      ? Math.round((totalCompletion / theoreticalMaxPeriod) * 100)
      : 0;

    // ── Average score (completion rate per day, only days with active habits) ──
    const dailyRates: number[] = [];
    for (const [, stat] of dailyStats) {
      if (stat.total > 0) {
        dailyRates.push((stat.done / stat.total) * 100);
      }
    }
    const averageScore = dailyRates.length > 0
      ? Math.round(dailyRates.reduce((a, b) => a + b, 0) / dailyRates.length)
      : 0;

    // ── Best day / worst day ─────────────────────────────────────
    // Initialize worstDay with rate=101 (sentinel above 100%) so the first
    // iteration always replaces it. Previously initialized to 0, but
    // `rate < 0` is impossible for a percentage — so worstDay was never
    // updated and always returned `{ date: 'N/A', rate: 0 }`.
    let bestDay = { date: 'N/A', rate: -1 };
    let worstDay = { date: 'N/A', rate: 101 };

    for (const [date, stat] of dailyStats) {
      const rate = stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0;
      if (rate > bestDay.rate) bestDay = { date, rate };
      if (rate < worstDay.rate) worstDay = { date, rate };
    }
    // If no days were tracked, fall back to N/A / 0.
    if (bestDay.rate < 0) bestDay = { date: 'N/A', rate: 0 };
    if (worstDay.rate > 100) worstDay = { date: 'N/A', rate: 0 };

    // ── Best week / best month ───────────────────────────────────
    const weeklyMap = new Map<string, { done: number; total: number }>();
    const monthlyMap = new Map<string, { done: number; total: number }>();

    for (const [date, stat] of dailyStats) {
      const d = new Date(date + 'T00:00:00');
      const wKey = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const mKey = format(startOfMonth(d), 'yyyy-MM');

      if (!weeklyMap.has(wKey)) weeklyMap.set(wKey, { done: 0, total: 0 });
      if (!monthlyMap.has(mKey)) monthlyMap.set(mKey, { done: 0, total: 0 });

      weeklyMap.get(wKey)!.done += stat.done;
      weeklyMap.get(wKey)!.total += stat.total;
      monthlyMap.get(mKey)!.done += stat.done;
      monthlyMap.get(mKey)!.total += stat.total;
    }

    let bestWeek = { week: 'N/A', rate: 0 };
    let bestMonth = { month: 'N/A', rate: 0 };

    for (const [week, stat] of weeklyMap) {
      const rate = stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0;
      if (rate > bestWeek.rate) bestWeek = { week, rate };
    }
    for (const [month, stat] of monthlyMap) {
      const rate = stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0;
      if (rate > bestMonth.rate) bestMonth = { month, rate };
    }

    // ── Longest success / failure streak ─────────────────────────
    const sortedDates = [...dailyStats.keys()].sort();
    let longestSuccess = 0, longestFailure = 0;
    let tempSuccess = 0, tempFailure = 0;

    for (const date of sortedDates) {
      const stat = dailyStats.get(date)!;
      if (stat.done >= stat.total && stat.total > 0) {
        // All habits completed on this day
        tempSuccess++;
        tempFailure = 0;
        longestSuccess = Math.max(longestSuccess, tempSuccess);
      } else if (stat.done === 0 && stat.total > 0) {
        // No habits completed on this day
        tempFailure++;
        tempSuccess = 0;
        longestFailure = Math.max(longestFailure, tempFailure);
      } else {
        // Partial completion - reset both streaks
        tempSuccess = 0;
        tempFailure = 0;
      }
    }

    // ── Total days tracked (days with at least 1 active habit) ──
    const totalDaysTracked = dailyStats.size;

    return NextResponse.json({
      totalCompletion,
      totalEntries,
      missCount,
      successRate,
      averageScore,
      bestDay,
      worstDay,
      bestWeek,
      bestMonth,
      longestSuccess,
      longestFailure,
      totalDaysTracked,
      period,
    });
  } catch (error) {
    console.error('GET /api/statistics error:', error);
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
  }
}