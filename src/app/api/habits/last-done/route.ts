import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { format, differenceInCalendarDays, subDays } from '@/lib/date-utils';
// PERF-FIX (FIX-TIER3 / Fix 15): replaced `date-fns` with native Intl-based
// utility module. Output is identical for the patterns and helpers used
// here (yyyy-MM-dd + differenceInCalendarDays/subDays) — verified via
// test script in worklog FIX-TIER3 entry.
import { jakartaToday, jakartaDateKey, jakartaTimeMinutes } from '@/lib/timezone';

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

    // Get the latest completed log for each tracked habit.
    // PERF-API-1 FIX-TIER1: previously fetched ALL completed logs for ALL
    // tracked habits (unbounded — could be thousands of rows over years of
    // usage). `distinct: ['habitId']` + `orderBy: { date: 'desc' }` makes
    // Prisma return exactly ONE row per habitId — the latest. Mirrors the
    // pattern used in /api/dashboard line 700-708.
    const lastLogs = await db.habitLog.findMany({
      where: {
        habitId: { in: habitIds },
        completed: true,
      },
      distinct: ['habitId'],
      orderBy: { date: 'desc' },
    });

    // Build map: habitId -> latest log. (Defensive dedupe — `distinct`
    // already returns one row per habitId, so this loop is a no-op, but
    // kept as a safety net in case of future query changes.)
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
      const logYMD = jakartaDateKey(lastLog.date);
      const [ly, lm, ld] = logYMD.split('-').map(Number);
      const logDateOnly = new Date(ly, lm - 1, ld);
      const daysAgo = differenceInCalendarDays(today, logDateOnly);
      const intervalDays = intervalToDays(habit.lastDoneInterval);

      // Extract time from completedAt using Jakarta TZ (BUG-28 fix).
      // Previously used a regex `match(/T(\d{2}:\d{2})/)` which returned the
      // RAW ISO time components — correct only when the ISO was already in
      // Jakarta offset. For UTC-stored timestamps (Z suffix) it returned
      // the UTC time, not Jakarta. Use jakartaTimeMinutes for TZ-correct HH:mm.
      let timeStr: string | null = null;
      if (lastLog.completedAt) {
        const mins = jakartaTimeMinutes(new Date(lastLog.completedAt));
        const h = Math.floor(mins / 60) % 24;
        const m = mins % 60;
        timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

    // Sort: overdue first (by most overdue), then by daysAgo desc (oldest first).
    // Never-done items (daysAgo === null) sort to the bottom.
    result.sort((a, b) => {
      // Never-done items go to the bottom (after items with completion history).
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