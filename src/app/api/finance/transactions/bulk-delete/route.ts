import { db } from '@/lib/db';
import { signedDelta } from '@/lib/money';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'ids array is required').max(100, 'Maximum 100 items per batch'),
});

// POST /api/finance/transactions/bulk-delete
// Body: { ids: string[] }
// Reverts each transaction's effect on its fund source balance, then deletes.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bulkDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
    }
    const { ids } = parsed.data;

    const deleted = await db.$transaction(async (tx) => {
      const records = await tx.transaction.findMany({ where: { id: { in: ids } } });

      // BUG-7 fix: block bulk-delete of "Transfer Antar Sumber" transactions.
      // Transfer transactions are linked pairs — deleting one side orphans
      // the other and corrupts balances. Reject the entire batch if any
      // transfer transaction is included.
      const transferTx = records.find((t) => t.category === 'Transfer Antar Sumber');
      if (transferTx) {
        throw new Error('TRANSFER_BLOCKED');
      }

      // Revert each transaction's effect on its fund source using atomic
      // increments — no read-modify-write, no lost-update race.
      for (const t of records) {
        const fs = await tx.fundSource.findUnique({ where: { name: t.source } });
        if (fs) {
          const revertDelta = -signedDelta(t.amount, t.type);
          await tx.fundSource.update({ where: { id: fs.id }, data: { balance: { increment: revertDelta } } });
        }
      }

      const result = await tx.transaction.deleteMany({ where: { id: { in: ids } } });
      return result.count;
    });

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    if (error instanceof Error && error.message === 'TRANSFER_BLOCKED') {
      return NextResponse.json(
        { error: 'Tidak bisa hapus transaksi transfer via bulk-delete. Hapus manual kedua sisi.' },
        { status: 400 }
      );
    }
    console.error('POST /api/finance/transactions/bulk-delete error:', error);
    return NextResponse.json({ error: 'Failed to delete transactions' }, { status: 500 });
  }
}
