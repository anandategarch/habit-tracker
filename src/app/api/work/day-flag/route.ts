// POST /api/work/day-flag — atur Mode Libur per hari (Fase 2, Task 19).
// Body: { date: 'yyyy-MM-dd', holiday: boolean } → upsert WorkDayFlag.
// Mode Libur = rutinitas hari itu diliburkan (tidak dinilai, tidak merusak
// aktif/i-nya rutinitas); tugas lepas & catatan tetap jalan normal.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { asBool, badRequest, handleApiError, readJsonBody } from '@/app/api/_lib/api-utils';
import { isValidYMD } from '@/lib/timezone';
import { ensureWorkTables } from '@/app/api/_lib/work-ensure';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await ensureWorkTables();
    const body = await readJsonBody(req);

    if (typeof body.date !== 'string' || !isValidYMD(body.date)) {
      throw badRequest('Parameter date tidak valid (format yyyy-MM-dd)');
    }
    const holiday = asBool(body.holiday);
    if (holiday === null) throw badRequest('Nilai holiday tidak valid (boolean)');

    const flag = await db.workDayFlag.upsert({
      where: { dayKey: body.date },
      update: { holiday },
      create: { dayKey: body.date, holiday },
    });
    return NextResponse.json({ date: flag.dayKey, holiday: flag.holiday });
  } catch (error) {
    return handleApiError(error, 'work/day-flag:POST');
  }
}
