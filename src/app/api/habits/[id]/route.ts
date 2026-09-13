// GET/PUT/DELETE /api/habits/[id] — detail, update partial + hapus (cascade log).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, handleApiError, notFound, readJsonBody } from '@/app/api/_lib/api-utils';
import { parseHabitFields } from '@/app/api/_lib/habit-fields';
import { ensureHabitGraduation } from '@/app/api/_lib/habit-ensure';

export const dynamic = 'force-dynamic';

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
