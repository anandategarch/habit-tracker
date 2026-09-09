// PUT/DELETE /api/finance/rules/[id].
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  asNumber,
  asString,
  badRequest,
  handleApiError,
  notFound,
  readJsonBody,
  requireNonEmptyString,
} from '@/app/api/_lib/api-utils';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const existing = await db.transactionRule.findUnique({ where: { id } });
    if (!existing) throw notFound('Aturan transaksi tidak ditemukan');

    const body = await readJsonBody(req);
    const data: Record<string, unknown> = {};

    if ('keyword' in body) {
      const keyword = requireNonEmptyString(body.keyword, 'Kata kunci aturan wajib diisi');
      if (keyword.length > 120) throw badRequest('Kata kunci terlalu panjang');
      data.keyword = keyword;
    }
    if ('category' in body) {
      const category = requireNonEmptyString(body.category, 'Kategori aturan wajib diisi');
      if (category.length > 80) throw badRequest('Kategori terlalu panjang');
      data.category = category;
    }
    if ('sourceId' in body) {
      const raw = body.sourceId;
      if (raw === undefined || raw === null || raw === '') {
        data.sourceId = null;
      } else {
        const sid = asString(raw);
        if (sid === null || !sid.trim()) throw badRequest('Sumber dana tidak valid');
        const src = await db.fundSource.findUnique({ where: { id: sid }, select: { id: true } });
        if (!src) throw badRequest('Sumber dana tidak ditemukan');
        data.sourceId = sid;
      }
    }
    if ('priority' in body && body.priority !== undefined && body.priority !== null) {
      const p = asNumber(body.priority);
      if (p === null || !Number.isInteger(p) || p < 0 || p > 1000) {
        throw badRequest('Prioritas tidak valid');
      }
      data.priority = p;
    }

    if (Object.keys(data).length === 0) throw badRequest('Tidak ada field yang bisa diperbarui');

    const rule = await db.transactionRule.update({ where: { id }, data });
    return NextResponse.json(rule);
  } catch (error) {
    return handleApiError(error, 'finance/rules/[id]:PUT');
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const existing = await db.transactionRule.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw notFound('Aturan transaksi tidak ditemukan');
    await db.transactionRule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'finance/rules/[id]:DELETE');
  }
}
