// GET/POST /api/goals — goal + milestones (JSON string ↔ array).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  asString,
  badRequest,
  handleApiError,
  readJsonBody,
  requireNonEmptyString,
} from '@/app/api/_lib/api-utils';
import { serializeGoal, validateDeadline, validateMilestones } from '@/app/api/_lib/goal-utils';

export const dynamic = 'force-dynamic';

const STATUSES = new Set(['active', 'completed', 'cancelled']);

export async function GET() {
  try {
    const goals = await db.goal.findMany({ orderBy: { createdAt: 'asc' } });
    return NextResponse.json({ goals: goals.map(serializeGoal) });
  } catch (error) {
    return handleApiError(error, 'goals:GET');
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);
    const title = requireNonEmptyString(body.title, 'Judul goal wajib diisi');
    if (title.length > 200) throw badRequest('Judul goal terlalu panjang');

    const description = asString(body.description);
    if (description !== null && description.length > 2000) throw badRequest('Deskripsi terlalu panjang');

    const priority = asString(body.priority);
    if (priority !== null && priority.length > 40) throw badRequest('Prioritas tidak valid');

    const status = asString(body.status) ?? 'active';
    if (!STATUSES.has(status)) throw badRequest('Status tidak valid (active, completed, atau cancelled)');

    let deadline: string | null = null;
    if (body.deadline !== undefined) deadline = validateDeadline(body.deadline);

    const data: Record<string, unknown> = { title, status };
    if (description !== null) data.description = description;
    if (priority !== null && priority.trim()) data.priority = priority.trim();
    if (deadline !== null) data.deadline = deadline;
    if (body.milestones !== undefined) data.milestones = validateMilestones(body.milestones);

    const goal = await db.goal.create({
      data: data as Parameters<typeof db.goal.create>[0]['data'],
    });
    return NextResponse.json(serializeGoal(goal), { status: 201 });
  } catch (error) {
    return handleApiError(error, 'goals:POST');
  }
}
