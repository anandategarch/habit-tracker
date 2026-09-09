// GET/POST /api/finance/rules — aturan kategorisasi otomatis transaksi.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  asNumber,
  asString,
  badRequest,
  handleApiError,
  readJsonBody,
  requireNonEmptyString,
} from '@/app/api/_lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rules = await db.transactionRule.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json({ rules });
  } catch (error) {
    return handleApiError(error, 'finance/rules:GET');
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);
    const keyword = requireNonEmptyString(body.keyword, 'Kata kunci aturan wajib diisi');
    if (keyword.length > 120) throw badRequest('Kata kunci terlalu panjang');
    const category = requireNonEmptyString(body.category, 'Kategori aturan wajib diisi');
    if (category.length > 80) throw badRequest('Kategori terlalu panjang');

    let sourceId: string | null = null;
    if ('sourceId' in body && body.sourceId !== undefined && body.sourceId !== null && body.sourceId !== '') {
      const sid = asString(body.sourceId);
      if (sid === null || !sid.trim()) throw badRequest('Sumber dana tidak valid');
      const src = await db.fundSource.findUnique({ where: { id: sid }, select: { id: true } });
      if (!src) throw badRequest('Sumber dana tidak ditemukan');
      sourceId = sid;
    }

    let priority = 0;
    if ('priority' in body && body.priority !== undefined && body.priority !== null) {
      const p = asNumber(body.priority);
      if (p === null || !Number.isInteger(p) || p < 0 || p > 1000) {
        throw badRequest('Prioritas tidak valid');
      }
      priority = p;
    }

    const rule = await db.transactionRule.create({ data: { keyword, category, sourceId, priority } });
    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'finance/rules:POST');
  }
}
