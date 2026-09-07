import { db } from '@/lib/db';
import {
  updateSavingsGoalSchema,
  adjustSavingsGoalSchema,
  parseOr400,
} from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

// PUT /api/finance/savings-goals/[id]
// Update a specific goal. Same two-branch logic as the collection PUT:
//  - `{ delta }` → quick adjust (Tambah Tabungan / Tarik).
//  - Full `updateSavingsGoalSchema` body → edit fields.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const existing = await db.savingsGoal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Savings goal not found' }, { status: 404 });
    }

    if (body && typeof body === 'object' && body.delta !== undefined) {
      const parsed = parseOr400(adjustSavingsGoalSchema, { delta: body.delta });
      if (!parsed.success) return parsed.response;
      const { delta } = parsed.data;
      // BUG-FIX-API-HIGH: wrap the read-modify-write in db.$transaction so
      // concurrent PUTs serialize against each other (no lost-update race).
      const result = await db.$transaction(async (tx) => {
        const existing = await tx.savingsGoal.findUnique({ where: { id } });
        if (!existing) return null;
        const next = Math.max(0, existing.currentAmount + delta);
        const wasCompleted = existing.isCompleted;
        const isCompleted = next >= existing.targetAmount;
        const updated = await tx.savingsGoal.update({
          where: { id },
          data: { currentAmount: next, isCompleted },
        });
        return { updated, wasCompleted, isCompleted, previousAmount: existing.currentAmount };
      });
      if (!result) {
        return NextResponse.json({ error: 'Savings goal not found' }, { status: 404 });
      }
      return NextResponse.json({
        ...result.updated,
        justCompleted: !result.wasCompleted && result.isCompleted,
        previousAmount: result.previousAmount,
      });
    }

    const parsed = parseOr400(updateSavingsGoalSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    const nextTarget = data.targetAmount ?? existing.targetAmount;
    const nextCurrent = data.currentAmount ?? existing.currentAmount;
    const wasCompleted = existing.isCompleted;
    const isCompleted =
      data.isCompleted !== undefined ? data.isCompleted : nextCurrent >= nextTarget;

    const updated = await db.savingsGoal.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.emoji !== undefined && { emoji: data.emoji }),
        ...(data.targetAmount !== undefined && { targetAmount: data.targetAmount }),
        ...(data.currentAmount !== undefined && { currentAmount: data.currentAmount }),
        ...(data.sourceName !== undefined && { sourceName: data.sourceName }),
        ...(data.deadline !== undefined && { deadline: data.deadline }),
        isCompleted,
      },
    });
    // BUG-PHASE12: mirror the collection PUT — return justCompleted +
    // previousAmount so the UI's edit-dialog handler can fire confetti
    // when currentAmount crosses target via the edit form.
    return NextResponse.json({
      ...updated,
      justCompleted: !wasCompleted && isCompleted,
      previousAmount: existing.currentAmount,
    });
  } catch (error) {
    console.error('PUT /api/finance/savings-goals/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update savings goal' }, { status: 500 });
  }
}

// DELETE /api/finance/savings-goals/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await db.savingsGoal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Savings goal not found' }, { status: 404 });
    }
    await db.savingsGoal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/finance/savings-goals/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete savings goal' }, { status: 500 });
  }
}
