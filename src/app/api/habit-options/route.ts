// GET/POST /api/habit-options?type=category|priority|difficulty — opsi label habit.
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

const OPTION_TYPES = new Set(['category', 'priority', 'difficulty', 'unit']);

export async function GET(req: Request) {
  try {
    const type = new URL(req.url).searchParams.get('type');
    if (type !== null && !OPTION_TYPES.has(type)) {
      throw badRequest('Tipe opsi tidak valid (category, priority, atau difficulty)');
    }
    const options = await db.habitOption.findMany({
      where: type ? { type } : undefined,
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
    });
    return NextResponse.json({ options });
  } catch (error) {
    return handleApiError(error, 'habit-options:GET');
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);
    const type = asString(body.type);
    if (type === null || !OPTION_TYPES.has(type)) {
      throw badRequest('Tipe opsi tidak valid (category, priority, atau difficulty)');
    }
    const label = requireNonEmptyString(body.label, 'Label opsi wajib diisi');
    if (label.length > 60) throw badRequest('Label opsi terlalu panjang');

    const color = asString(body.color);
    if (color !== null && color.length > 20) throw badRequest('Warna tidak valid');

    const sortOrder = asNumber(body.sortOrder);
    if (sortOrder !== null && !Number.isInteger(sortOrder)) throw badRequest('Urutan tidak valid');

    const data: Record<string, unknown> = { type, label };
    if (color !== null && color.trim()) data.color = color.trim();
    if (sortOrder !== null) data.sortOrder = sortOrder;

    try {
      const option = await db.habitOption.create({
        data: data as Parameters<typeof db.habitOption.create>[0]['data'],
      });
      return NextResponse.json(option, { status: 201 });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw badRequest('Opsi dengan label tersebut sudah ada');
      }
      throw e;
    }
  } catch (error) {
    return handleApiError(error, 'habit-options:POST');
  }
}
