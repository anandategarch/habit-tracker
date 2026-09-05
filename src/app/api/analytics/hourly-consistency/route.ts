import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { jakartaToday, jakartaTimeMinutes } from '@/lib/timezone';
import { subDays } from '@/lib/date-utils';
// PERF-FIX: native date-utils instead of date-fns. See FIX-TIER3 worklog.

/**
 * GET /api/analytics/hourly-consistency?period=30
 *
 * PHASE3-HABIT — "Kapan paling konsisten?" feature.
 *
 * Returns a 24-element array (index 0..23 = hour of day in Jakarta TZ) where
 * each element is `{ hour: number; count: number; rate: number }` describing
 * how many habit completions fell in that hour over the last `period` days,
 * and the rate (count / max count across all hours, 0-100) used to color the
 * heatmap.
 *
 * Only counts logs with `completed=true` AND `completedAt != null`. For
 * habits without trackTime=true, completedAt may be missing — those are
 * skipped (the spec says "for non-trackTime habits: use habit creation hour
 * as proxy (or skip)"). We choose to SKIP them since the creation-hour proxy
 * would be misleading (it doesn't reflect when the user actually did the
 * habit).
 *
 * Response shape:
 *   {
 *     hours: [{ hour: 0, count: 0, rate: 0 }, ...],   // 24 entries
 *     totalCompletions: number,                        // sum of all hours
 *     peakHour: number | null,                         // 0-23, null if no data
 *     periodDays: number,
 *     periodStart: string,                             // yyyy-MM-dd
 *     periodEnd: string                                // yyyy-MM-dd
 *   }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get('period') || '30';
    const periodDays = Math.min(Math.max(parseInt(periodParam, 10) || 30, 1), 365);

    const today = jakartaToday();
    const startDate = subDays(today, periodDays - 1);

    // Fetch all completed logs with a completedAt timestamp in the window.
    // We also fetch the habit to filter by status (only active habits).
    const logs = await db.habitLog.findMany({
      where: {
        completed: true,
        completedAt: { not: null },
        date: { gte: startDate, lte: today },
      },
      select: {
        completedAt: true,
        habit: { select: { status: true, trackTime: true } },
      },
    });

    // Bucket each log into its Jakarta-hour (0-23). Skip logs whose habit is
    // not active (archived/paused) since those don't represent "current"
    // consistency. We do NOT skip non-trackTime habits here — if a log has a
    // completedAt value, it counts regardless of how it got there. (Some
    // non-trackTime habits may have completedAt values from the API's
    // historical "auto-stamp now" behaviour before BUG-6 fix.)
    const buckets = new Array(24).fill(0);
    for (const log of logs) {
      if (log.habit.status !== 'active') continue;
      if (!log.completedAt) continue;
      const minutes = jakartaTimeMinutes(new Date(log.completedAt));
      const hour = Math.floor(minutes / 60) % 24;
      buckets[hour]++;
    }

    const totalCompletions = buckets.reduce((s, c) => s + c, 0);
    const maxCount = Math.max(...buckets, 1);
    const peakBucket = totalCompletions > 0
      ? buckets.indexOf(maxCount)
      : -1;

    const hours = buckets.map((count, hour) => ({
      hour,
      count,
      rate: maxCount > 0 ? Math.round((count / maxCount) * 100) : 0,
    }));

    return NextResponse.json({
      hours,
      totalCompletions,
      peakHour: peakBucket >= 0 ? peakBucket : null,
      periodDays,
      periodStart: startDate.toISOString().slice(0, 10),
      periodEnd: today.toISOString().slice(0, 10),
    });
  } catch (error) {
    console.error('GET /api/analytics/hourly-consistency error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hourly consistency' },
      { status: 500 },
    );
  }
}
