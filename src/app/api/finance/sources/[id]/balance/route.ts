import { db } from '@/lib/db';
import { updateBalanceSchema, parseOr400 } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

// PATCH /api/finance/sources/[id]/balance
// Update the balance of a fund source via an ADJUSTMENT TRANSACTION.
//
// Previously this route just SET the balance directly (no audit trail),
// which caused the balance to be "out of sync" with the transaction
// history — the balance history chart would show phantom inflows/outflows
// with no corresponding transaction.
//
// Now: computes the diff between the new balance and the current balance,
// then creates a "Penyesuaian Saldo" transaction (income if diff > 0,
// expense if diff < 0) and atomically increments the balance by the diff.
// This way:
//   - Balance is correct (incremented by diff → equals newBalance)
//   - Transaction history is accurate (adjustment is a real transaction)
//   - Balance history chart is correct (adjustment counted in netFlow)
//   - Audit trail exists (user can see + delete the adjustment if needed)
//
// Edge cases:
//   - diff === 0 → no-op (balance unchanged, no transaction created)
//   - diff > 0 → income transaction "Penyesuaian Saldo +"
//   - diff < 0 → expense transaction "Penyesuaian Saldo −"
//   - FundSource not found → 404
//
// Race safety: the read (findUnique) + write (update + create) happen
// inside a db.$transaction, so no concurrent transaction can interfere
// with the diff computation.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = parseOr400(updateBalanceSchema, body);
    if (!parsed.success) return parsed.response;
    const { balance: newBalance } = parsed.data;

    const result = await db.$transaction(async (tx) => {
      const existing = await tx.fundSource.findUnique({ where: { id } });
      if (!existing) {
        throw new Error('NOT_FOUND');
      }

      const currentBalance = existing.balance || 0;
      const diff = newBalance - currentBalance;

      // No change — no transaction needed
      if (diff === 0) {
        return { source: existing, diff: 0, transaction: null };
      }

      // Create adjustment transaction
      const type = diff > 0 ? 'income' : 'expense';
      const amount = Math.abs(diff);
      const categoryName = 'Penyesuaian Saldo';

      const transaction = await tx.transaction.create({
        data: {
          type,
          amount,
          category: categoryName,
          description: `Adjustment saldo ${existing.name}`,
          date: new Date(),
          source: existing.name,
        },
      });

      // Atomically increment the balance by the diff (positive or negative).
      // This is equivalent to SET balance = newBalance, but uses the atomic
      // increment operator (same pattern as the transactions POST route)
      // so it's safe under concurrent writes.
      const updatedSource = await tx.fundSource.update({
        where: { id },
        data: { balance: { increment: diff } },
      });

      return { source: updatedSource, diff, transaction };
    });

    return NextResponse.json({
      ...result.source,
      adjustment: result.transaction
        ? {
            type: result.transaction.type,
            amount: result.transaction.amount,
            diff: result.diff,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Sumber dana tidak ditemukan' }, { status: 404 });
    }
    console.error('PATCH /api/finance/sources/[id]/balance error:', error);
    return NextResponse.json({ error: 'Failed to update balance' }, { status: 500 });
  }
}
