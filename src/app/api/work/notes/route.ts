// POST /api/work/notes — catatan kilat / catatan panjang (Task 17-a, Task 26).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { asBool, badRequest, handleApiError, readJsonBody } from '@/app/api/_lib/api-utils';
import { ensureWorkTables } from '@/app/api/_lib/work-ensure';
import { cleanOptionalText, requireNoteContent } from '@/app/api/_lib/work-fields';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await ensureWorkTables();
    const body = await readJsonBody(req);

    const content = requireNoteContent(body.content);
    const tag = cleanOptionalText(body.tag, 'Tag catatan');
    const pinned = body.pinned === undefined ? false : asBool(body.pinned);
    if (pinned === null) throw badRequest('Nilai pinned tidak valid');

    const note = await db.workNote.create({
      data: { content, tag, pinned },
    });
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'work/notes:POST');
  }
}
