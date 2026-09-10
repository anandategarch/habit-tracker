// PUT/DELETE /api/habit-options/[id] — rename label dengan CASCADE ke Habit.
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

/** Kolom Habit yang sesuai tipe opsi (untuk cascade rename). */
const HABIT_COLUMN_BY_TYPE: Record<string, 'category' | 'priority' | 'difficulty' | 'unit'> = {
  category: 'category',
  priority: 'priority',
  difficulty: 'difficulty',
  unit: 'unit',
};

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const option = await db.habitOption.findUnique({ where: { id } });
    if (!option) throw notFound('Opsi tidak ditemukan');

    const body = await readJsonBody(req);
    const data: Record<string, unknown> = {};
    const oldLabel = option.label;

    if ('label' in body) {
      const label = requireNonEmptyString(body.label, 'Label opsi wajib diisi');
      if (label.length > 60) throw badRequest('Label opsi terlalu panjang');
      data.label = label;
    }
    if ('color' in body) {
      const color = asString(body.color);
      if (color !== null && color.length > 20) throw badRequest('Warna tidak valid');
      data.color = color && color.trim() ? color.trim() : null;
    }
    if ('sortOrder' in body) {
      const sortOrder = asNumber(body.sortOrder);
      if (sortOrder === null || !Number.isInteger(sortOrder)) throw badRequest('Urutan tidak valid');
      data.sortOrder = sortOrder;
    }

    if (Object.keys(data).length === 0) throw badRequest('Tidak ada field yang bisa diperbarui');

    const column = HABIT_COLUMN_BY_TYPE[option.type];
    const newLabel = data.label as string | undefined;

    const updated = await db.$transaction(async (tx) => {
      // Cascade rename: updateMany semua Habit yang memakai label lama.
      if (newLabel !== undefined && newLabel !== oldLabel && column) {
        await tx.habit.updateMany({
          where: { [column]: oldLabel },
          data: { [column]: newLabel },
        });
      }
      try {
        return await tx.habitOption.update({ where: { id }, data });
      } catch (e) {
        if ((e as { code?: string }).code === 'P2002') {
          throw badRequest('Opsi dengan label tersebut sudah ada');
        }
        throw e;
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'habit-options/[id]:PUT');
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const option = await db.habitOption.findUnique({ where: { id }, select: { id: true } });
    if (!option) throw notFound('Opsi tidak ditemukan');
    await db.habitOption.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'habit-options/[id]:DELETE');
  }
}
