// PUT/DELETE /api/goals/[id] — update partial (milestones di-serialize ulang).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  asString,
  badRequest,
  handleApiError,
  notFound,
  readJsonBody,
  requireNonEmptyString,
} from '@/app/api/_lib/api-utils';
import { serializeGoal, validateDeadline, validateMilestones } from '@/app/api/_lib/goal-utils';

export const dynamic = 'force-dynamic';

const STATUSES = new Set(['active', 'completed', 'cancelled']);

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const goal = await db.goal.findUnique({ where: { id } });
    if (!goal) throw notFound('Goal tidak ditemukan');

    const body = await readJsonBody(req);
    const data: Record<string, unknown> = {};

    if ('title' in body) {
      const title = requireNonEmptyString(body.title, 'Judul goal wajib diisi');
      if (title.length > 200) throw badRequest('Judul goal terlalu panjang');
      data.title = title;
    }
    if ('description' in body) {
      const description = asString(body.description);
      if (description !== null && description.length > 2000) throw badRequest('Deskripsi terlalu panjang');
      data.description = description ?? null;
    }
    if ('priority' in body) {
      const priority = asString(body.priority);
      if (priority === null || !priority.trim() || priority.length > 40) {
        throw badRequest('Prioritas tidak valid');
      }
      data.priority = priority.trim();
    }
    if ('status' in body) {
      const status = asString(body.status);
      if (status === null || !STATUSES.has(status)) {
        throw badRequest('Status tidak valid (active, completed, atau cancelled)');
      }
      data.status = status;
    }
    if ('deadline' in body) {
      data.deadline = validateDeadline(body.deadline);
    }
    if ('milestones' in body) {
      data.milestones = validateMilestones(body.milestones);
    }

    if (Object.keys(data).length === 0) throw badRequest('Tidak ada field yang bisa diperbarui');

    const updated = await db.goal.update({ where: { id }, data });
    return NextResponse.json(serializeGoal(updated));
  } catch (error) {
    return handleApiError(error, 'goals/[id]:PUT');
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const goal = await db.goal.findUnique({ where: { id }, select: { id: true } });
    if (!goal) throw notFound('Goal tidak ditemukan');
    // CONNECTED-APP (Task 49): lepas link habit → tujuan ini SEBELUM hapus,
    // supaya kartu habit tidak menampilkan chip tujuan yang sudah tidak ada
    // (schema onDelete: SetNull juga menangani, ini lapisan eksplisit).
    await db.habit.updateMany({ where: { goalId: id }, data: { goalId: null } });
    await db.goal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'goals/[id]:DELETE');
  }
}
