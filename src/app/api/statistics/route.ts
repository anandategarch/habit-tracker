import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import {
  startOfDay, subDays, format, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
} from 'date-fns';

export async function GET() {
  try {
    const now = new Date();
    const today = startOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const allLogs = await db.habitLog.findMany({
      include: { habit: true },
    });

    const dailyLogs = await db.dailyLog.findMany();

    // Total completion
    const totalCompletion = allLogs.filter(l => l.completed).length;
    const totalEntries = allLogs.length;
    const missCount = totalEntries - totalCompletion;
    const successRate = totalEntries > 0 ? Math.round((totalCompletion / totalEntries) * 100) : 0;

    // Average score (completion rate per day)
    const dailyMap = new Map<string, { done: number; total: number }>();
    for (const log of allLogs) {
      const key = format(log.date, 'yyyy-MM-dd');
      if (!dailyMap.has(key)) dailyMap.set(key, { done: 0, total: 0 });
      const stat = dailyMap.get(key)!;
      stat.total++;
      if (log.completed) stat.done++;
    }
    const dailyRates = [...dailyMap.values()].map(s => s.total > 0 ? (s.done / s.total) * 100 : 0);
    const averageScore = dailyRates.length > 0 ? Math.round(dailyRates.reduce((a, b) => a + b, 0) / dailyRates.length) : 0;

    // Best day / worst day
    let bestDay = { date: 'N/A', rate: 0 };
    let worstDay = { date: 'N/A', rate: 100 };
    for (const [date, stat] of dailyMap) {
      const rate = stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0;
      if (rate > bestDay.rate) bestDay = { date, rate };
      if (rate < worstDay.rate) worstDay = { date, rate };
    }

    // Best week / best month
    const weeklyMap = new Map<string, { done: number; total: number }>();
    const monthlyMap = new Map<string, { done: number; total: number }>();
    for (const log of allLogs) {
      const wKey = format(startOfWeek(log.date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const mKey = format(startOfMonth(log.date), 'yyyy-MM');
      if (!weeklyMap.has(wKey)) weeklyMap.set(wKey, { done: 0, total: 0 });
      if (!monthlyMap.has(mKey)) monthlyMap.set(mKey, { done: 0, total: 0 });
      const wStat = weeklyMap.get(wKey)!;
      const mStat = monthlyMap.get(mKey)!;
      wStat.total++;
      mStat.total++;
      if (log.completed) { wStat.done++; mStat.done++; }
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

    // Longest success / failure streak
    const sortedDates = [...dailyMap.keys()].sort();
    let longestSuccess = 0, longestFailure = 0;
    let tempSuccess = 0, tempFailure = 0;
    for (const date of sortedDates) {
      const stat = dailyMap.get(date)!;
      if (stat.done === stat.total && stat.total > 0) {
        tempSuccess++;
        tempFailure = 0;
        longestSuccess = Math.max(longestSuccess, tempSuccess);
      } else if (stat.done === 0 && stat.total > 0) {
        tempFailure++;
        tempSuccess = 0;
        longestFailure = Math.max(longestFailure, tempFailure);
      } else {
        tempSuccess = 0;
        tempFailure = 0;
      }
    }

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
      totalDaysTracked: dailyMap.size,
    });
  } catch (error) {
    console.error('GET /api/statistics error:', error);
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
  }
}