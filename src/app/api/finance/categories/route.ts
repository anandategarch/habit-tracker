// GET/POST /api/finance/categories — kategori transaksi.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  asString,
  badRequest,
  handleApiError,
  readJsonBody,
  requireNonEmptyString,
} from '@/app/api/_lib/api-utils';

export const dynamic = 'force-dynamic';

const CATEGORY_TYPES = new Set(['expense', 'income']);

export async function GET() {
  try {
    const categories = await db.financeCategory.findMany({
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    return NextResponse.json({ categories });
  } catch (error) {
    return handleApiError(error, 'finance/categories:GET');
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);
    const name = requireNonEmptyString(body.name, 'Nama kategori wajib diisi');
    if (name.length > 80) throw badRequest('Nama kategori terlalu panjang');

    const emoji = asString(body.emoji);
    if (emoji !== null && emoji.length > 16) throw badRequest('Emoji tidak valid');

    const color = asString(body.color);
    if (color !== null && color.length > 20) throw badRequest('Warna tidak valid');

    const type = asString(body.type) ?? 'expense';
    if (!CATEGORY_TYPES.has(type)) throw badRequest('Tipe kategori tidak valid (expense atau income)');

    const data: Record<string, unknown> = { name, type };
    if (emoji !== null && emoji.trim()) data.emoji = emoji.trim();
    if (color !== null && color.trim()) data.color = color.trim();

    try {
      const category = await db.financeCategory.create({
        data: data as Parameters<typeof db.financeCategory.create>[0]['data'],
      });
      return NextResponse.json(category, { status: 201 });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw badRequest('Kategori dengan nama tersebut sudah ada');
      }
      throw e;
    }
  } catch (error) {
    return handleApiError(error, 'finance/categories:POST');
  }
}
