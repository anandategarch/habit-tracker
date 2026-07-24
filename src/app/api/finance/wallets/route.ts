import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/finance/wallets
// Returns all fund sources with computed current balance
export async function GET() {
  try {
    const sources = await db.fundSource.findMany({
      orderBy: { order: 'asc' },
    });

    const transactions = await db.transaction.findMany({
      select: { source: true, type: true, amount: true },
    });

    // Compute balance per source
    const balanceMap: Record<string, { income: number; expense: number }> = {};
    transactions.forEach(t => {
      if (!balanceMap[t.source]) balanceMap[t.source] = { income: 0, expense: 0 };
      if (t.type === 'income') {
        balanceMap[t.source].income += t.amount;
      } else {
        balanceMap[t.source].expense += t.amount;
      }
    });

    const wallets = sources.map(s => {
      const tx = balanceMap[s.name] || { income: 0, expense: 0 };
      const currentBalance = s.balance + tx.income - tx.expense;
      return {
        id: s.id,
        name: s.name,
        emoji: s.emoji,
        balance: s.balance,
        currentBalance: Math.round(currentBalance * 100) / 100,
        totalIncome: Math.round(tx.income * 100) / 100,
        totalExpense: Math.round(tx.expense * 100) / 100,
        txCount: transactions.filter(t => t.source === s.name).length,
      };
    });

    // Also include "Kas" as default if no sources exist
    if (sources.length === 0) {
      const kasTx = transactions.filter(t => t.source === 'Kas');
      const kasIncome = kasTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const kasExpense = kasTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      wallets.push({
        id: '',
        name: 'Kas',
        emoji: '💵',
        balance: 0,
        currentBalance: Math.round((kasIncome - kasExpense) * 100) / 100,
        totalIncome: Math.round(kasIncome * 100) / 100,
        totalExpense: Math.round(kasExpense * 100) / 100,
        txCount: kasTx.length,
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
    return NextResponse.json([]);
  }
}