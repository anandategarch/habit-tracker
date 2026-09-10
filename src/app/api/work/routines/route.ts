// POST /api/work/routines — tambah rutinitas kerjaan berulang (Task 17-a).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { asNumber, badRequest, handleApiError, readJsonBody } from '@/app/api/_lib/api-utils';
import { ensureWorkTables } from '@/app/api/_lib/work-ensure';
import { parseTimeOfDay, requireTitle } from '@/app/api/_lib/work-fields';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await ensureWorkTables();
    const body = await readJsonBody(req);

    const title = requireTitle(body.title, 'Judul rutinitas');
    const timeOfDay =
      body.timeOfDay === undefined ? 'pagi' : parseTimeOfDay(body.timeOfDay);
    if (!timeOfDay) throw badRequest('Waktu rutinitas tidak valid (pagi, siang, atau sore)');
    const sortOrderRaw = asNumber(body.sortOrder);
    const sortOrder =
      sortOrderRaw !== null && Number.isInteger(sortOrderRaw) ? sortOrderRaw : 0;

    const routine = await db.workRoutine.create({
      data: { title, timeOfDay, sortOrder },
    });
    return NextResponse.json(
      { ...routine, createdAt: routine.createdAt.toISOString(), updatedAt: routine.updatedAt.toISOString(), doneToday: false, doneAt: null },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, 'work/routines:POST');
  }
}
