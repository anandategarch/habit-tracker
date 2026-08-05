import { db } from '@/lib/db';
import { signedDelta } from '@/lib/money';
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
      // BUG-2 fix: block editing of "Transfer Antar Sumber" transactions.
      // Editing one side of a transfer pair desyncs the pair and corrupts
      // balances (only one source adjusts, the other stays unchanged).
      if (existing.category === 'Transfer Antar Sumber') {
        throw new Error('TRANSFER_BLOCKED');
      }

      // Determine effective new values (fall back to existing).
      const newType = update.type ?? existing.type;
      const newAmount = update.amount ?? existing.amount;
      const newSource = update.source ?? existing.source;

      // Revert old effect on the OLD source (if it exists as a FundSource row).
      // Use atomic `increment` with the inverse delta to avoid the lost-update
      // race. Previously used a read-modify-write (`applyDelta(balance, ...)`),
      // which also corrupted the balance when the type flipped on the same
      // source — see worklog Task ID 2-a/2-c Critical bug.
      const oldFundSource = await tx.fundSource.findUnique({ where: { name: existing.source } });
      if (oldFundSource) {
        // Revert = apply the opposite delta of what was originally applied.
        // If original was income (+amount), revert is -amount. If expense,
        // revert is +amount. Equivalent to signedDelta(amount, inverseType).
        const revertDelta = -signedDelta(existing.amount, existing.type);
        await tx.fundSource.update({
          where: { id: oldFundSource.id },
          data: { balance: { increment: revertDelta } },
        });
      }

      // Apply new effect on the NEW source (if it exists as a FundSource row).
      // If newSource === existing.source, the row was already reverted above;
      // applying the new effect on top produces the correct final balance for
      // any combination of type/amount change.
      const newFundSource = newSource !== existing.source
        ? await tx.fundSource.findUnique({ where: { name: newSource } })
        : oldFundSource;
      if (newFundSource) {
        await tx.fundSource.update({
          where: { id: newFundSource.id },
          data: { balance: { increment: signedDelta(newAmount, newType) } },
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
    if (error instanceof Error && error.message === 'TRANSFER_BLOCKED') {
      return NextResponse.json(
        { error: 'Transaksi transfer tidak bisa diedit. Transfer adalah pasangan terhubung.' },
        { status: 400 }
      );
    }
    console.error('PUT /api/finance/transactions/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}

// DELETE /api/finance/transactions/[id]
// Reverts the transaction's effect on its fund source balance.
// BUG-1 fix: block deletion of "Transfer Antar Sumber" transactions.
// Transfer transactions come in linked pairs (expense from + income to).
// Deleting only one side corrupts balances (the other side's effect
// is never reverted). User must delete BOTH sides manually, or use
// the transfer endpoint to reverse a transfer.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    await db.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({ where: { id } });
      if (!existing) throw new Error('NOT_FOUND');
      if (existing.category === 'Transfer Antar Sumber') {
        throw new Error('TRANSFER_BLOCKED');
      }

      // Revert the effect on the fund source using an atomic increment
      // (no read-modify-write).
      const fundSource = await tx.fundSource.findUnique({ where: { name: existing.source } });
      if (fundSource) {
        const revertDelta = -signedDelta(existing.amount, existing.type);
        await tx.fundSource.update({
          where: { id: fundSource.id },
          data: { balance: { increment: revertDelta } },
        });
      }

      await tx.transaction.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'TRANSFER_BLOCKED') {
      return NextResponse.json(
        { error: 'Transaksi transfer tidak bisa dihapus. Hapus kedua sisi transfer (expense + income) secara manual.' },
        { status: 400 }
      );
    }
    console.error('DELETE /api/finance/transactions/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}
