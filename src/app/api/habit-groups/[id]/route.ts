// PUT/DELETE /api/habit-groups/[id] — update grup; delete melepas habit dulu.
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
    const group = await db.habitGroup.findUnique({ where: { id } });
    if (!group) throw notFound('Grup tidak ditemukan');

    const body = await readJsonBody(req);
    const data: Record<string, unknown> = {};

    if ('name' in body) {
      const name = requireNonEmptyString(body.name, 'Nama grup wajib diisi');
      if (name.length > 80) throw badRequest('Nama grup terlalu panjang');
      data.name = name;
    }
    if ('color' in body) {
      const color = asString(body.color);
      if (color === null || !color.trim() || color.length > 20) throw badRequest('Warna tidak valid');
      data.color = color.trim();
    }
    if ('sortOrder' in body) {
      const sortOrder = asNumber(body.sortOrder);
      if (sortOrder === null || !Number.isInteger(sortOrder)) throw badRequest('Urutan tidak valid');
      data.sortOrder = sortOrder;
    }

    if (Object.keys(data).length === 0) throw badRequest('Tidak ada field yang bisa diperbarui');

    const updated = await db.habitGroup.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'habit-groups/[id]:PUT');
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const group = await db.habitGroup.findUnique({ where: { id }, select: { id: true } });
    if (!group) throw notFound('Grup tidak ditemukan');
    // SetNull manual: lepas groupId semua habit anggota sebelum hapus.
    await db.$transaction([
      db.habit.updateMany({ where: { groupId: id }, data: { groupId: null } }),
      db.habitGroup.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'habit-groups/[id]:DELETE');
  }
}
