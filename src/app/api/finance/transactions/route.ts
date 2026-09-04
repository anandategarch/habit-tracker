import { db } from '@/lib/db';
import { toMoneyInt, signedDelta } from '@/lib/money';
import { createTransactionSchema, parseOr400 } from '@/lib/validation';
import { jakartaDateKey } from '@/lib/timezone';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/finance/transactions?month=2025-01&type=expense&search=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // yyyy-MM
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const source = searchParams.get('source');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    // FIN-BUG-6: `search` param intentionally not read server-side — see
    // comment below the filter section for details.

    const where: Record<string, unknown> = {};

    // BUG-8 fix: validate that month and startDate/endDate are mutually
    // exclusive. Previously both could be provided, causing the DB query
    // to use startDate/endDate while the post-query filter used month —
    // resulting in confusing, non-intuitive filter behavior.
    if (month && (startDate || endDate)) {
      return NextResponse.json(
        { error: 'Gunakan "month" ATAU "startDate/endDate", jangan keduanya bersamaan.' },
        { status: 400 }
      );
    }

    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
      }
      const [year, mon] = month.split('-').map(Number);
      if (isNaN(year) || isNaN(mon) || mon < 1 || mon > 12) {
        return NextResponse.json({ error: 'Invalid month. Use YYYY-MM with valid month 01-12' }, { status: 400 });
      }
      // Fetch a 7-day buffer around the month boundary to catch transactions
      // whose Jakarta date falls in this month but whose UTC epoch is in the
      // previous/next month (Jakarta is UTC+7, so 00:00-06:59 Jakarta on the
      // 1st has a UTC epoch on the last day of the previous month).
      // Post-query, we filter by jakartaDateKey to get the exact month.
      const start = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0, 0));
      // Subtract 7 hours to include Jakarta midnight of the 1st
      const fetchStart = new Date(start.getTime() - 7 * 60 * 60 * 1000);
      const end = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));
      // Add 7 hours to include Jakarta late-night of the last day
      const fetchEnd = new Date(end.getTime() + 7 * 60 * 60 * 1000);
      where.date = { gte: fetchStart, lte: fetchEnd };
    }

    if (startDate && endDate) {
      // FIX: browser URLSearchParams encodes '+' in timezone offset (+07:00)
      // as space. Decode properly before parsing.
      const s = new Date(decodeURIComponent(startDate).replace(/\s/g, '+'));
      const e = new Date(decodeURIComponent(endDate).replace(/\s/g, '+'));
      if (isNaN(s.getTime()) || isNaN(e.getTime())) {
        return NextResponse.json({ error: 'Invalid startDate or endDate' }, { status: 400 });
      }
      where.date = {
        ...(where.date as Record<string, unknown> || {}),
        gte: s,
        lte: e,
      };
    }

    if (type) {
      if (!['income', 'expense'].includes(type)) {
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
      }
      where.type = type;
    }

    if (category) where.category = category;
    if (source) where.source = source;

    // FIN-BUG-6 fix: removed server-side `search` (Prisma `contains` is
    // case-sensitive on SQLite, so searching "makan" missed "Makanan").
    // The client already does a case-insensitive `.toLowerCase().includes()`
    // filter on the month-scoped result set (finance.tsx line 724), so the
    // effective behavior was the intersection — case-sensitive. Dropping
    // the server-side filter lets the client's case-insensitive filter
    // work as intended. No client currently relies on server-side search
    // (all callers use `month` or `startDate/endDate` only); the `search`
    // URL param is still accepted for backward compat but ignored.

    // PERF-API-1 FIX-TIER1: cap results at 500 rows (safety net against
    // unbounded growth for long-term users) and `select` only the 7
    // columns the client actually consumes (id/type/amount/category/
    // description/date/source). Drops notes/groupId/createdAt/updatedAt
    // — ~30% payload reduction. The post-query month filter below only
    // touches `t.date`, which is included in the select.
    //
    // FIX-TIER3: type annotation narrowed to match the selected shape so
    // the reassignment below type-checks. Previously the variable was
    // annotated as the full Transaction type (all 11 columns), which
    // caused a TS2322 error after the `select` clause was added.
    type TransactionRow = {
      id: string;
      type: string;
      amount: number;
      category: string;
      description: string | null;
      date: Date;
      source: string;
    };
    let transactions: TransactionRow[] = [];
    try {
      transactions = await db.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        take: 500,
        select: {
          id: true,
          type: true,
          amount: true,
          category: true,
          description: true,
          date: true,
          source: true,
        },
      });
      // Post-query filter: if month param was given, filter by Jakarta date
      // key to get the exact month (the query fetched a 7h buffer on each
      // side to catch timezone-boundary transactions).
      if (month) {
        transactions = transactions.filter(
          (t) => jakartaDateKey(t.date).slice(0, 7) === month
        );
      }
    } catch (e) {
      console.error('GET /api/finance/transactions query failed:', e);
    }

    return NextResponse.json(transactions);
  } catch (error) {
    console.error('GET /api/finance/transactions error:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

// POST /api/finance/transactions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseOr400(createTransactionSchema, body);
    if (!parsed.success) return parsed.response;

    const { type, amount, category, description, date, notes, source } = parsed.data;
    const sourceName = source ?? 'Kas';

    // Atomic: create transaction AND update fund source balance in the same DB transaction.
    // If the fund source doesn't exist, we still create the transaction but skip balance update.
    const transaction = await db.$transaction(async (tx) => {
      const tx_record = await tx.transaction.create({
        data: {
          type,
          amount, // already a positive Int from schema transform
          category,
          description: description ?? null,
          date,
          notes: notes ?? null,
          source: sourceName,
        },
      });

      // Try to update fund source balance if a matching source exists.
      // Use Prisma's atomic `increment` operator to avoid the lost-update
      // race that a read-modify-write pattern would create under concurrent
      // writes (two POSTs reading the same balance and overwriting each
      // other). `increment` issues a single SQL `UPDATE ... SET balance =
      // balance + ?` which is atomic at the row level.
      const fundSource = await tx.fundSource.findUnique({ where: { name: sourceName } });
      if (fundSource) {
        await tx.fundSource.update({
          where: { id: fundSource.id },
          data: { balance: { increment: signedDelta(amount, type) } },
        });
        // NOTE: Balance check removed — personal finance app should allow
        // users to save transactions freely. Negative balance = visible
        // in UI (source card shows red), user manages their own overdraft.
        // Previously blocked expenses when source was negative, trapping
        // users who already had negative balance from a prior bug.
      }

      return tx_record;
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error('POST /api/finance/transactions error:', error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}
