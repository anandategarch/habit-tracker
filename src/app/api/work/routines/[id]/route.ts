// PATCH/DELETE /api/work/routines/[id] — edit / hapus rutinitas (Task 17-a).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  asBool,
  asNumber,
  badRequest,
  handleApiError,
  notFound,
  readJsonBody,
} from '@/app/api/_lib/api-utils';
import { ensureWorkTables } from '@/app/api/_lib/work-ensure';
import { parseTimeOfDay, requireTitle } from '@/app/api/_lib/work-fields';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureWorkTables();
    const { id } = await ctx.params;
    const existing = await db.workRoutine.findUnique({ where: { id } });
    if (!existing) throw notFound('Rutinitas tidak ditemukan');

    const body = await readJsonBody(req);
    const data: Record<string, unknown> = {};

    if ('title' in body) data.title = requireTitle(body.title, 'Judul rutinitas');
    if ('timeOfDay' in body) {
      const timeOfDay = parseTimeOfDay(body.timeOfDay);
      if (!timeOfDay) throw badRequest('Waktu rutinitas tidak valid (pagi, siang, atau sore)');
      data.timeOfDay = timeOfDay;
    }
    if ('active' in body) {
      const active = asBool(body.active);
      if (active === null) throw badRequest('Nilai active tidak valid');
      data.active = active;
    }
    if ('sortOrder' in body) {
      const sortOrder = asNumber(body.sortOrder);
      if (sortOrder === null || !Number.isInteger(sortOrder)) {
        throw badRequest('Nilai sortOrder tidak valid');
      }
      data.sortOrder = sortOrder;
    }
    if (Object.keys(data).length === 0) throw badRequest('Tidak ada field yang diubah');

    const routine = await db.workRoutine.update({
      where: { id },
      data: data as Parameters<typeof db.workRoutine.update>[0]['data'],
    });
    return NextResponse.json({
      ...routine,
      createdAt: routine.createdAt.toISOString(),
      updatedAt: routine.updatedAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error, 'work/routines/[id]:PATCH');
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureWorkTables();
    const { id } = await ctx.params;
    const existing = await db.workRoutine.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw notFound('Rutinitas tidak ditemukan');
    // Log ikut terhapus (onDelete: Cascade).
    await db.workRoutine.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'work/routines/[id]:DELETE');
  }
}
