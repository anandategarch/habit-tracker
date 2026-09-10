// GET /api/finance/last-done — baris "Terakhir Transaksi" di overview.
// Mengembalikan 5 transaksi terbaru (semua tipe, semua waktu) sebagai
// LastDoneItem (field longgar — lihat finance-types.ts).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await db.transaction.findMany({
      orderBy: { date: 'desc', createdAt: 'desc' },
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
  } catch {
    return NextResponse.json({ transactions: [] });
  }
}
