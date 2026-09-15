// GET /api/finance/daily-recap?date=yyyy-MM-dd — rekap transaksi harian.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  buildTransferMeta,
  badRequest,
  handleApiError,
  serializeTransaction,
  sourceInfoMap,
  transactionDayRange,
} from '@/app/api/_lib/api-utils';
import { isValidYMD, jakartaDateString } from '@/lib/timezone';
import { ensureTransactionGroupId } from '@/app/api/_lib/transaction-ensure';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // Task 60-f: query baris Transaction penuh (kolom groupId via DDL runtime).
    await ensureTransactionGroupId();
    const dateParam = new URL(req.url).searchParams.get('date');
    const date = dateParam ?? jakartaDateString();
    if (!isValidYMD(date)) throw badRequest('Parameter date tidak valid (format yyyy-MM-dd)');

    const range = transactionDayRange(date);
    const rows = await db.transaction.findMany({
      where: { date: { gte: range.gte, lt: range.lt } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    const sources = await db.fundSource.findMany();
    const meta = buildTransferMeta(rows.filter((r) => r.type === 'transfer'));
    const sourceMap = sourceInfoMap(sources);

    const totalIncome = rows.reduce((s, t) => s + (t.type === 'income' ? t.amount : 0), 0);
    const totalExpense = rows.reduce((s, t) => s + (t.type === 'expense' ? t.amount : 0), 0);

    return NextResponse.json({
      transactions: rows.map((t) => serializeTransaction(t, sourceMap, meta)),
      totalExpense: Math.round(totalExpense),
      totalIncome: Math.round(totalIncome),
    });
  } catch (error) {
    return handleApiError(error, 'finance/daily-recap:GET');
  }
}
