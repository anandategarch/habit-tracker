import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { startOfDay, subDays, format } from 'date-fns';

// ── Jakarta timezone helpers (UTC+7) ───────────────────────────────────
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function jakartaNow(): Date {
  return new Date(Date.now() + JAKARTA_OFFSET_MS);
}

function jakartaToday(): Date {
  const now = jakartaNow();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function GET() {
  try {
    const today = jakartaToday();

    const habits = await db.habit.findMany({ where: { status: 'active' } });
    const logs = await db.habitLog.findMany({
      where: { date: { gte: subDays(today, 90) } },
      include: { habit: true },
    });
    const dailyLogs = await db.dailyLog.findMany({
      where: { date: { gte: subDays(today, 90) } },
    });

    // Analyze patterns
    const insights: { type: string; icon: string; title: string; description: string; severity: 'positive' | 'negative' | 'neutral' }[] = [];

    if (logs.length === 0) {
      insights.push({
        type: 'getting-started',
        icon: '🚀',
        title: 'Getting Started',
        description: 'Start tracking your habits to receive personalized insights and recommendations.',
        severity: 'neutral',
      });
      return NextResponse.json({ insights });
    }

    // Habit performance analysis
    const habitStats = new Map<string, { done: number; total: number; name: string; icon: string; category: string }>();
    for (const h of habits) {
      habitStats.set(h.id, { done: 0, total: 0, name: h.name, icon: h.icon, category: h.category });
    }
    for (const log of logs) {
      const stat = habitStats.get(log.habitId);
      if (stat) {
        stat.total++;
        if (log.completed) stat.done++;
      }
    }

    // Best habit
    let bestStat: { name: string; icon: string; rate: number } | null = null;
    let worstStat: { name: string; icon: string; rate: number } | null = null;
    for (const [, stat] of habitStats) {
      if (stat.total > 0) {
        const rate = Math.round((stat.done / stat.total) * 100);
        if (!bestStat || rate > bestStat.rate) bestStat = { name: stat.name, icon: stat.icon, rate };
        if (!worstStat || rate < worstStat.rate) worstStat = { name: stat.name, icon: stat.icon, rate };
      }
    }

    if (bestStat) {
      insights.push({
        type: 'best-habit',
        icon: '🌟',
        title: 'Top Performer',
        description: `${bestStat.icon} ${bestStat.name} is your best habit with ${bestStat.rate}% completion rate. Keep it up!`,
        severity: 'positive',
      });
    }

    if (worstStat && worstStat.rate < 50) {
      insights.push({
        type: 'worst-habit',
        icon: '⚠️',
        title: 'Needs Attention',
        description: `${worstStat.icon} ${worstStat.name} has only ${worstStat.rate}% completion. Consider adjusting the difficulty or time.`,
        severity: 'negative',
      });
    }

    // Day of week analysis
    const dowMap = new Map<number, { done: number; total: number }>();
    for (const log of logs) {
      const dow = log.date.getDay();
      if (!dowMap.has(dow)) dowMap.set(dow, { done: 0, total: 0 });
      const stat = dowMap.get(dow)!;
      stat.total++;
      if (log.completed) stat.done++;
    }
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let bestDay: string | null = null;
    let worstDay: string | null = null;
    let bestDayRate = 0;
    let worstDayRate = 100;
    for (const [dow, stat] of dowMap) {
      if (stat.total > 0) {
        const rate = (stat.done / stat.total) * 100;
        if (rate > bestDayRate) { bestDayRate = rate; bestDay = dayNames[dow]; }
        if (rate < worstDayRate) { worstDayRate = rate; worstDay = dayNames[dow]; }
      }
    }

    if (bestDay) {
      insights.push({
        type: 'best-day',
        icon: '📅',
        title: 'Best Day',
        description: `${bestDay} is your most productive day with ${Math.round(bestDayRate)}% completion rate.`,
        severity: 'positive',
      });
    }
    if (worstDay && worstDayRate < bestDayRate - 20) {
      insights.push({
        type: 'worst-day',
        icon: '📋',
        title: 'Challenge Day',
        description: `${worstDay} has the lowest completion rate (${Math.round(worstDayRate)}%). Plan easier habits for this day.`,
        severity: 'negative',
      });
    }

    // Mood correlation
    if (dailyLogs.length >= 5) {
      const moodAvg = dailyLogs.reduce((s, l) => s + l.mood, 0) / dailyLogs.length;
      const highMoodDays = dailyLogs.filter(l => l.mood >= 4);
      const lowMoodDays = dailyLogs.filter(l => l.mood <= 2);

      // Correlate mood with completion
      const highMoodCompletion: number[] = [];
      const lowMoodCompletion: number[] = [];
      for (const dl of highMoodDays) {
        const key = format(dl.date, 'yyyy-MM-dd');
        const dayLogs = logs.filter(l => format(l.date, 'yyyy-MM-dd') === key);
        if (dayLogs.length > 0) {
          highMoodCompletion.push(dayLogs.filter(l => l.completed).length / dayLogs.length);
        }
      }
      for (const dl of lowMoodDays) {
        const key = format(dl.date, 'yyyy-MM-dd');
        const dayLogs = logs.filter(l => format(l.date, 'yyyy-MM-dd') === key);
        if (dayLogs.length > 0) {
          lowMoodCompletion.push(dayLogs.filter(l => l.completed).length / dayLogs.length);
        }
      }

      const avgHighMoodCompletion = highMoodCompletion.length > 0
        ? highMoodCompletion.reduce((a, b) => a + b, 0) / highMoodCompletion.length : 0;
      const avgLowMoodCompletion = lowMoodCompletion.length > 0
        ? lowMoodCompletion.reduce((a, b) => a + b, 0) / lowMoodCompletion.length : 0;

      insights.push({
        type: 'mood-analysis',
        icon: '😊',
        title: 'Mood Insight',
        description: `Your average mood is ${moodAvg.toFixed(1)}/5. ${avgHighMoodCompletion > avgLowMoodCompletion ? 'Higher mood correlates with better habit completion.' : 'Mood doesn\'t seem to affect your completion rate much.'}`,
        severity: avgHighMoodCompletion > avgLowMoodCompletion ? 'positive' : 'neutral',
      });
    }

    // Trend analysis
    const recentLogs = logs.filter(l => l.date >= subDays(today, 7));
    const olderLogs = logs.filter(l => l.date >= subDays(today, 14) && l.date < subDays(today, 7));
    const recentRate = recentLogs.length > 0 ? recentLogs.filter(l => l.completed).length / recentLogs.length : 0;
    const olderRate = olderLogs.length > 0 ? olderLogs.filter(l => l.completed).length / olderLogs.length : 0;

    if (olderLogs.length > 0) {
      const diff = recentRate - olderRate;
      if (diff > 0.1) {
        insights.push({
          type: 'trend-up',
          icon: '📈',
          title: 'Improving Trend',
          description: `Your completion rate improved by ${Math.round(diff * 100)}% compared to last week. Great momentum!`,
          severity: 'positive',
        });
      } else if (diff < -0.1) {
        insights.push({
          type: 'trend-down',
          icon: '📉',
          title: 'Declining Trend',
          description: `Your completion rate dropped by ${Math.round(Math.abs(diff) * 100)}% this week. Consider reducing the number of habits or adjusting difficulty.`,
          severity: 'negative',
        });
      }
    }

    // Recommendations
    if (habits.length > 10) {
      insights.push({
        type: 'recommendation',
        icon: '💡',
        title: 'Simplification Tip',
        description: 'You\'re tracking many habits. Consider focusing on your top 5-7 habits for better consistency.',
        severity: 'neutral',
      });
    }

    if (dailyLogs.length > 0) {
      const avgSleep = dailyLogs.reduce((s, l) => s + l.sleep, 0) / dailyLogs.length;
      if (avgSleep < 6.5) {
        insights.push({
          type: 'sleep-warning',
          icon: '😴',
          title: 'Sleep Alert',
          description: `Your average sleep is ${avgSleep.toFixed(1)} hours. Better sleep may improve your habit completion.`,
          severity: 'negative',
        });
      }
    }

    // Completion prediction
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      const key = format(d, 'yyyy-MM-dd');
      const dayLogs = logs.filter(l => format(l.date, 'yyyy-MM-dd') === key);
      const completed = dayLogs.filter(l => l.completed).length;
      const total = dayLogs.length;
      last7Days.push(total > 0 ? completed / total : null);
    }
    const validDays = last7Days.filter((d): d is number => d !== null);
    if (validDays.length >= 3) {
      const avg = validDays.reduce((a, b) => a + b, 0) / validDays.length;
      insights.push({
        type: 'prediction',
        icon: '🔮',
        title: 'Monthly Forecast',
        description: `Based on your recent performance, you\'re on track for ${Math.round(avg * 100)}% completion this month.`,
        severity: avg >= 0.7 ? 'positive' : avg >= 0.4 ? 'neutral' : 'negative',
      });
    }

    return NextResponse.json({ insights });
  } catch (error) {
    console.error('GET /api/ai-insights error:', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}