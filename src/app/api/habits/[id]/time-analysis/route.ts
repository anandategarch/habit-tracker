import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  subMonths,
  format,
  addDays,
  parseISO,
} from 'date-fns';

interface DayData {
  date: string;
  label: string;
  time: string | null; // "HH:mm"
  minutesFromMidnight: number | null;
  diffFromTarget: number | null; // positive = late, negative = early
}

interface AnalysisResult {
  habit: {
    id: string;
    name: string;
    icon: string;
    trackTime: boolean;
    targetTime: string | null;
  };
  filter: string;
  data: DayData[];
  stats: {
    average: string | null; // "HH:mm"
    best: string | null; // earliest time
    worst: string | null; // latest time
    onTargetCount: number;
    totalCount: number;
    onTargetRate: number;
    vsPrevious: number | null; // minutes diff from previous period, negative = improving
  };
}

function toMinutes(isoStr: string): number {
  const d = new Date(isoStr);
  return d.getHours() * 60 + d.getMinutes();
}

function minutesToHHmm(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// GET /api/habits/[id]/time-analysis?filter=thisWeek|lastWeek|thisMonth|lastMonth|last30days
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'thisWeek';

    // Fetch the habit
    const habit = await db.habit.findUnique({ where: { id } });
    if (!habit) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
    }
    if (!habit.trackTime) {
      return NextResponse.json({ error: 'This habit does not track time' }, { status: 400 });
    }

    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let prevStartDate: Date;
    let prevEndDate: Date;

    switch (filter) {
      case 'lastWeek':
        startDate = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        endDate = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        prevStartDate = startOfWeek(subWeeks(now, 2), { weekStartsOn: 1 });
        prevEndDate = endOfWeek(subWeeks(now, 2), { weekStartsOn: 1 });
        break;
      case 'thisMonth':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        prevStartDate = startOfMonth(subMonths(now, 1));
        prevEndDate = endOfMonth(subMonths(now, 1));
        break;
      case 'lastMonth':
        startDate = startOfMonth(subMonths(now, 1));
        endDate = endOfMonth(subMonths(now, 1));
        prevStartDate = startOfMonth(subMonths(now, 2));
        prevEndDate = endOfMonth(subMonths(now, 2));
        break;
      case 'last30days':
        startDate = subDays(now, 29);
        endDate = endOfDay(now);
        prevStartDate = subDays(startDate, 30);
        prevEndDate = subDays(startDate, 1);
        break;
      default: // thisWeek
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        prevStartDate = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        prevEndDate = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        break;
    }

    // Fetch logs for this period
    const logs = await db.habitLog.findMany({
      where: {
        habitId: id,
        date: { gte: startDate, lte: endDate },
        completed: true,
        completedAt: { not: null },
      },
      orderBy: { date: 'asc' },
    });

    // Fetch logs for previous period (for comparison)
    const prevLogs = await db.habitLog.findMany({
      where: {
        habitId: id,
        date: { gte: prevStartDate, lte: prevEndDate },
        completed: true,
        completedAt: { not: null },
      },
    });

    // Build day data
    const targetMinutes = habit.targetTime
      ? (() => {
          const [h, m] = habit.targetTime.split(':').map(Number);
          return h * 60 + m;
        })()
      : null;

    const data: DayData[] = [];
    let current = startDate;
    while (current <= endDate) {
      const dateStr = format(current, 'yyyy-MM-dd');
      const dayLabel = format(current, 'EEE');
      const log = logs.find((l) => format(l.date, 'yyyy-MM-dd') === dateStr);

      if (log?.completedAt) {
        const mins = toMinutes(log.completedAt.toISOString());
        const timeStr = minutesToHHmm(mins);
        let diff: number | null = null;
        if (targetMinutes !== null) {
          diff = mins - targetMinutes;
        }
        data.push({
          date: dateStr,
          label: dayLabel,
          time: timeStr,
          minutesFromMidnight: mins,
          diffFromTarget: diff,
        });
      } else {
        data.push({
          date: dateStr,
          label: dayLabel,
          time: null,
          minutesFromMidnight: null,
          diffFromTarget: null,
        });
      }
      current = addDays(current, 1);
    }

    // Compute stats
    const timesWithValues = data.filter((d) => d.minutesFromMidnight !== null);
    const totalTime = timesWithValues.reduce((sum, d) => sum + (d.minutesFromMidnight || 0), 0);
    const avgMinutes = timesWithValues.length > 0 ? Math.round(totalTime / timesWithValues.length) : null;
    const bestMinutes = timesWithValues.length > 0
      ? Math.min(...timesWithValues.map((d) => d.minutesFromMidnight || Infinity))
      : null;
    const worstMinutes = timesWithValues.length > 0
      ? Math.max(...timesWithValues.map((d) => d.minutesFromMidnight || -Infinity))
      : null;

    const onTargetCount = targetMinutes !== null
      ? timesWithValues.filter((d) => (d.minutesFromMidnight || 0) <= targetMinutes).length
      : 0;

    // Previous period average
    const prevMins = prevLogs.map((l) => l.completedAt ? toMinutes(l.completedAt.toISOString()) : null).filter((m): m is number => m !== null);
    const prevAvg = prevMins.length > 0 ? Math.round(prevMins.reduce((a, b) => a + b, 0) / prevMins.length) : null;
    const vsPrevious = avgMinutes !== null && prevAvg !== null ? avgMinutes - prevAvg : null;

    const result: AnalysisResult = {
      habit: {
        id: habit.id,
        name: habit.name,
        icon: habit.icon,
        trackTime: habit.trackTime,
        targetTime: habit.targetTime,
      },
      filter,
      data,
      stats: {
        average: avgMinutes !== null ? minutesToHHmm(avgMinutes) : null,
        best: bestMinutes !== null && bestMinutes !== Infinity ? minutesToHHmm(bestMinutes) : null,
        worst: worstMinutes !== null && worstMinutes !== -Infinity ? minutesToHHmm(worstMinutes) : null,
        onTargetCount,
        totalCount: timesWithValues.length,
        onTargetRate: timesWithValues.length > 0 && targetMinutes !== null
          ? Math.round((onTargetCount / timesWithValues.length) * 100)
          : 0,
        vsPrevious,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/habits/[id]/time-analysis error:', error);
    return NextResponse.json({ error: 'Failed to fetch time analysis' }, { status: 500 });
  }
}