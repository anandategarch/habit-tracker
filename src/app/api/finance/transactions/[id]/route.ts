import { db } from '@/lib/db';
import { applyDelta, inverseType } from '@/lib/money';
import { updateTransactionSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/finance/transactions/[id]
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const transaction = await db.transaction.findUnique({ where: { id } });
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }
    return NextResponse.json(transaction);
  } catch (error) {
    console.error('GET /api/finance/transactions/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 });
  }
}

// PUT /api/finance/transactions/[id]
// If amount/type/source changes, the fund source balance is adjusted atomically:
// the old effect is reverted and the new effect is applied.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = parseOr400(updateTransactionSchema, body);
    if (!parsed.success) return parsed.response;

    const update = parsed.data;

    const transaction = await db.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({ where: { id } });
      if (!existing) throw new Error('NOT_FOUND');

      // Determine effective new values (fall back to existing).
      const newType = update.type ?? existing.type;
      const newAmount = update.amount ?? existing.amount;
      const newSource = update.source ?? existing.source;

      // Revert old effect on the OLD source (if it exists as a FundSource row).
      const oldFundSource = await tx.fundSource.findUnique({ where: { name: existing.source } });
      if (oldFundSource) {
        const reverted = applyDelta(oldFundSource.balance, existing.amount, inverseType(existing.type));
        await tx.fundSource.update({
          where: { id: oldFundSource.id },
          data: { balance: reverted },
        });
      }

      // Apply new effect on the NEW source (if it exists as a FundSource row).
      if (newSource !== existing.source) {
        const newFundSource = await tx.fundSource.findUnique({ where: { name: newSource } });
        if (newFundSource) {
          const applied = applyDelta(newFundSource.balance, newAmount, newType);
          await tx.fundSource.update({
            where: { id: newFundSource.id },
            data: { balance: applied },
          });
        }
      } else if (oldFundSource) {
        // Same source, just apply the delta of (new - old).
        const delta = newType === 'income'
          ? (newAmount - existing.amount)
          : -(newAmount - existing.amount);
        await tx.fundSource.update({
          where: { id: oldFundSource.id },
          data: { balance: oldFundSource.balance + delta },
        });
      }

      const updateData: Record<string, unknown> = {};
      if (update.type !== undefined) updateData.type = newType;
      if (update.amount !== undefined) updateData.amount = newAmount;
      if (update.category !== undefined) updateData.category = update.category;
      if (update.description !== undefined) updateData.description = update.description;
      if (update.date !== undefined) updateData.date = update.date;
      if (update.notes !== undefined) updateData.notes = update.notes;
      if (update.source !== undefined) updateData.source = newSource;

      return tx.transaction.update({ where: { id }, data: updateData });
    });

    return NextResponse.json(transaction);
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }
    console.error('PUT /api/finance/transactions/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}

// DELETE /api/finance/transactions/[id]
// Reverts the transaction's effect on its fund source balance.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    await db.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({ where: { id } });
      if (!existing) throw new Error('NOT_FOUND');

      // Revert the effect on the fund source.
      const fundSource = await tx.fundSource.findUnique({ where: { name: existing.source } });
      if (fundSource) {
        const reverted = applyDelta(fundSource.balance, existing.amount, inverseType(existing.type));
        await tx.fundSource.update({
          where: { id: fundSource.id },
          data: { balance: reverted },
        });
      }

      await tx.transaction.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }
    console.error('DELETE /api/finance/transactions/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}
