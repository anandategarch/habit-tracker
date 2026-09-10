// PATCH/DELETE /api/work/notes/[id] — edit / pin / hapus catatan (Task 17-a,
// Task 26: isi kini markdown-lite hingga 5.000 karakter).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { asBool, badRequest, handleApiError, notFound, readJsonBody } from '@/app/api/_lib/api-utils';
import { ensureWorkTables } from '@/app/api/_lib/work-ensure';
import { cleanOptionalText, requireNoteContent } from '@/app/api/_lib/work-fields';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureWorkTables();
    const { id } = await ctx.params;
    const existing = await db.workNote.findUnique({ where: { id } });
    if (!existing) throw notFound('Catatan tidak ditemukan');

    const body = await readJsonBody(req);
    const data: Record<string, unknown> = {};

    if ('content' in body) data.content = requireNoteContent(body.content);
    if ('tag' in body) {
      // tag '' → hapus tag (null); string apa pun dibersihkan.
      if (body.tag === null || body.tag === '') data.tag = null;
      else data.tag = cleanOptionalText(body.tag, 'Tag catatan');
    }
    if ('pinned' in body) {
      const pinned = asBool(body.pinned);
      if (pinned === null) throw badRequest('Nilai pinned tidak valid');
      data.pinned = pinned;
    }
    if (Object.keys(data).length === 0) throw badRequest('Tidak ada field yang diubah');

    const note = await db.workNote.update({
      where: { id },
      data: data as Parameters<typeof db.workNote.update>[0]['data'],
    });
    return NextResponse.json(note);
  } catch (error) {
    return handleApiError(error, 'work/notes/[id]:PATCH');
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureWorkTables();
    const { id } = await ctx.params;
    const existing = await db.workNote.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw notFound('Catatan tidak ditemukan');
    await db.workNote.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'work/notes/[id]:DELETE');
  }
}
