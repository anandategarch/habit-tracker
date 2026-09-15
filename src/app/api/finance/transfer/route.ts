// POST /api/finance/transfer — buat pasangan 2 transaksi type='transfer'
// (saling menunjuk via transferPairId; kaki keluar 'Transfer Keluar', kaki
// masuk 'Transfer Masuk') + fee expense terpisah (opsional).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  asNumber,
  asString,
  badRequest,
  buildTransferMeta,
  handleApiError,
  readJsonBody,
  requirePositiveNumber,
  serializeTransaction,
  sourceInfoMap,
  transactionDate,
} from '@/app/api/_lib/api-utils';
import { isValidYMD } from '@/lib/timezone';
import { ensureTransactionGroupId } from '@/app/api/_lib/transaction-ensure';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Task 60-f: query baris Transaction penuh (kolom groupId via DDL runtime).
    await ensureTransactionGroupId();
    const body = await readJsonBody(req);

    const fromSourceId = asString(body.fromSourceId);
    const toSourceId = asString(body.toSourceId);
    if (!fromSourceId || !fromSourceId.trim()) throw badRequest('Sumber asal wajib dipilih');
    if (!toSourceId || !toSourceId.trim()) throw badRequest('Sumber tujuan wajib dipilih');
    if (fromSourceId === toSourceId) {
      throw badRequest('Sumber asal dan tujuan tidak boleh sama');
    }

    const [from, to] = await Promise.all([
      db.fundSource.findUnique({ where: { id: fromSourceId }, select: { id: true, name: true } }),
      db.fundSource.findUnique({ where: { id: toSourceId }, select: { id: true, name: true } }),
    ]);
    if (!from) throw badRequest('Sumber asal tidak ditemukan');
    if (!to) throw badRequest('Sumber tujuan tidak ditemukan');

    const amount = requirePositiveNumber(body.amount, 'Jumlah transfer harus lebih dari 0');
    const feeRaw = body.fee;
    const fee = feeRaw === undefined || feeRaw === null ? 0 : asNumber(feeRaw);
    if (fee === null || fee < 0 || fee > 1e12) throw badRequest('Biaya transfer tidak valid');

    const date = asString(body.date);
    if (!date || !isValidYMD(date)) throw badRequest('Format tanggal tidak valid (yyyy-MM-dd)');

    const description = asString(body.description) ?? 'Transfer antar sumber';
    if (description.length > 300) throw badRequest('Deskripsi terlalu panjang');

    const txDate = transactionDate(date, body.time);

    const result = await db.$transaction(async (tx) => {
      // 1) Kaki keluar (dari sumber asal) — pairId diisi setelah kaki masuk dibuat.
      const outLeg = await tx.transaction.create({
        data: {
          type: 'transfer',
          amount,
          category: 'Transfer Keluar',
          sourceId: from.id,
          description,
          tags: '',
          date: txDate,
        },
      });
      // 2) Kaki masuk (ke sumber tujuan) → menunjuk kaki keluar.
      const inLeg = await tx.transaction.create({
        data: {
          type: 'transfer',
          amount,
          category: 'Transfer Masuk',
          sourceId: to.id,
          description,
          tags: '',
          date: txDate,
          transferPairId: outLeg.id,
        },
      });
      // 3) Saling menunjuk: kaki keluar → kaki masuk.
      const outLinked = await tx.transaction.update({
        where: { id: outLeg.id },
        data: { transferPairId: inLeg.id },
      });
      // 4) Fee = transaksi expense terpisah dari sumber asal.
      const feeTx =
        fee > 0
          ? await tx.transaction.create({
              data: {
                type: 'expense',
                amount: fee,
                category: 'Transfer',
                sourceId: from.id,
                description: `${description} (biaya transfer)`,
                tags: '',
                date: txDate,
              },
            })
          : null;
      return { out: outLinked, in: inLeg, fee: feeTx };
    });

    const sources = await db.fundSource.findMany();
    const meta = buildTransferMeta([result.out, result.in]);
    const sourceMap = sourceInfoMap(sources);

    return NextResponse.json(
      {
        transactions: [
          serializeTransaction(result.out, sourceMap, meta),
          serializeTransaction(result.in, sourceMap, meta),
        ],
        fee: result.fee ? serializeTransaction(result.fee, sourceMap, new Map()) : null,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, 'finance/transfer:POST');
  }
}
