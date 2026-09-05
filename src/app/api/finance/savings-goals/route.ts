import { db } from '@/lib/db';
import {
  createSavingsGoalSchema,
  updateSavingsGoalSchema,
  adjustSavingsGoalSchema,
  parseOr400,
} from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/finance/savings-goals
// Returns all savings goals, ordered: incomplete first (by createdAt asc),
// then completed (by completedAt-equivalent = updatedAt desc).
export async function GET() {
  try {
    const goals = await db.savingsGoal.findMany({
      orderBy: [{ isCompleted: 'asc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json(goals);
  } catch (error) {
    console.error('GET /api/finance/savings-goals error:', error);
    return NextResponse.json([]);
  }
}

// POST /api/finance/savings-goals
// Create a new savings goal. Auto-marks isCompleted if currentAmount >= targetAmount.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseOr400(createSavingsGoalSchema, body);
    if (!parsed.success) return parsed.response;
    const { name, emoji, targetAmount, currentAmount, sourceName, deadline } = parsed.data;

    const finalCurrent = currentAmount ?? 0;
    if (finalCurrent >= targetAmount) {
      // Already met — mark completed on creation (e.g. user is recording an
      // already-achieved goal for tracking purposes).
      const goal = await db.savingsGoal.create({
        data: {
          name,
          emoji: emoji ?? '🎯',
          targetAmount,
          currentAmount: finalCurrent,
          sourceName: sourceName ?? null,
          deadline: deadline ?? null,
          isCompleted: true,
        },
      });
      return NextResponse.json(goal, { status: 201 });
    }

    const goal = await db.savingsGoal.create({
      data: {
        name,
        emoji: emoji ?? '🎯',
        targetAmount,
        currentAmount: finalCurrent,
        sourceName: sourceName ?? null,
        deadline: deadline ?? null,
        isCompleted: false,
      },
    });
    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    console.error('POST /api/finance/savings-goals error:', error);
    return NextResponse.json({ error: 'Failed to create savings goal' }, { status: 500 });
  }
}

// PUT /api/finance/savings-goals
// Update an existing goal by `id` in the body. Used by the UI's "Edit" dialog
// (name/emoji/target/deadline/source/currentAmount). Auto-marks isCompleted
// based on currentAmount vs targetAmount.
// Also accepts `{ id, delta }` for the Tambah Tabungan / Tarik quick-action:
// `delta` is the signed change (positive = tambah, negative = tarik). The
// resulting currentAmount is clamped to >= 0.
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || typeof body.id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    const { id } = body as { id: string };

    const existing = await db.savingsGoal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Savings goal not found' }, { status: 404 });
    }

    // ── Branch 1: quick adjust via `delta` ──────────────────────────────
    if (body.delta !== undefined) {
      const parsed = parseOr400(adjustSavingsGoalSchema, { delta: body.delta });
      if (!parsed.success) return parsed.response;
      const { delta } = parsed.data;
      const next = Math.max(0, existing.currentAmount + delta);
      const wasCompleted = existing.isCompleted;
      const isCompleted = next >= existing.targetAmount;
      const updated = await db.savingsGoal.update({
        where: { id },
        data: { currentAmount: next, isCompleted },
      });
      return NextResponse.json({
        ...updated,
        // The UI uses these flags to fire confetti when a goal flips from
        // incomplete → completed on this adjust call.
        justCompleted: !wasCompleted && isCompleted,
        previousAmount: existing.currentAmount,
      });
    }

    // ── Branch 2: full edit via updateSavingsGoalSchema ─────────────────
    // Strip `id` before validation (schema doesn't include it).
    const { id: _omit, ...rest } = body as Record<string, unknown>;
    void _omit;
    const parsed = parseOr400(updateSavingsGoalSchema, rest);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    // Compute the next target/current to evaluate isCompleted.
    const nextTarget = data.targetAmount ?? existing.targetAmount;
    const nextCurrent = data.currentAmount ?? existing.currentAmount;
    // If the caller explicitly passes isCompleted, honor it. Otherwise derive.
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
    // BUG-PHASE12: full-edit branch previously returned the bare updated
    // record. The UI's edit-dialog handler checks `data.justCompleted` to
    // fire confetti when currentAmount crosses target via the edit form —
    // but the flag was missing, so completing a goal via Edit → set
    // currentAmount never celebrated. Now we mirror the delta branch.
    return NextResponse.json({
      ...updated,
      justCompleted: !wasCompleted && isCompleted,
      previousAmount: existing.currentAmount,
    });
  } catch (error) {
    console.error('PUT /api/finance/savings-goals error:', error);
    return NextResponse.json({ error: 'Failed to update savings goal' }, { status: 500 });
  }
}

// DELETE /api/finance/savings-goals
// Delete a goal by `id` in the body. (The [id] route also supports URL-param DELETE.)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const id = (body as { id?: string } | undefined)?.id;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    const existing = await db.savingsGoal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Savings goal not found' }, { status: 404 });
    }
    await db.savingsGoal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/finance/savings-goals error:', error);
    return NextResponse.json({ error: 'Failed to delete savings goal' }, { status: 500 });
  }
}
