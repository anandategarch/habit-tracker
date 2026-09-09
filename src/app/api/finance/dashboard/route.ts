// GET /api/finance/dashboard?month=yyyy-MM — ringkasan keuangan bulanan.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, handleApiError, round1, transactionMonthRange, ymdOf } from '@/app/api/_lib/api-utils';
import { isValidMonth, jakartaDateString, jakartaMonthString } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function daysInMonthOf(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  if (m === 2) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return leap ? 29 : 28;
  }
  return DAYS_IN_MONTH[m - 1];
}

export async function GET(req: Request) {
  try {
    const monthParam = new URL(req.url).searchParams.get('month');
    const month = monthParam ?? jakartaMonthString();
    if (!isValidMonth(month)) throw badRequest('Parameter month tidak valid (format yyyy-MM)');

    const range = transactionMonthRange(month);
    const [rows, categories] = await Promise.all([
      db.transaction.findMany({
        where: { type: { in: ['income', 'expense'] }, date: { gte: range.gte, lt: range.lt } },
        select: { type: true, amount: true, category: true, date: true },
      }),
      db.financeCategory.findMany(),
    ]);

    const catMeta = new Map(categories.map((c) => [c.name, { emoji: c.emoji, color: c.color }]));
    const fallbackMeta = { emoji: '💸', color: '#14b8a6' };

    // Filter ekstra YMD Jakarta (guard TZ server non-UTC).
    const inMonth = rows.filter((r) => ymdOf(r.date as Date).startsWith(month));

    let monthIncome = 0;
    let monthExpense = 0;
    const spentByCategory = new Map<string, number>();
    const spentByDay = new Map<string, number>();
    for (const tx of inMonth) {
      if (tx.type === 'income') {
        monthIncome += tx.amount;
        continue;
      }
      monthExpense += tx.amount;
      const ymd = ymdOf(tx.date as Date);
      spentByCategory.set(tx.category, (spentByCategory.get(tx.category) ?? 0) + tx.amount);
      spentByDay.set(ymd, (spentByDay.get(ymd) ?? 0) + tx.amount);
    }

    const byCategory = Array.from(spentByCategory.entries())
      .map(([category, amount]) => {
        const meta = catMeta.get(category) ?? fallbackMeta;
        return { category, amount: Math.round(amount), emoji: meta.emoji, color: meta.color };
      })
      .sort((a, b) => b.amount - a.amount || (a.category < b.category ? -1 : 1));

    const byDay = Array.from(spentByDay.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, amount]) => ({ date, amount: Math.round(amount) }));

    // Hari berjalan: bulan sekarang → sampai hari ini (Jakarta); bulan lampau → penuh.
    const currentMonth = jakartaMonthString();
    const todayYmd = jakartaDateString();
    const isCurrent = month === currentMonth;
    const daysTotal = daysInMonthOf(month);
    const elapsedDays = isCurrent ? Math.min(daysTotal, Number(todayYmd.slice(8, 10))) : daysTotal;

    const dailyAvg = elapsedDays > 0 ? round1(monthExpense / elapsedDays) : 0;
    const projection = Math.round(dailyAvg * daysTotal);

    // Hitung hari tanpa pengeluaran dalam rentang berjalan.
    let noSpendDays = 0;
    for (let d = 1; d <= elapsedDays; d += 1) {
      const ymd = `${month}-${String(d).padStart(2, '0')}`;
      if (!spentByDay.has(ymd)) noSpendDays += 1;
    }

    const top = byCategory[0] ?? null;

    return NextResponse.json({
      monthIncome: Math.round(monthIncome),
      monthExpense: Math.round(monthExpense),
      monthNet: Math.round(monthIncome - monthExpense),
      byCategory,
      byDay,
      dailyAvg,
      projection,
      noSpendDays,
      topCategory: top,
    });
  } catch (error) {
    return handleApiError(error, 'finance/dashboard:GET');
  }
}
