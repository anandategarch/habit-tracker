// PUT/DELETE /api/finance/transactions/[id] — update + hapus pasangan transfer atomik.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  buildTransferMeta,
  handleApiError,
  notFound,
  readJsonBody,
  serializeTransaction,
  sourceInfoMap,
} from '@/app/api/_lib/api-utils';
import { parseTransactionFields } from '@/app/api/_lib/finance-fields';
import { ensureTransactionGroupId } from '@/app/api/_lib/transaction-ensure';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    // Task 60-f: query baris Transaction penuh (kolom groupId via DDL runtime).
    await ensureTransactionGroupId();
    const { id } = await ctx.params;
    const existing = await db.transaction.findUnique({ where: { id } });
    if (!existing) throw notFound('Transaksi tidak ditemukan');

    const body = await readJsonBody(req);
    const data = await parseTransactionFields(body, 'update', existing);
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Tidak ada field yang bisa diperbarui' }, { status: 400 });
    }

    const updated = await db.transaction.update({ where: { id }, data });
    const sources = await db.fundSource.findMany();
    const meta = buildTransferMeta(updated.type === 'transfer' ? [updated] : []);
    return NextResponse.json(serializeTransaction(updated, sourceInfoMap(sources), meta));
  } catch (error) {
    return handleApiError(error, 'finance/transactions/[id]:PUT');
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    // Task 60-f: query baris Transaction penuh (kolom groupId via DDL runtime).
    await ensureTransactionGroupId();
    const { id } = await ctx.params;
    const existing = await db.transaction.findUnique({ where: { id }, select: { id: true, type: true, transferPairId: true } });
    if (!existing) throw notFound('Transaksi tidak ditemukan');

    // Transfer: cari pasangan (dua arah) lalu hapus keduanya secara atomik.
    if (existing.type === 'transfer') {
      await db.$transaction(async (tx) => {
        const ids = new Set<string>([existing.id]);
        if (existing.transferPairId) {
          ids.add(existing.transferPairId);
        } else {
          const sibling = await tx.transaction.findFirst({
            where: { transferPairId: existing.id },
            select: { id: true },
          });
          if (sibling) ids.add(sibling.id);
        }
        // Nol-kan rujukan pasangan dulu (hindari urutan FK), lalu hapus keduanya.
        await tx.transaction.updateMany({
          where: { transferPairId: { in: Array.from(ids) } },
          data: { transferPairId: null },
        });
        await tx.transaction.deleteMany({ where: { id: { in: Array.from(ids) } } });
      });
      return NextResponse.json({ ok: true, deleted: 2 });
    }

    await db.transaction.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: 1 });
  } catch (error) {
    return handleApiError(error, 'finance/transactions/[id]:DELETE');
  }
}
