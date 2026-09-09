// GET/POST /api/finance/savings-goals — target tabungan.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  asNumber,
  asString,
  badRequest,
  handleApiError,
  readJsonBody,
  requireNonEmptyString,
  requirePositiveNumber,
} from '@/app/api/_lib/api-utils';
import { serializeSavings, validateDeadlineDate } from '@/app/api/_lib/savings-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const goals = await db.savingsGoal.findMany({ orderBy: { createdAt: 'asc' } });
    return NextResponse.json({ goals: goals.map(serializeSavings) });
  } catch (error) {
    return handleApiError(error, 'finance/savings-goals:GET');
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);
    const name = requireNonEmptyString(body.name, 'Nama target tabungan wajib diisi');
    if (name.length > 120) throw badRequest('Nama target terlalu panjang');

    const emoji = asString(body.emoji);
    if (emoji !== null && emoji.length > 16) throw badRequest('Emoji tidak valid');

    const targetAmount = requirePositiveNumber(body.targetAmount, 'Target tabungan harus lebih dari 0');
    if (targetAmount > 1e12) throw badRequest('Target tabungan tidak valid');

    const currentAmount = asNumber(body.currentAmount) ?? 0;
    if (currentAmount < 0 || currentAmount > 1e12) throw badRequest('Saldo tabungan tidak valid');

    const deadline = body.deadline !== undefined ? validateDeadlineDate(body.deadline) : null;

    const data: Record<string, unknown> = { name, targetAmount, currentAmount };
    if (emoji !== null && emoji.trim()) data.emoji = emoji.trim();
    if (deadline !== null) data.deadline = deadline;
    if (currentAmount >= targetAmount) data.completedAt = new Date();

    const goal = await db.savingsGoal.create({
      data: data as Parameters<typeof db.savingsGoal.create>[0]['data'],
    });
    return NextResponse.json(serializeSavings(goal), { status: 201 });
  } catch (error) {
    return handleApiError(error, 'finance/savings-goals:POST');
  }
}
