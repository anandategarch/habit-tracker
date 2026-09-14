// GET /api/finance/dashboard?month=yyyy-MM — ringkasan keuangan bulanan.
// Task 40 (DASHBOARD-FIN): diperluas jadi mesin KPI dashboard keuangan —
// rasio tabungan, perbandingan bulan lalu (MoM), pemakaian budget, dan
// dana darurat (runway). Referensi KPI: savings rate + emergency fund
// (Quicken "5 Personal Finance KPIs", Klipfolio "KPIs of personal
// finance", CFPB emergency fund guide — benchmark sehat ≥ 20% tabungan
// dan 3–6 bulan biaya hidup).
//
// Task 42 (PERDETAIL-FIN): detail tambahan supaya sub-tab Ringkasan jadi
// dashboard keuangan lengkap — tren arus kas 6 bulan, statistik bulan
// (jumlah/rata-rata/terbesar), MoM per kategori, budget per kategori, dan
// tagihan berulang 30 hari mendatang (+ yang terlambat). Semua field BARU
// optional — caller lama tetap valid (FE defensif null/[]).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  badRequest,
  handleApiError,
  round1,
  transactionMonthRange,
  ymdOf,
} from '@/app/api/_lib/api-utils';
import { shiftYmd } from '@/lib/dashboard-helpers';
import { fetchBudgetItems } from '@/app/api/_lib/budget-utils';
import {
  isValidMonth,
  jakartaDateKey,
  jakartaDateString,
  jakartaMonthString,
} from '@/lib/timezone';

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

/** Geser bulan 'yyyy-MM' sebanyak delta bulan (delta bisa negatif). */
function monthShift(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12 + 12) % 12 + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

/** Tanggal kejadian BERIKUTNYA setelah ymd sesuai frekuensi. */
function addIntervalYMD(ymd: string, frequency: string): string {
  if (frequency === 'daily') return shiftYmd(ymd, 1);
  if (frequency === 'weekly') return shiftYmd(ymd, 7);
  // monthly — tambah 1 bulan kalender (clamp ke akhir bulan: 31 Jan → 28/29 Feb)
  const [y, m, d] = ymd.split('-').map(Number);
  const nmYm = monthShift(`${y}-${String(m).padStart(2, '0')}`, 1);
  const lastDay = daysInMonthOf(nmYm);
  return `${nmYm}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
}

/**
 * Instance berikutnya yang BELUM diproses → {nextYmd, overdue, notStarted}.
 * Konvensi proses-manual aplikasi ini: instance pertama jatuh tepat di
 * startDate; setelah diproses (lastRun terisi), instance berikutnya =
 * lastRun + interval. Terlambat = jatuh tempo sudah lewat hari ini dan
 * belum diproses → actionable (tombol Proses di sub-tab Berulang).
 */
function nextOccurrence(
  rt: { frequency: string; startDate: Date; lastRun: Date | null },
  todayYmd: string,
): { nextYmd: string; overdue: boolean; notStarted: boolean } | null {
  const startYmd = jakartaDateKey(rt.startDate);
  if (startYmd > todayYmd) return { nextYmd: startYmd, overdue: false, notStarted: true };
  // Belum pernah diproses → instance pertama = startDate itu sendiri.
  const due = rt.lastRun
    ? addIntervalYMD(jakartaDateKey(rt.lastRun), rt.frequency)
    : startYmd;
  return { nextYmd: due, overdue: due < todayYmd, notStarted: false };
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
        select: { type: true, amount: true, category: true, description: true, date: true },
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

    // ── PERDETAIL-FIN: statistik bulan (jumlah/rata-rata/terbesar) ────────
    const expenseTx = inMonth.filter((r) => r.type === 'expense');
    const incomeCount = inMonth.length - expenseTx.length;
    const expenseCount = expenseTx.length;
    const avgPerExpense = expenseCount > 0 ? Math.round(monthExpense / expenseCount) : 0;
    let biggestExpense:
      | { description: string; amount: number; category: string; date: string; emoji: string; color: string }
      | null = null;
    for (const tx of expenseTx) {
      if (!biggestExpense || tx.amount > biggestExpense.amount) {
        const meta = catMeta.get(tx.category) ?? fallbackMeta;
        biggestExpense = {
          description: tx.description || tx.category,
          amount: Math.round(tx.amount),
          category: tx.category,
          date: ymdOf(tx.date as Date),
          emoji: meta.emoji,
          color: meta.color,
        };
      }
    }

    const byCategory = Array.from(spentByCategory.entries())
      .map(([category, amount]) => {
        const meta = catMeta.get(category) ?? fallbackMeta;
        return {
          category,
          amount: Math.round(amount),
          emoji: meta.emoji,
          color: meta.color,
          // PERDETAIL-FIN: MoM per kategori (null saat bulan lalu 0).
          prevAmount: undefined as number | undefined,
          momPct: undefined as number | null | undefined,
        };
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

    // 2) Bulan lalu (MoM) — total + rincian kategori bulan sebelumnya.
    const prevMonth = prevMonthOf(month);
    const prevRange = transactionMonthRange(prevMonth);
    const prevRows = await db.transaction.findMany({
      where: { type: { in: ['income', 'expense'] }, date: { gte: prevRange.gte, lt: prevRange.lt } },
      select: { type: true, amount: true, category: true, date: true },
    });
    let prevMonthIncome = 0;
    let prevMonthExpense = 0;
    const prevSpentByCategory = new Map<string, number>();
    for (const tx of prevRows) {
      if (!ymdOf(tx.date as Date).startsWith(prevMonth)) continue;
      if (tx.type === 'income') prevMonthIncome += tx.amount;
      else {
        prevMonthExpense += tx.amount;
        prevSpentByCategory.set(tx.category, (prevSpentByCategory.get(tx.category) ?? 0) + tx.amount);
      }
    }
    // Tempel MoM ke byCategory (setelah diurutkan — posisi tak berubah).
    for (const item of byCategory) {
      const prev = prevSpentByCategory.get(item.category) ?? 0;
      item.prevAmount = Math.round(prev);
      item.momPct = prev > 0 ? Math.round(((item.amount - prev) / prev) * 1000) / 10 : null;
    }

    // 3) Pemakaian budget bulan terpilih (reuse helper budgets — konsisten
    //    dengan sub-tab Budget & kartu dashboard utama).
    const budgetItems = await fetchBudgetItems(month);
    const budgetTotal = budgetItems.reduce((s, b) => s + b.amount, 0);
    const budgetSpent = Math.round(budgetItems.reduce((s, b) => s + b.spent, 0));
    // PERDETAIL-FIN: rincian budget per kategori (emoji/color dari catMeta).
    const budgetDetail = budgetItems
      .map((b) => {
        const meta = catMeta.get(b.category) ?? fallbackMeta;
        return {
          category: b.category,
          amount: Math.round(b.amount),
          spent: Math.round(b.spent),
          remaining: Math.round(b.remaining),
          pct: b.pct,
          emoji: meta.emoji,
          color: meta.color,
        };
      })
      .sort((a, b) => b.pct - a.pct || b.spent - a.spent);

    // 4) Total saldo semua sumber + dana darurat (runway).
    //    Transfer antar sumber saling meniadakan, jadi total saldo =
    //    Σ initialBalance + Σ pemasukan − Σ pengeluaran (semua waktu).
    const [srcAgg, txByType, recurringRows, sourceRows] = await Promise.all([
      db.fundSource.aggregate({ _sum: { initialBalance: true } }),
      // BUGHUNT-54 (3-a #2): totalBalance (KPI Dana Darurat/runway) harus
      // konsisten dengan hero "Total Saldo" = Σ saldo per sumber
      // (computeSourceBalances hanya menghitung transaksi BERMILIK dompet) —
      // transaksi tanpa sumber (sourceId null) tidak boleh menggelembungkan
      // saldo. Grup ini hanya memberi makan totalBalance + runway.
      db.transaction.groupBy({ by: ['type'], _sum: { amount: true }, where: { sourceId: { not: null } } }),
      db.recurringTransaction.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          amount: true,
          type: true,
          category: true,
          frequency: true,
          startDate: true,
          endDate: true,
          lastRun: true,
          sourceId: true,
        },
      }),
      db.fundSource.findMany({ select: { id: true, name: true } }),
    ]);
    const incomeAll = txByType.find((t) => t.type === 'income')?._sum.amount ?? 0;
    const expenseAll = txByType.find((t) => t.type === 'expense')?._sum.amount ?? 0;
    const totalBalance = Math.round(((srcAgg._sum.initialBalance ?? 0) + incomeAll - expenseAll) * 100) / 100;
    const runwayDays = dailyAvg > 0 ? Math.max(0, Math.floor(totalBalance / dailyAvg)) : null;

    // 5) PERDETAIL-FIN: tren arus kas 6 bulan (berakhir di bulan terpilih).
    const trendStart = monthShift(month, -5);
    const trendRange = transactionMonthRange(trendStart);
    const trendRows = await db.transaction.findMany({
      where: { type: { in: ['income', 'expense'] }, date: { gte: trendRange.gte, lt: range.lt } },
      select: { type: true, amount: true, date: true },
    });
    const trendMonths: string[] = [];
    for (let i = -5; i <= 0; i += 1) trendMonths.push(monthShift(month, i));
    const trendMap = new Map<string, { income: number; expense: number }>(
      trendMonths.map((m) => [m, { income: 0, expense: 0 }]),
    );
    for (const tx of trendRows) {
      const ym = ymdOf(tx.date as Date).slice(0, 7);
      const slot = trendMap.get(ym);
      if (!slot) continue; // di luar jendela (guard TZ)
      if (tx.type === 'income') slot.income += tx.amount;
      else slot.expense += tx.amount;
    }
    const cashflowTrend = trendMonths.map((m) => {
      const s = trendMap.get(m)!;
      return {
        month: m,
        income: Math.round(s.income),
        expense: Math.round(s.expense),
        net: Math.round(s.income - s.expense),
      };
    });

    // 6) PERDETAIL-FIN: tagihan/pemasukan berulang 30 hari mendatang +
    //    yang terlambat (instance terlewat). Sumber nama untuk konteks.
    const sourceNameMap = new Map(sourceRows.map((s) => [s.id, s.name]));
    const horizonYmd = shiftYmd(todayYmd, 30);
    const upcomingRecurring = recurringRows
      .map((rt) => {
        if (rt.endDate && jakartaDateKey(rt.endDate) < todayYmd) return null; // sudah berakhir
        const occ = nextOccurrence(rt, todayYmd);
        if (!occ) return null;
        const { nextYmd, overdue, notStarted } = occ;
        if (!overdue && nextYmd > horizonYmd) return null; // di luar jendela 30 hari
        const meta = catMeta.get(rt.category) ?? fallbackMeta;
        return {
          id: rt.id,
          name: rt.name,
          amount: Math.round(rt.amount),
          type: rt.type as 'income' | 'expense',
          category: rt.category,
          emoji: meta.emoji,
          frequency: rt.frequency as 'daily' | 'weekly' | 'monthly',
          nextDate: nextYmd,
          overdue,
          notStarted,
          sourceName: rt.sourceId ? sourceNameMap.get(rt.sourceId) ?? null : null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => (a.nextDate < b.nextDate ? -1 : a.nextDate > b.nextDate ? 1 : 0))
      .slice(0, 8);

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
      // Detail dashboard (Task 42, PERDETAIL-FIN) — optional & defensif di FE
      txCount: inMonth.length,
      incomeCount,
      expenseCount,
      avgPerExpense,
      biggestExpense,
      cashflowTrend,
      budgetDetail,
      upcomingRecurring,
    });
  } catch (error) {
    return handleApiError(error, 'finance/dashboard:GET');
  }
}
