import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import {
  startOfDay, subDays, format, startOfWeek, startOfMonth,
  subMonths, eachDayOfInterval, differenceInDays,
} from 'date-fns';

// ── Jakarta timezone helpers (UTC+7) ───────────────────────────────────
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function jakartaNow(): Date {
  return new Date(Date.now() + JAKARTA_OFFSET_MS);
}

function jakartaToday(): Date {
  const now = jakartaNow();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30'; // days
    const today = jakartaToday();
    const daysBack = Math.min(parseInt(period) || 30, 365);
    const startDate = subDays(today, daysBack);

    // Get all habits and logs in the period
    const habits = await db.habit.findMany({ where: { status: 'active' } });
    const logs = await db.habitLog.findMany({
      where: { date: { gte: startDate, lte: today } },
      include: { habit: true },
    });

    const dailyLogs = await db.dailyLog.findMany({
      where: { date: { gte: startDate, lte: today } },
    });

    // Completion trend (daily)
    const days = eachDayOfInterval({ start: startDate, end: today });
    const completionTrend = days.map(d => {
      const key = format(d, 'yyyy-MM-dd');
      const dayLogs = logs.filter(l => format(l.date, 'yyyy-MM-dd') === key);
      const completed = dayLogs.filter(l => l.completed).length;
      const total = dayLogs.length;
      return {
        date: key,
        label: format(d, 'MMM dd'),
        completed,
        total,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });

    // Moving average (7-day)
    const movingAverage = completionTrend.map((item, index) => {
      const window = completionTrend.slice(Math.max(0, index - 6), index + 1);
      const avgRate = window.reduce((s, w) => s + w.rate, 0) / window.length;
      return { ...item, movingAvg: Math.round(avgRate) };
    });

    // Weekly trend
    const weeklyTrend = [];
    for (let i = Math.floor(daysBack / 7); i >= 0; i--) {
      const wStart = subDays(today, (i + 1) * 7);
      const wEnd = subDays(today, i * 7);
      const wLogs = logs.filter(l => l.date >= wStart && l.date <= wEnd);
      const wCompleted = wLogs.filter(l => l.completed).length;
      weeklyTrend.push({
        week: `${format(wStart, 'MMM dd')} - ${format(wEnd, 'MMM dd')}`,
        completed: wCompleted,
        total: wLogs.length,
        rate: wLogs.length > 0 ? Math.round((wCompleted / wLogs.length) * 100) : 0,
      });
    }

    // Monthly trend (last 6 months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = startOfMonth(subMonths(today, i));
      const mEnd = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0);
      const mLogs = logs.filter(l => l.date >= mStart && l.date <= mEnd);
      const mCompleted = mLogs.filter(l => l.completed).length;
      monthlyTrend.push({
        month: format(mStart, 'MMM yyyy'),
        completed: mCompleted,
        total: mLogs.length,
        rate: mLogs.length > 0 ? Math.round((mCompleted / mLogs.length) * 100) : 0,
      });
    }

    // Category performance
    const categoryMap = new Map<string, { completed: number; total: number }>();
    for (const log of logs) {
      const cat = log.habit.category || 'General';
      if (!categoryMap.has(cat)) categoryMap.set(cat, { completed: 0, total: 0 });
      const stat = categoryMap.get(cat)!;
      stat.total++;
      if (log.completed) stat.completed++;
    }
    const categoryPerformance = [...categoryMap.entries()].map(([cat, stat]) => ({
      category: cat,
      ...stat,
      rate: stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0,
    }));

    // Habit distribution (pie chart)
    const habitDistribution = habits.map(h => {
      const hLogs = logs.filter(l => l.habitId === h.id);
      const completed = hLogs.filter(l => l.completed).length;
      return {
        name: h.name,
        icon: h.icon,
        completed,
        total: hLogs.length,
        rate: hLogs.length > 0 ? Math.round((completed / hLogs.length) * 100) : 0,
        color: h.color,
      };
    });

    // Mood/energy/sleep correlation
    const moodData = dailyLogs.map(dl => ({
      date: format(dl.date, 'yyyy-MM-dd'),
      mood: dl.mood,
      energy: dl.energy,
      sleep: dl.sleep,
      completionRate: (() => {
        const key = format(dl.date, 'yyyy-MM-dd');
        const dayLogs = logs.filter(l => format(l.date, 'yyyy-MM-dd') === key);
        const completed = dayLogs.filter(l => l.completed).length;
        return dayLogs.length > 0 ? Math.round((completed / dayLogs.length) * 100) : 0;
      })(),
    }));

    // Day of week performance
    const dayOfWeekStats = new Map<string, { completed: number; total: number }>();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (const log of logs) {
      const day = dayNames[log.date.getDay()];
      if (!dayOfWeekStats.has(day)) dayOfWeekStats.set(day, { completed: 0, total: 0 });
      const stat = dayOfWeekStats.get(day)!;
      stat.total++;
      if (log.completed) stat.completed++;
    }
    const dayOfWeekPerformance = dayNames.map(day => {
      const stat = dayOfWeekStats.get(day) || { completed: 0, total: 0 };
      return {
        day,
        ...stat,
        rate: stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0,
      };
    });

    // Forecast: predict end-of-month completion
    const currentMonthStart = startOfMonth(today);
    const currentMonthLogs = logs.filter(l => l.date >= currentMonthStart);
    const daysElapsed = differenceInDays(today, currentMonthStart) + 1;
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const currentMonthRate = currentMonthLogs.length > 0
      ? currentMonthLogs.filter(l => l.completed).length / currentMonthLogs.length
      : 0;
    const forecast = Math.round(currentMonthRate * 100);

    return NextResponse.json({
      completionTrend,
      movingAverage,
      weeklyTrend,
      monthlyTrend,
      categoryPerformance,
      habitDistribution,
      moodData,
      dayOfWeekPerformance,
      forecast,
      daysElapsed,
      daysInMonth,
    });
  } catch (error) {
    console.error('GET /api/analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}