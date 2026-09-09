// GET /api/habits/[id]/year-logs?year=yyyy — semua log habit pada tahun itu.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, handleApiError, notFound } from '@/app/api/_lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const habit = await db.habit.findUnique({ where: { id }, select: { id: true } });
    if (!habit) throw notFound('Habit tidak ditemukan');

    const year = new URL(req.url).searchParams.get('year') ?? '';
    if (!/^\d{4}$/.test(year)) throw badRequest('Parameter year tidak valid (format yyyy)');

    const start = new Date(Date.UTC(Number(year), 0, 1));
    const end = new Date(Date.UTC(Number(year), 11, 31));
    const logs = await db.habitLog.findMany({
      where: { habitId: id, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    });
    return NextResponse.json({ logs });
  } catch (error) {
    return handleApiError(error, 'habits/[id]/year-logs:GET');
  }
}
