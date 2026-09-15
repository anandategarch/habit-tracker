// GET /api/habits/batch-logs?month=yyyy-MM&ids=id1,id2 — log banyak habit sebulan.
// Alias param `habitIds` diterima juga (kompatibilitas pemanggil lama).
// Task 60-e (audit 59-b2 MED-LOW): param aditif `from=yyyy-MM` — memperluas
// batas bawah rentang (default: awal `month`; tracker memakai month-11 supaya
// streak & flip-card tidak terpotong jendela 2 bulan lama). Tanpa `from`
// perilaku persis seperti dulu (kompatibel mundur).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, handleApiError } from '@/app/api/_lib/api-utils';
import { isValidMonth, monthRangeYMD } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const month = params.get('month');
    if (!month || !isValidMonth(month)) {
      throw badRequest('Parameter month tidak valid (format yyyy-MM)');
    }
    // Task 60-e: batas bawah rentang opsional — harus bulan valid & tidak
    // melebihi bulan tampil (from > month diabaikan senyap, pakai month).
    const fromParam = params.get('from');
    const from = fromParam && isValidMonth(fromParam) && fromParam <= month ? fromParam : null;

    const idsRaw = params.get('ids') ?? params.get('habitIds') ?? '';
    let ids = idsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      // Default: semua habit aktif.
      const habits = await db.habit.findMany({
        where: { isActive: true, isArchived: false },
        select: { id: true },
      });
      ids = habits.map((h) => h.id);
    }

    const { start, end } = monthRangeYMD(month);
    const rangeStart = from ? monthRangeYMD(from).start : start;
    const logs = ids.length
      ? await db.habitLog.findMany({
          where: { habitId: { in: ids }, date: { gte: rangeStart, lte: end } },
          orderBy: [{ date: 'asc' }, { habitId: 'asc' }],
        })
      : [];
    return NextResponse.json({ logs });
  } catch (error) {
    return handleApiError(error, 'habits/batch-logs:GET');
  }
}
