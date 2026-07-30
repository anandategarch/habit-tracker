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
    console.error('POST /api/finance/transactions/bulk-delete error:', error);
    return NextResponse.json({ error: 'Failed to delete transactions' }, { status: 500 });
  }
}
