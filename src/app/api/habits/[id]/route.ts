// GET/PUT/DELETE /api/habits/[id] — detail, update partial + hapus (cascade log).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, handleApiError, notFound, readJsonBody } from '@/app/api/_lib/api-utils';
import { parseHabitFields } from '@/app/api/_lib/habit-fields';
import { ensureHabitGraduation } from '@/app/api/_lib/habit-ensure';
import { jakartaDateString } from '@/lib/timezone';
import { shiftYmd } from '@/lib/dashboard-helpers';
import {
  closeOpenVacationIntervals,
  parseVacationIntervals,
  serializeVacationIntervals,
  setLastOpenVacationUntil,
} from '@/lib/habit-vacation';

export const dynamic = 'force-dynamic';

/** Task 60-c (audit 59-b2 HIGH): rekonsiliasi interval liburan pada PUT.
 *
 *  - Mode NYALA (dari mati): buka interval baru {start: hari ini, until:
 *    tanggal akhir body (null = terbuka)}.
 *  - Mode tetap NYALA + until diubah: perbarui until interval terbuka.
 *  - Mode DIMATIKAN manual: tutup interval terbuka/di-masa-depan sampai
 *    KEMARIN (hari ini kembali ditrack normal) — interval lampau utuh.
 *  Interval tersimpan permanen → hari libur NETRAL di streak selamanya
 *  ("streak menyala kembali"), bahkan setelah kadaluarsa otomatis. */
function reconcileVacationIntervals(
  data: Record<string, unknown>,
  habit: { vacationMode: boolean; vacationIntervals: string | null },
): void {
  const vacRaw = data.vacationMode as boolean | undefined;
  const untilRaw = data.vacationUntil as Date | null | undefined;
  if (vacRaw === undefined && untilRaw === undefined) return;

  const todayYmd = jakartaDateString();
  const modeOn = vacRaw ?? habit.vacationMode;
  const intervals = parseVacationIntervals(habit.vacationIntervals);

  if (modeOn) {
    if (!habit.vacationMode) {
      const until = untilRaw ? jakartaDateString(untilRaw) : null;
      intervals.push({ start: todayYmd, until });
    } else if (untilRaw !== undefined) {
      setLastOpenVacationUntil(intervals, untilRaw ? jakartaDateString(untilRaw) : null);
    }
  } else if (habit.vacationMode) {
    // Dimatikan manual → tutup sampai kemarin (hari ini normal lagi).
    closeOpenVacationIntervals(intervals, shiftYmd(todayYmd, -1));
  }
  data.vacationIntervals = serializeVacationIntervals(intervals);
}

// FIX META-405: GET handler dulu TIDAK ADA — query ['habit-meta'] di
// time-analysis.tsx (dan semua deep-link 1-klik: dashboard insight,
// habit-master rows, last-done) menghitung 405 → dialog "Gagal memuat
// data habit" selamanya.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureHabitGraduation();
    const { id } = await ctx.params;
    const habit = await db.habit.findUnique({ where: { id } });
    if (!habit) throw notFound('Habit tidak ditemukan');
    return NextResponse.json(habit);
  } catch (error) {
    return handleApiError(error, 'habits/[id]:GET');
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureHabitGraduation();
    const { id } = await ctx.params;
    const habit = await db.habit.findUnique({ where: { id } });
    if (!habit) throw notFound('Habit tidak ditemukan');

    const body = await readJsonBody(req);
    const { data } = await parseHabitFields(body, 'update');

    // Clamp target terhadap habitType final (bisa berubah di body yang sama).
    const finalType = (data.habitType as string | undefined) ?? habit.habitType;
    if (data.target !== undefined) {
      data.target = finalType === 'amount' ? Math.max(1, Math.min(1000, data.target as number)) : 1;
    }

    // Task 60-c: rekonsiliasi interval liburan (menyimpan start/until permanen).
    reconcileVacationIntervals(data, habit);

    if (Object.keys(data).length === 0) throw badRequest('Tidak ada field yang bisa diperbarui');

    const updated = await db.habit.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'habits/[id]:PUT');
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const habit = await db.habit.findUnique({ where: { id }, select: { id: true } });
    if (!habit) throw notFound('Habit tidak ditemukan');
    // HabitLog.habit → onDelete: Cascade.
    await db.habit.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'habits/[id]:DELETE');
  }
}
