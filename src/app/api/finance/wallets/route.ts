import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/finance/wallets
// Returns all fund sources with computed current balance
export async function GET() {
  try {
    const sources = await db.fundSource.findMany({
      orderBy: { order: 'asc' },
    });

    // Aggregate income/expense per source in ONE query instead of loading all transactions
    const aggregations = await db.transaction.groupBy({
      by: ['source', 'type'],
      _sum: { amount: true },
      _count: true,
    });

    // Build per-source income/expense/count from aggregation
    const sourceAgg = new Map<string, { income: number; expense: number; count: number }>();
    for (const agg of aggregations) {
      if (!sourceAgg.has(agg.source)) sourceAgg.set(agg.source, { income: 0, expense: 0, count: 0 });
      const entry = sourceAgg.get(agg.source)!;
      if (agg.type === 'income') {
        entry.income += agg._sum.amount || 0;
      } else {
        entry.expense += agg._sum.amount || 0;
      }
      entry.count += agg._count;
    }

    const wallets = sources.map(s => {
      const agg = sourceAgg.get(s.name) || { income: 0, expense: 0, count: 0 };
      const currentBalance = s.balance + agg.income - agg.expense;
      return {
        id: s.id,
        name: s.name,
        emoji: s.emoji,
        balance: s.balance,
        currentBalance: Math.round(currentBalance * 100) / 100,
        totalIncome: Math.round(agg.income * 100) / 100,
        totalExpense: Math.round(agg.expense * 100) / 100,
        txCount: agg.count,
      };
    });

    // Also include "Kas" as default if no sources exist
    if (sources.length === 0) {
      const kasAgg = sourceAgg.get('Kas') || { income: 0, expense: 0, count: 0 };
      wallets.push({
        id: '',
        name: 'Kas',
        emoji: '💵',
        balance: 0,
        currentBalance: Math.round((kasAgg.income - kasAgg.expense) * 100) / 100,
        totalIncome: Math.round(kasAgg.income * 100) / 100,
        totalExpense: Math.round(kasAgg.expense * 100) / 100,
        txCount: kasAgg.count,
      });
    }

    const totalBalance = wallets.reduce((s, w) => s + w.currentBalance, 0);
    const totalIncome = wallets.reduce((s, w) => s + w.totalIncome, 0);
    const totalExpense = wallets.reduce((s, w) => s + w.totalExpense, 0);

    return NextResponse.json({
      wallets,
      totalBalance: Math.round(totalBalance * 100) / 100,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
    });
  } catch (error) {
    console.error('GET /api/finance/wallets error:', error);
    return NextResponse.json({ error: 'Failed to fetch wallets' }, { status: 500 });
  }
}