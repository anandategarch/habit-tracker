// GET /api/analytics/hourly-consistency?period=30 — distribusi jam penyelesaian habit.
// Jam diambil dari completedAt dipandang dari Jakarta (+07:00); rentang log
// konsisten UTC-midnight: dateFromYMD(jakartaDateString()).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, handleApiError, round1, ymdOf } from '@/app/api/_lib/api-utils';
import { shiftYmd } from '@/lib/dashboard-helpers';
import { dateFromYMD, jakartaDateString, toJakarta } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const periodParam = new URL(req.url).searchParams.get('period');
    let period = 30;
    if (periodParam !== null && periodParam !== '') {
      const n = Number(periodParam);
      if (!Number.isInteger(n) || n < 1 || n > 365) {
        throw badRequest('Parameter period tidak valid (angka 1–365 hari)');
      }
      period = n;
    }

    const todayYmd = jakartaDateString();
    const startYmd = shiftYmd(todayYmd, -(period - 1));
    const periodStart = dateFromYMD(startYmd);
    const periodEnd = dateFromYMD(todayYmd); // UTC-midnight — konsisten penyimpanan

    const logs = await db.habitLog.findMany({
      where: {
        completed: true,
        completedAt: { not: null },
        date: { gte: periodStart, lte: periodEnd },
      },
      select: { date: true, completedAt: true },
    });

    // Filter ekstra YMD (guard TZ server) + jam dinding Jakarta dari completedAt.
    const counts = new Array<number>(24).fill(0);
    let total = 0;
    for (const log of logs) {
      const ymd = ymdOf(log.date as Date);
      if (ymd < startYmd || ymd > todayYmd) continue;
      if (!(log.completedAt instanceof Date)) continue;
      const hour = toJakarta(log.completedAt).getUTCHours();
      counts[hour] += 1;
      total += 1;
    }

    const byHour = counts.map((count, hour) => ({
      hour,
      count,
      rate: total > 0 ? round1((count / total) * 100) : 0,
    }));

    return NextResponse.json({
      byHour,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });
  } catch (error) {
    return handleApiError(error, 'analytics/hourly-consistency:GET');
  }
}
