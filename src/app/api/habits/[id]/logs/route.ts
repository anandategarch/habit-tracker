// GET/POST /api/habits/[id]/logs — log bulanan + upsert partial per hari Jakarta.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  asBool,
  asNumber,
  asString,
  badRequest,
  clamp,
  handleApiError,
  notFound,
  readJsonBody,
} from '@/app/api/_lib/api-utils';
import { dateFromYMD, isValidMonth, isValidYMD, jakartaDateString, monthRangeYMD } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const habit = await db.habit.findUnique({ where: { id }, select: { id: true } });
    if (!habit) throw notFound('Habit tidak ditemukan');

    const month = new URL(req.url).searchParams.get('month');
    if (!month || !isValidMonth(month)) {
      throw badRequest('Parameter month tidak valid (format yyyy-MM)');
    }
    const { start, end } = monthRangeYMD(month);
    const logs = await db.habitLog.findMany({
      where: { habitId: id, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    });
    return NextResponse.json({ logs });
  } catch (error) {
    return handleApiError(error, 'habits/[id]/logs:GET');
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const habit = await db.habit.findUnique({ where: { id } });
    if (!habit) throw notFound('Habit tidak ditemukan');

    const body = await readJsonBody(req);
    const date = asString(body.date);
    if (!date || !isValidYMD(date)) throw badRequest('Format tanggal tidak valid (yyyy-MM-dd)');
    const todayYmd = jakartaDateString();
    if (date > todayYmd) {
      throw badRequest('Tidak bisa mencatat habit untuk tanggal yang akan datang');
    }

    const logDate = dateFromYMD(date);
    const maxValue = habit.habitType === 'amount' ? Math.max(1, habit.target) : 1;

    const update: Record<string, unknown> = {};
    const create: Record<string, unknown> = { habitId: id, date: logDate };

    // completed
    let completedProvided: boolean | null = null;
    if ('completed' in body) {
      completedProvided = asBool(body.completed);
      if (completedProvided === null) throw badRequest('Nilai completed tidak valid');
      update.completed = completedProvided;
    }

    // value (progress amount) — clamp 0..target, TIDAK me-reset field lain.
    if ('value' in body && body.value !== undefined && body.value !== null) {
      const value = asNumber(body.value);
      if (value === null) throw badRequest('Nilai value tidak valid');
      const clamped = Math.round(clamp(value, 0, maxValue));
      update.value = clamped;
      if (habit.habitType === 'amount') {
        // completed diturunkan dari progress amount.
        update.completed = clamped >= maxValue;
      } else {
        update.completed = clamped >= 1;
      }
    } else {
      // binary toggle tanpa value: progress amount lama dipertahankan.
    }

    // completedAt
    if ('completedAt' in body && body.completedAt !== undefined && body.completedAt !== null) {
      const completedAt = asString(body.completedAt);
      if (completedAt === null || Number.isNaN(new Date(completedAt).getTime())) {
        throw badRequest('Format completedAt tidak valid');
      }
      update.completedAt = new Date(completedAt);
    } else if (update.completed === true) {
      // M3-fix (mirror default create): toggle "selesai" TANPA completedAt
      // eksplisit (checkbox biasa / re-check setelah uncheck) kini men-set
      // completedAt = waktu server — sebelumnya path UPDATE membiarkan
      // completedAt null selamanya padahal path CREATE men-setnya. Nilai
      // eksplisit dari body (di atas) tetap tidak ditimpa.
      update.completedAt = update.completedAt ?? new Date();
    } else if (update.completed === false) {
      update.completedAt = null;
    }

    // notes
    if ('notes' in body && body.notes !== undefined) {
      const notes = asString(body.notes);
      if (notes !== null && notes.length > 2000) throw badRequest('Catatan terlalu panjang');
      update.notes = notes ?? null;
    }

    // Default create: completed mengikuti update (default true), value wajar.
    const createCompleted = (update.completed as boolean | undefined) ?? true;
    create.completed = createCompleted;
    create.value =
      (update.value as number | undefined) ??
      (habit.habitType === 'amount' ? (createCompleted ? maxValue : 0) : 1);
    if (update.completedAt !== undefined) create.completedAt = update.completedAt;
    else if (createCompleted) create.completedAt = new Date();
    if (update.notes !== undefined) create.notes = update.notes;

    const log = await db.habitLog.upsert({
      where: { habitId_date: { habitId: id, date: logDate } },
      update: update as Parameters<typeof db.habitLog.upsert>[0]['update'],
      create: create as Parameters<typeof db.habitLog.upsert>[0]['create'],
    });
    return NextResponse.json(log);
  } catch (error) {
    return handleApiError(error, 'habits/[id]/logs:POST');
  }
}
