// POST /api/work/tasks — tambah tugas lepas (Task 17-a).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, handleApiError, readJsonBody } from '@/app/api/_lib/api-utils';
import { isValidYMD } from '@/lib/timezone';
import { ensureWorkTables } from '@/app/api/_lib/work-ensure';
import { cleanOptionalText, parseTaskStatus, requireTitle } from '@/app/api/_lib/work-fields';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await ensureWorkTables();
    const body = await readJsonBody(req);

    const title = requireTitle(body.title, 'Judul tugas');
    const notes = cleanOptionalText(body.notes, 'Catatan tugas');

    // dayKey: kosong/null = kapan saja; kalau diisi harus YMD valid.
    let dayKey: string | null = null;
    if (body.dayKey !== undefined && body.dayKey !== null && body.dayKey !== '') {
      if (typeof body.dayKey !== 'string' || !isValidYMD(body.dayKey)) {
        throw badRequest('Format tanggal target tidak valid (yyyy-MM-dd)');
      }
      dayKey = body.dayKey;
    }

    const status = body.status === undefined ? 'todo' : parseTaskStatus(body.status);
    if (!status) throw badRequest('Status tugas tidak valid (todo, jalan, nunggu, atau selesai)');

    const task = await db.workTask.create({
      data: {
        title,
        notes,
        dayKey,
        status,
        // Tugas langsung dibuat selesai (jarang, tapi API terbuka): set completedAt.
        ...(status === 'selesai' ? { completedAt: new Date() } : {}),
      },
    });
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'work/tasks:POST');
  }
}
