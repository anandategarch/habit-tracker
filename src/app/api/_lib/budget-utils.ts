// Helper budget: item + spent dihitung dari transaksi bulan tsb per kategori.
import { db } from '@/lib/db';
import { transactionMonthRange, ymdOf } from '@/app/api/_lib/api-utils';

export interface BudgetItemPayload {
  id: string;
  category: string;
  month: string;
  amount: number;
  spent: number;
  remaining: number;
  pct: number;
}

export async function fetchBudgetItems(month: string): Promise<BudgetItemPayload[]> {
  const range = transactionMonthRange(month);
  const [rows, txs] = await Promise.all([
    db.weeklyBudget.findMany({ where: { month }, orderBy: [{ category: 'asc' }] }),
    db.transaction.findMany({
      where: { type: 'expense', date: { gte: range.gte, lt: range.lt } },
      select: { category: true, amount: true, date: true },
    }),
  ]);
  const spentByCategory = new Map<string, number>();
  for (const tx of txs) {
    if (!ymdOf(tx.date as Date).startsWith(month)) continue;
    spentByCategory.set(tx.category, (spentByCategory.get(tx.category) ?? 0) + tx.amount);
  }
  return rows.map((r) => {
    const spent = Math.round((spentByCategory.get(r.category) ?? 0) * 100) / 100;
    const remaining = Math.round((r.amount - spent) * 100) / 100;
    const pct = r.amount > 0 ? Math.round((spent / r.amount) * 100) : 0;
    return { id: r.id, category: r.category, month: r.month, amount: r.amount, spent, remaining, pct };
  });
}
