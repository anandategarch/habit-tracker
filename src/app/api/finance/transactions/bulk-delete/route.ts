// POST /api/finance/transactions/bulk-delete { ids: string[] } → { deleted: n }.
// Transfer ikut menghapus pasangannya; deleteMany (bukan loop N+1).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, handleApiError, readJsonBody } from '@/app/api/_lib/api-utils';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);
    const ids = body.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw badRequest('ids harus berupa array ID transaksi');
    }
    if (ids.length > 2000) throw badRequest('Maksimal 2000 transaksi per penghapusan');
    const cleanIds = ids.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
    if (cleanIds.length === 0) throw badRequest('ids tidak berisi ID yang valid');

    let deleted = 0;
    await db.$transaction(async (tx) => {
      const rows = await tx.transaction.findMany({
        where: { id: { in: cleanIds } },
        select: { id: true, type: true, transferPairId: true },
      });
      const all = new Set<string>(cleanIds);
      for (const row of rows) {
        if (row.type !== 'transfer') continue;
        if (row.transferPairId) {
          all.add(row.transferPairId);
        } else {
          const sibling = await tx.transaction.findFirst({
            where: { transferPairId: row.id },
            select: { id: true },
          });
          if (sibling) all.add(sibling.id);
        }
      }
      await tx.transaction.updateMany({
        where: { transferPairId: { in: Array.from(all) } },
        data: { transferPairId: null },
      });
      const res = await tx.transaction.deleteMany({ where: { id: { in: Array.from(all) } } });
      deleted = res.count;
    });

    return NextResponse.json({ deleted });
  } catch (error) {
    return handleApiError(error, 'finance/transactions/bulk-delete:POST');
  }
}
