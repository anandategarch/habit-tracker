// POST /api/work/routines/[id]/logs — toggle selesai rutinitas per hari (Task 17-a).
// Upsert pada unique (routineId, dayKey): done=true → doneAt=now, false → null.
// Pola ditiru dari /api/habits/[id]/logs.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { asBool, badRequest, handleApiError, notFound, readJsonBody } from '@/app/api/_lib/api-utils';
import { isValidYMD } from '@/lib/timezone';
import { ensureWorkTables } from '@/app/api/_lib/work-ensure';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureWorkTables();
    const { id } = await ctx.params;
    const routine = await db.workRoutine.findUnique({ where: { id }, select: { id: true } });
    if (!routine) throw notFound('Rutinitas tidak ditemukan');

    const body = await readJsonBody(req);
    const dayKeyRaw = typeof body.dayKey === 'string' ? body.dayKey : null;
    if (!dayKeyRaw || !isValidYMD(dayKeyRaw)) {
      throw badRequest('Format tanggal tidak valid (yyyy-MM-dd)');
    }
    const done = asBool(body.done);
    if (done === null) throw badRequest('Nilai done tidak valid');

    const now = new Date();
    const log = await db.workRoutineLog.upsert({
      where: { routineId_dayKey: { routineId: id, dayKey: dayKeyRaw } },
      update: { done, doneAt: done ? now : null },
      create: { routineId: id, dayKey: dayKeyRaw, done, doneAt: done ? now : null },
    });
    return NextResponse.json({
      ...log,
      doneAt: log.doneAt ? log.doneAt.toISOString() : null,
      createdAt: log.createdAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error, 'work/routines/[id]/logs:POST');
  }
}
