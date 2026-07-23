import { db } from '@/lib/db';
import { toMoneyInt, applyDelta } from '@/lib/money';
import { createTransactionSchema, parseOr400 } from '@/lib/validation';
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
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};

    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
      }
      const [year, mon] = month.split('-').map(Number);
      if (isNaN(year) || isNaN(mon) || mon < 1 || mon > 12) {
        return NextResponse.json({ error: 'Invalid month. Use YYYY-MM with valid month 01-12' }, { status: 400 });
      }
      const start = new Date(year, mon - 1, 1);
      const end = new Date(year, mon, 0, 23, 59, 59, 999);
      where.date = { gte: start, lte: end };
    }

    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
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

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { description: { contains: term } },
        { category: { contains: term } },
        { notes: { contains: term } },
      ];
    }

    const transactions = await db.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
    });

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
      const fundSource = await tx.fundSource.findUnique({ where: { name: sourceName } });
      if (fundSource) {
        const newBalance = applyDelta(fundSource.balance, amount, type);
        await tx.fundSource.update({
          where: { id: fundSource.id },
          data: { balance: newBalance },
        });
      }

      return tx_record;
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error('POST /api/finance/transactions error:', error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}
