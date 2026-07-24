import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { format, differenceInCalendarDays, subDays } from 'date-fns';

// Jakarta timezone helpers
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
function jakartaToday(): Date {
  const now = new Date(Date.now() + JAKARTA_OFFSET_MS);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// GET /api/habits/last-done
// Returns last completion date for each habit with trackLastDone = true
export async function GET() {
  try {

    const trackedHabits = await db.habit.findMany({
      where: { trackLastDone: true, status: 'active' },
      select: {
        id: true,
        name: true,
        icon: true,
        color: true,
        lastDoneInterval: true,
      },
    });

    if (trackedHabits.length === 0) {
      return NextResponse.json([]);
    }

    const habitIds = trackedHabits.map(h => h.id);

    // Get the latest completed log for each tracked habit
    const lastLogs = await db.habitLog.findMany({
      where: {
        habitId: { in: habitIds },
        completed: true,
      },
      orderBy: { date: 'desc' },
    });

    // Build map: habitId -> latest log
    const lastLogMap = new Map<string, { date: Date; completedAt: string | null }>();
    for (const log of lastLogs) {
      if (!lastLogMap.has(log.habitId)) {
        lastLogMap.set(log.habitId, { date: log.date, completedAt: log.completedAt });
      }
    }

    const today = jakartaToday();
    const todayStr = format(today, 'yyyy-MM-dd');

    // Parse interval string to days
    function intervalToDays(interval: string | null): number {
      if (!interval) return 0;
      const match = interval.match(/^(\d+)(d|w)$/);
      if (!match) return 0;
      const val = parseInt(match[1], 10);
      return match[2] === 'w' ? val * 7 : val;
    }

    const result = trackedHabits.map(habit => {
      const lastLog = lastLogMap.get(habit.id);
      if (!lastLog) {
        const intervalDays = intervalToDays(habit.lastDoneInterval);
        return {
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
        };
      }

      // Use Jakarta timezone for daysAgo calculation
      const logJakarta = new Date(lastLog.date.getTime() + JAKARTA_OFFSET_MS);
      const logDateOnly = new Date(logJakarta.getFullYear(), logJakarta.getMonth(), logJakarta.getDate());
      const daysAgo = differenceInCalendarDays(today, logDateOnly);
      const intervalDays = intervalToDays(habit.lastDoneInterval);

      // Extract time from completedAt if available
      let timeStr: string | null = null;
      if (lastLog.completedAt) {
        const m = lastLog.completedAt.match(/T(\d{2}:\d{2})/);
        if (m) timeStr = m[1];
      }

      return {
        id: habit.id,
        name: habit.name,
        icon: habit.icon,
        color: habit.color,
        interval: habit.lastDoneInterval,
        intervalDays,
        lastDate: lastLog.date,
        daysAgo,
        completedAt: timeStr,
        overdue: intervalDays > 0 && daysAgo > intervalDays,
      };
    });

    // Sort: overdue first (by most overdue), then by daysAgo desc (oldest first), then never-done
    result.sort((a, b) => {
      // Never done always at top if no interval, or below overdue if has interval
      if (a.daysAgo === null && b.daysAgo === null) return 0;
      if (a.daysAgo === null) return 1; // never done → bottom
      if (b.daysAgo === null) return -1;

      // Overdue items first
      if (a.overdue && !b.overdue) return -1;
      if (!a.overdue && b.overdue) return 1;

      // Both overdue or both not: most overdue first
      return (b.daysAgo ?? 0) - (a.daysAgo ?? 0);
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/habits/last-done error:', error);
    return NextResponse.json([]);
  }
}