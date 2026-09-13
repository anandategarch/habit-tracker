// GET /api/habits/[id]/time-analysis?period=thisWeek|lastWeek|thisMonth|thisYear
// Guard habit.trackTime; perbandingan rentang YMD pakai toISOString().slice(0,10).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, handleApiError, notFound, ymdOf } from '@/app/api/_lib/api-utils';
import { shiftYmd } from '@/lib/dashboard-helpers';
import { dateFromYMD, jakartaDateString } from '@/lib/timezone';
import { ensureHabitGraduation } from '@/app/api/_lib/habit-ensure';

export const dynamic = 'force-dynamic';

const PERIODS = new Set(['thisWeek', 'lastWeek', 'thisMonth', 'thisYear']);

function daysBetween(startYmd: string, endYmd: string): number {
  return Math.round((dateFromYMD(endYmd).getTime() - dateFromYMD(startYmd).getTime()) / 86_400_000) + 1;
}

/** YMD awal minggu berjalan sesuai pengaturan weekStart (0=Minggu, 1=Senin). */
function weekStartYmd(ymd: string, weekStart: number): string {
  const dow = dateFromYMD(ymd).getUTCDay(); // 0=Minggu .. 6=Sabtu
  const diff = (dow - weekStart + 7) % 7;
  return shiftYmd(ymd, -diff);
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    // Task 36: findUnique default select → semua kolom scalar (kolom baru
    // harus ada dulu di Turso produksi sebelum dibaca).
    await ensureHabitGraduation();
    const { id } = await ctx.params;
    const habit = await db.habit.findUnique({ where: { id } });
    if (!habit) throw notFound('Habit tidak ditemukan');
    if (!habit.trackTime) throw badRequest('Habit ini tidak mencatat waktu');

    const params = new URL(req.url).searchParams;
    const period = params.get('period') ?? 'thisWeek';
    if (!PERIODS.has(period)) {
      throw badRequest('Periode tidak valid (thisWeek, lastWeek, thisMonth, atau thisYear)');
    }

    const settings = await db.appSettings.findUnique({ where: { id: 'singleton' } });
    const weekStart = settings?.weekStart === 0 ? 0 : 1;
    const todayYmd = jakartaDateString();

    let startYmd: string;
    let endYmd: string;
    const y = todayYmd.slice(0, 4);
    if (period === 'thisWeek') {
      startYmd = weekStartYmd(todayYmd, weekStart);
      endYmd = todayYmd;
    } else if (period === 'lastWeek') {
      const thisWeekStart = weekStartYmd(todayYmd, weekStart);
      startYmd = shiftYmd(thisWeekStart, -7);
      endYmd = shiftYmd(thisWeekStart, -1);
    } else if (period === 'thisMonth') {
      startYmd = todayYmd.slice(0, 7) + '-01';
      const [yy, mm] = todayYmd.slice(0, 7).split('-').map(Number);
      const lastDay = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
      endYmd = `${todayYmd.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`;
    } else {
      startYmd = `${y}-01-01`;
      endYmd = `${y}-12-31`;
    }

    // Periode pembanding (panjang sama, tepat sebelum startYmd).
    const len = daysBetween(startYmd, endYmd);
    const prevStart = shiftYmd(startYmd, -len);
    const prevEnd = shiftYmd(startYmd, -1);

    const [logs, prevLogs] = await Promise.all([
      db.habitLog.findMany({
        where: {
          habitId: id,
          completed: true,
          date: { gte: dateFromYMD(startYmd), lte: dateFromYMD(endYmd) },
        },
        orderBy: { date: 'asc' },
      }),
      db.habitLog.findMany({
        where: {
          habitId: id,
          completed: true,
          date: { gte: dateFromYMD(prevStart), lte: dateFromYMD(prevEnd) },
        },
        select: { value: true },
      }),
    ]);

    // Filter YMD ekstra dengan slice(0,10) — bukan format() TZ server.
    const inRange = logs.filter((l) => {
      const ymd = ymdOf(l.date as Date);
      return ymd >= startYmd && ymd <= endYmd;
    });

    const totalMinutes = inRange.reduce((sum, l) => sum + (l.value ?? 1), 0);
    const count = inRange.length;

    const byDayMap = new Map<string, { minutes: number; count: number }>();
    for (const l of inRange) {
      const ymd = ymdOf(l.date as Date);
      const cur = byDayMap.get(ymd) ?? { minutes: 0, count: 0 };
      cur.minutes += l.value ?? 1;
      cur.count += 1;
      byDayMap.set(ymd, cur);
    }
    const byDay = Array.from(byDayMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({ date, minutes: v.minutes, count: v.count }));

    const prevMinutes = prevLogs.reduce((sum, l) => sum + (l.value ?? 1), 0);
    const vsPrevious =
      prevMinutes > 0
        ? Math.round(((totalMinutes - prevMinutes) / prevMinutes) * 100)
        : totalMinutes > 0
          ? 100
          : 0;

    return NextResponse.json({
      habit: { id: habit.id, name: habit.name, emoji: habit.emoji, trackTime: habit.trackTime },
      stats: {
        totalMinutes,
        avgMinutes: count > 0 ? Math.round(totalMinutes / count) : 0,
        count,
        vsPrevious,
      },
      byDay,
    });
  } catch (error) {
    return handleApiError(error, 'habits/[id]/time-analysis:GET');
  }
}
