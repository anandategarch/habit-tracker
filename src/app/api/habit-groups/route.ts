// GET/POST/DELETE /api/habit-groups — grup habit.
// DELETE menerima ?id= (kompatibilitas) selain /api/habit-groups/[id].
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

export async function GET() {
  try {
    const groups = await db.habitGroup.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return NextResponse.json({ groups });
  } catch (error) {
    return handleApiError(error, 'habit-groups:GET');
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);
    const name = requireNonEmptyString(body.name, 'Nama grup wajib diisi');
    if (name.length > 80) throw badRequest('Nama grup terlalu panjang');

    const color = asString(body.color);
    if (color !== null && color.length > 20) throw badRequest('Warna tidak valid');

    const sortOrder = asNumber(body.sortOrder);
    if (sortOrder !== null && !Number.isInteger(sortOrder)) throw badRequest('Urutan tidak valid');

    const data: Record<string, unknown> = { name };
    if (color !== null && color.trim()) data.color = color.trim();
    if (sortOrder !== null) data.sortOrder = sortOrder;

    const group = await db.habitGroup.create({
      data: data as Parameters<typeof db.habitGroup.create>[0]['data'],
    });
    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'habit-groups:POST');
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id || !id.trim()) throw badRequest('Parameter id wajib diisi');
    const group = await db.habitGroup.findUnique({ where: { id }, select: { id: true } });
    if (!group) throw notFound('Grup tidak ditemukan');
    // Lepas groupId habit dulu (SetNull manual → aman dari FK).
    await db.$transaction([
      db.habit.updateMany({ where: { groupId: id }, data: { groupId: null } }),
      db.habitGroup.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'habit-groups:DELETE');
  }
}
