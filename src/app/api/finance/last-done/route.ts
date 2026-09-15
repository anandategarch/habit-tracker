// GET /api/finance/last-done — baris "Terakhir Transaksi" di overview.
// Mengembalikan 5 transaksi terbaru (semua tipe, semua waktu) sebagai
// LastDoneItem (field longgar — lihat finance-types.ts).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureTransactionGroupId } from '@/app/api/_lib/transaction-ensure';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Task 60-f: query baris Transaction penuh (kolom groupId via DDL runtime).
    await ensureTransactionGroupId();
    const rows = await db.transaction.findMany({
      // BUGHUNT-54 (3-a #1): bentuk objek 2-kunci DITOLAK Prisma 7
      // (PrismaClientValidationError) — pakai bentuk array.
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    });
    const sources = await db.fundSource.findMany();
    const nameById = new Map(sources.map((s) => [s.id, s.name]));

    const transactions = rows.map((t) => ({
      id: t.id,
      category: t.category,
      description: t.description,
      amount: t.amount,
      type: t.type as 'income' | 'expense' | 'transfer',
      date: t.date.toISOString(),
      lastDate: t.date.toISOString().slice(0, 10),
      count: 1,
      sourceName: t.sourceId ? (nameById.get(t.sourceId) ?? null) : null,
    }));
    return NextResponse.json({ transactions });
  } catch (e) {
    // BUGHUNT-54 (3-a #1): jangan telan error senyap — kegagalan Prisma dsb.
    // terlihat di log server (dulu catch kosong → selalu {transactions:[]}).
    console.error('[api/finance/last-done]', e);
    return NextResponse.json({ transactions: [] });
  }
}
