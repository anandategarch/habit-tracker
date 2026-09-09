// PATCH/DELETE /api/work/tasks/[id] — edit / hapus tugas lepas (Task 17-a).
// Status → 'selesai' otomatis men-set completedAt; keluar dari 'selesai' me-reset.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  asBool,
  badRequest,
  handleApiError,
  notFound,
  readJsonBody,
} from '@/app/api/_lib/api-utils';
import { isValidYMD } from '@/lib/timezone';
import { ensureWorkTables } from '@/app/api/_lib/work-ensure';
import { cleanOptionalText, parseTaskStatus, requireTitle } from '@/app/api/_lib/work-fields';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureWorkTables();
    const { id } = await ctx.params;
    const existing = await db.workTask.findUnique({ where: { id } });
    if (!existing) throw notFound('Tugas tidak ditemukan');

    const body = await readJsonBody(req);
    const data: Record<string, unknown> = {};

    if ('title' in body) data.title = requireTitle(body.title, 'Judul tugas');
    if ('notes' in body) data.notes = cleanOptionalText(body.notes, 'Catatan tugas');

    if ('dayKey' in body) {
      // null / '' → kapan saja; string harus YMD valid.
      if (body.dayKey === null || body.dayKey === '') {
        data.dayKey = null;
      } else {
        if (typeof body.dayKey !== 'string' || !isValidYMD(body.dayKey)) {
          throw badRequest('Format tanggal target tidak valid (yyyy-MM-dd)');
        }
        data.dayKey = body.dayKey;
      }
    }

    if ('status' in body) {
      const status = parseTaskStatus(body.status);
      if (!status) throw badRequest('Status tugas tidak valid (todo, jalan, nunggu, atau selesai)');
      data.status = status;
      if (status === 'selesai' && existing.status !== 'selesai') {
        data.completedAt = new Date();
      } else if (status !== 'selesai') {
        data.completedAt = null;
      }
    }

    if ('dueAt' in body) {
      if (body.dueAt === null || body.dueAt === '') {
        data.dueAt = null;
      } else {
        if (typeof body.dueAt !== 'string' || Number.isNaN(new Date(body.dueAt).getTime())) {
          throw badRequest('Format dueAt tidak valid');
        }
        data.dueAt = new Date(body.dueAt);
      }
    }

    // PATCH "completed" boolean alias → toggle selesai cepat.
    if ('completed' in body) {
      const completed = asBool(body.completed);
      if (completed === null) throw badRequest('Nilai completed tidak valid');
      data.status = completed ? 'selesai' : 'todo';
      data.completedAt = completed ? new Date() : null;
    }

    if (Object.keys(data).length === 0) throw badRequest('Tidak ada field yang diubah');

    const task = await db.workTask.update({
      where: { id },
      data: data as Parameters<typeof db.workTask.update>[0]['data'],
    });
    return NextResponse.json(task);
  } catch (error) {
    return handleApiError(error, 'work/tasks/[id]:PATCH');
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureWorkTables();
    const { id } = await ctx.params;
    const existing = await db.workTask.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw notFound('Tugas tidak ditemukan');
    await db.workTask.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'work/tasks/[id]:DELETE');
  }
}
