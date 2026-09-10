// PUT/DELETE /api/finance/recurring/[id].
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, handleApiError, notFound, readJsonBody } from '@/app/api/_lib/api-utils';
import { parseRecurringFields } from '@/app/api/_lib/recurring-utils';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const existing = await db.recurringTransaction.findUnique({ where: { id } });
    if (!existing) throw notFound('Transaksi berulang tidak ditemukan');

    const body = await readJsonBody(req);
    const data = await parseRecurringFields(body, 'update');

    if (Object.keys(data).length === 0) throw badRequest('Tidak ada field yang bisa diperbarui');

    const startDate = (data.startDate as Date | undefined) ?? existing.startDate;
    const endDate = (data.endDate as Date | null | undefined) ?? existing.endDate;
    if (endDate && endDate.getTime() < startDate.getTime()) {
      throw badRequest('Tanggal berakhir tidak boleh sebelum tanggal mulai');
    }

    const updated = await db.recurringTransaction.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'finance/recurring/[id]:PUT');
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const existing = await db.recurringTransaction.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw notFound('Transaksi berulang tidak ditemukan');
    await db.recurringTransaction.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'finance/recurring/[id]:DELETE');
  }
}
