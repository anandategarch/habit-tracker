// GET /api/finance/dashboard?month=yyyy-MM — ringkasan keuangan bulanan.
// Task 40 (DASHBOARD-FIN): diperluas jadi mesin KPI dashboard keuangan —
// rasio tabungan, perbandingan bulan lalu (MoM), pemakaian budget, dan
// dana darurat (runway). Referensi KPI: savings rate + emergency fund
// (Quicken "5 Personal Finance KPIs", Klipfolio "KPIs of personal
// finance", CFPB emergency fund guide — benchmark sehat ≥ 20% tabungan
// dan 3–6 bulan biaya hidup).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, handleApiError, round1, transactionMonthRange, ymdOf } from '@/app/api/_lib/api-utils';
import { fetchBudgetItems } from '@/app/api/_lib/budget-utils';
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

function prevMonthOf(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (m <= 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
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

    // ── DASHBOARD-FIN (Task 40): KPI tambahan ─────────────────────────────
    // Semua field optional di FE — route tetap kompatibel dgn caller lama.

    // 1) Rasio tabungan: (pemasukan − pengeluaran) / pemasukan. Null saat
    //    pemasukan 0 (membagi 0 → NaN/menyesatkan; FE tampil "—").
    const savingsRate = monthIncome > 0
      ? Math.round(((monthIncome - monthExpense) / monthIncome) * 1000) / 10
      : null;

    // 2) Bulan lalu (MoM) — total income/expense bulan sebelumnya.
    const prevMonth = prevMonthOf(month);
    const prevRange = transactionMonthRange(prevMonth);
    const prevRows = await db.transaction.findMany({
      where: { type: { in: ['income', 'expense'] }, date: { gte: prevRange.gte, lt: prevRange.lt } },
      select: { type: true, amount: true, date: true },
    });
    let prevMonthIncome = 0;
    let prevMonthExpense = 0;
    for (const tx of prevRows) {
      if (!ymdOf(tx.date as Date).startsWith(prevMonth)) continue;
      if (tx.type === 'income') prevMonthIncome += tx.amount;
      else prevMonthExpense += tx.amount;
    }

    // 3) Pemakaian budget bulan terpilih (reuse helper budgets — konsisten
    //    dengan sub-tab Budget & kartu dashboard utama).
    const budgetItems = await fetchBudgetItems(month);
    const budgetTotal = budgetItems.reduce((s, b) => s + b.amount, 0);
    const budgetSpent = Math.round(budgetItems.reduce((s, b) => s + b.spent, 0));

    // 4) Total saldo semua sumber + dana darurat (runway).
    //    Transfer antar sumber saling meniadakan, jadi total saldo =
    //    Σ initialBalance + Σ pemasukan − Σ pengeluaran (semua waktu).
    const [srcAgg, txByType] = await Promise.all([
      db.fundSource.aggregate({ _sum: { initialBalance: true } }),
      db.transaction.groupBy({ by: ['type'], _sum: { amount: true } }),
    ]);
    const incomeAll = txByType.find((t) => t.type === 'income')?._sum.amount ?? 0;
    const expenseAll = txByType.find((t) => t.type === 'expense')?._sum.amount ?? 0;
    const totalBalance = Math.round(((srcAgg._sum.initialBalance ?? 0) + incomeAll - expenseAll) * 100) / 100;
    const runwayDays = dailyAvg > 0 ? Math.max(0, Math.floor(totalBalance / dailyAvg)) : null;

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
      // KPI dashboard (Task 40)
      savingsRate,
      prevMonthIncome: Math.round(prevMonthIncome),
      prevMonthExpense: Math.round(prevMonthExpense),
      budgetTotal: Math.round(budgetTotal),
      budgetSpent,
      totalBalance,
      runwayDays,
    });
  } catch (error) {
    return handleApiError(error, 'finance/dashboard:GET');
  }
}
