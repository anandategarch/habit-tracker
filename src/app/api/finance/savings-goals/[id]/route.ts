// PUT/DELETE /api/finance/savings-goals/[id]
// PUT body {delta} → quick-chip (currentAmount += delta, clamp 0..target,
// completedAt terisi bila target tercapai). Body penuh → update field biasa.
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
  requirePositiveNumber,
} from '@/app/api/_lib/api-utils';
import { serializeSavings, validateDeadlineDate } from '@/app/api/_lib/savings-utils';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const goal = await db.savingsGoal.findUnique({ where: { id } });
    if (!goal) throw notFound('Target tabungan tidak ditemukan');

    const body = await readJsonBody(req);

    // ── Mode quick-chip: { delta } ──
    if ('delta' in body && body.delta !== undefined && body.delta !== null) {
      const delta = asNumber(body.delta);
      if (delta === null || delta === 0) throw badRequest('Nilai delta tidak valid');
      const target = Math.max(0, goal.targetAmount);
      const next = Math.min(target, Math.max(0, goal.currentAmount + delta));
      const reached = target > 0 && next >= target;
      const updated = await db.savingsGoal.update({
        where: { id },
        data: {
          currentAmount: next,
          completedAt: reached ? (goal.completedAt ?? new Date()) : null,
        },
      });
      return NextResponse.json(serializeSavings(updated));
    }

    // ── Mode body penuh ──
    const data: Record<string, unknown> = {};

    if ('name' in body) {
      const name = requireNonEmptyString(body.name, 'Nama target tabungan wajib diisi');
      if (name.length > 120) throw badRequest('Nama target terlalu panjang');
      data.name = name;
    }
    if ('emoji' in body) {
      const emoji = asString(body.emoji);
      if (emoji === null || !emoji.trim() || emoji.length > 16) throw badRequest('Emoji tidak valid');
      data.emoji = emoji.trim();
    }
    if ('targetAmount' in body) {
      const targetAmount = requirePositiveNumber(body.targetAmount, 'Target tabungan harus lebih dari 0');
      if (targetAmount > 1e12) throw badRequest('Target tabungan tidak valid');
      data.targetAmount = targetAmount;
    }
    if ('currentAmount' in body) {
      const currentAmount = asNumber(body.currentAmount);
      if (currentAmount === null || currentAmount < 0 || currentAmount > 1e12) {
        throw badRequest('Saldo tabungan tidak valid');
      }
      data.currentAmount = currentAmount;
    }
    if ('deadline' in body) {
      data.deadline = validateDeadlineDate(body.deadline);
    }

    if (Object.keys(data).length === 0) {
      throw badRequest('Kirim body lengkap atau { delta } untuk quick-chip');
    }

    const target = (data.targetAmount as number | undefined) ?? goal.targetAmount;
    const current = (data.currentAmount as number | undefined) ?? goal.currentAmount;
    const reached = target > 0 && current >= target;
    data.completedAt = reached ? (goal.completedAt ?? new Date()) : null;

    const updated = await db.savingsGoal.update({ where: { id }, data });
    return NextResponse.json(serializeSavings(updated));
  } catch (error) {
    return handleApiError(error, 'finance/savings-goals/[id]:PUT');
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const goal = await db.savingsGoal.findUnique({ where: { id }, select: { id: true } });
    if (!goal) throw notFound('Target tabungan tidak ditemukan');
    await db.savingsGoal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'finance/savings-goals/[id]:DELETE');
  }
}
