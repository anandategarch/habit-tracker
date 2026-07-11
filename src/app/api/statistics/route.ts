import { db } from '@/lib/db';
import { ensureTimeTrackingColumns } from '@/lib/ensure-columns';
import { NextRequest, NextResponse } from 'next/server';
import {
  startOfDay, subDays, format, startOfWeek,
  startOfMonth, differenceInCalendarDays,
} from 'date-fns';

// ── Jakarta timezone helpers (UTC+7) ───────────────────────────────
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function jakartaNow(): Date {
  return new Date(Date.now() + JAKARTA_OFFSET_MS);
}

function jakartaToday(): Date {
  const now = jakartaNow();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

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
    await ensureTimeTrackingColumns();
    const { searchParams } = new URL(request.url);
    const period: Period = (searchParams.get('period') as Period) || 'all';

    const today = jakartaToday();

    // Fetch only active habits
    const habits = await db.habit.findMany({
      where: { status: 'active' },
    });

    const activeHabitIds = new Set(habits.map(h => h.id));

    // ── Determine period start date ──────────────────────────────
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

    // ── Fetch logs only for active habits ─────────────────────────
    const allLogs = (await db.habitLog.findMany({
      where: { date: { gte: periodStart, lte: today } },
      include: { habit: true },
    })).filter(l => activeHabitIds.has(l.habitId));

    // Pre-sort habit creation dates for O(log n) binary search lookups
    const habitCreatedDates = habits
      .map(h => startOfDay(h.createdAt).getTime())
      .sort((a, b) => a - b);

    // ── Helper: count habits active on a given date (O(log n) via binary search) ──
    function habitsActiveOnDate(date: Date): number {
      const ts = startOfDay(date).getTime();
      let lo = 0, hi = habitCreatedDates.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (habitCreatedDates[mid] <= ts) lo = mid + 1;
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
    const dailyCompletionMap = new Map<string, Set<string>>();
    for (const log of allLogs) {
      if (!log.completed) continue;
      const key = format(log.date, 'yyyy-MM-dd');
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
    let bestDay = { date: 'N/A', rate: 0 };
    let worstDay = { date: 'N/A', rate: 0 };

    for (const [date, stat] of dailyStats) {
      const rate = stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0;
      if (rate > bestDay.rate) bestDay = { date, rate };
      if (rate < worstDay.rate) worstDay = { date, rate };
    }

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