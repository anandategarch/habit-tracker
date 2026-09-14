'use client';

// components/habit-tracker/finance-detail-sections.tsx — sektor detail
// "Perdetail Dashboard Finance" (Task 42, PERDETAIL-FIN).
//
// 5 sektor baru untuk sub-tab Ringkasan, mengikuti bahasa desain Aurora
// (premium-card + chip-icon + premium-label/stat + anim-stagger):
//   1. CashflowTrendChart  — bar ganda 6 bulan (masuk vs keluar) + net.
//   2. MonthStatsGrid      — 4 statistik bulan (jumlah, rata-rata, terbesar,
//                            hari tanpa belanja).
//   3. CategoryTopList     — top 5 kategori + bar + chip MoM vs bulan lalu.
//   4. BudgetDetailList    — budget per kategori + bar tone + sisa/lewat.
//   5. UpcomingRecurringList — tagihan/pemasukan berulang ≤30 hari + telat.
//
// Semua render defensif: data kosong/null → section disembunyikan atau
// empty-state kecil (bukan angka palsu). Deep-link 1-klik memakai store
// (openFinanceSubTab / openFinanceFocus — lihat store/app-store.ts).

import { useMemo } from 'react';
import {
  BarChart3,
  CalendarCheck,
  CalendarClock,
  ChevronRight,
  Flame,
  PieChart,
  Receipt,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { jakartaDateString } from '@/lib/jakarta-date';
import { compactRupiah, compactRupiahSafe, monthLabel } from './finance-types';
import { MONTHS_ID, formatDateShort, tintFromColor } from '@/lib/finance-helpers';
import { dateFromYMD } from '@/lib/timezone';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';
import type { DashboardData } from './finance-types';

// ── util kecil lokal ───────────────────────────────────────────────────────

const WEEKDAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function daysInMonthOf(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  if (m === 2) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return leap ? 29 : 28;
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

function monthShort(ym: string): string {
  const m = Number(ym.slice(5, 7));
  return MONTHS_ID[m - 1] ?? ym;
}

function weekdayShort(ymd: string): string {
  const d = dateFromYMD(ymd);
  return WEEKDAYS_ID[d.getUTCDay()] ?? '';
}

/** Selisih hari dari hari ini (Jakarta) ke ymd — positif = masa depan. */
function daysFromToday(ymd: string): number {
  const today = jakartaDateString();
  return Math.round((dateFromYMD(ymd).getTime() - dateFromYMD(today).getTime()) / 86_400_000);
}

function frequencyLabel(freq: string): string {
  if (freq === 'daily') return 'harian';
  if (freq === 'weekly') return 'mingguan';
  return 'bulanan';
}

type Stagger = { stagger: number };

// ── 1. Arus Kas 6 Bulan ────────────────────────────────────────────────────

export function CashflowTrendChart({
  trend,
  selectedMonth,
  stagger,
}: Stagger & { trend: NonNullable<DashboardData['cashflowTrend']>; selectedMonth: string }) {
  const openFinanceSubTab = useAppStore(s => s.openFinanceSubTab);
  // CONNECTED-APP: kolom bulan dapat diklik untuk berpindah bulan — dulu
  // bulan terpilih hanya ditandai ring tanpa cara memindahkannya dari chart.
  const setSelectedMonth = useAppStore(s => s.setSelectedMonth);
  const hasData = trend.some(m => m.income > 0 || m.expense > 0);
  const max = Math.max(1, ...trend.map(m => Math.max(m.income, m.expense)));

  return (
    <section
      className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger"
      style={{ '--stagger': stagger } as CSSProperties}
      aria-label="Tren arus kas 6 bulan"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="chip-icon chip-teal h-8 w-8 shrink-0" aria-hidden="true">
            <BarChart3 className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold">Arus Kas 6 Bulan</h3>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
          onClick={() => openFinanceSubTab('analysis')}
          aria-label="Buka analisis keuangan"
        >
          Analisis
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      {hasData ? (
        <>
          {/* Legend */}
          <div className="flex items-center gap-3 mb-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              Pemasukan
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" />
              Pengeluaran
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
              Selisih
            </span>
          </div>

          <div
            className="grid grid-cols-6 gap-1 sm:gap-2"
            role="img"
            aria-label={trend
              .map(m => `${monthLabel(m.month)}: masuk ${compactRupiah(m.income)}, keluar ${compactRupiah(m.expense)}, selisih ${compactRupiah(m.net)} — pilih bulan`)
              .join('; ')}
          >
            {trend.map(m => {
              const isSel = m.month === selectedMonth;
              const incomeH = m.income > 0 ? Math.max(4, Math.round((m.income / max) * 100)) : 0;
              const expenseH = m.expense > 0 ? Math.max(4, Math.round((m.expense / max) * 100)) : 0;
              return (
                <button
                  type="button"
                  key={m.month}
                  onClick={() => setSelectedMonth(m.month)}
                  aria-label={`Lihat bulan ${monthLabel(m.month)} — masuk ${compactRupiah(m.income)}, keluar ${compactRupiah(m.expense)}`}
                  aria-pressed={isSel}
                  className={cn(
                    'flex flex-col items-center rounded-xl pt-2 pb-1.5 min-w-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                    isSel && 'bg-primary/5 ring-1 ring-primary/25',
                    !isSel && 'hover:bg-muted/50'
                  )}
                >
                  <div className="w-full h-24 flex items-end justify-center gap-1" aria-hidden="true">
                    <div
                      className="w-[42%] max-w-3.5 rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all"
                      style={{ height: `${incomeH}%` }}
                    />
                    <div
                      className="w-[42%] max-w-3.5 rounded-t-md bg-gradient-to-t from-rose-600 to-rose-400 transition-all"
                      style={{ height: `${expenseH}%` }}
                    />
                  </div>
                  <p
                    className={cn(
                      'text-[10px] mt-1 truncate w-full text-center',
                      isSel ? 'font-bold text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {monthShort(m.month)}
                  </p>
                  <p
                    className={cn(
                      'text-[9px] tabular-nums truncate w-full text-center',
                      m.net > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : m.net < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-muted-foreground'
                    )}
                  >
                    {compactRupiah(m.net)}
                  </p>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground py-4 text-center">
          Belum ada transaksi dalam 6 bulan terakhir — catat pemasukan &amp;
          pengeluaran untuk melihat tren.
        </p>
      )}
    </section>
  );
}

// ── 2. Statistik Bulan ─────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  chip: string;
  icon: React.ElementType;
  onClick?: () => void;
  ariaLabel?: string;
}

function StatCard({ label, value, sub, chip, icon: Icon, onClick, ariaLabel }: StatCardProps) {
  const content = (
    <>
      <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
        <span className={cn(chip, 'h-6 w-6 shrink-0')} aria-hidden="true">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="premium-label truncate text-[10px]">{label}</p>
      </div>
      <p className="premium-stat text-base leading-tight truncate">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-1 truncate">{sub}</p>
    </>
  );
  return onClick ? (
    <button
      type="button"
      className="premium-card rounded-xl p-3 text-left w-full cursor-pointer transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.98] min-w-0"
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {content}
    </button>
  ) : (
    <div className="premium-card rounded-xl p-3 min-w-0">{content}</div>
  );
}

export function MonthStatsGrid({
  dashboardData,
  selectedMonth,
  stagger,
}: Stagger & { dashboardData: DashboardData; selectedMonth: string }) {
  const openFinanceSubTab = useAppStore(s => s.openFinanceSubTab);
  // CONNECTED-APP: drill-down kategori untuk kartu "Pengeluaran Terbesar".
  const openFinanceFocus = useAppStore(s => s.openFinanceFocus);
  const txCount = dashboardData?.txCount ?? 0;
  const incomeCount = dashboardData?.incomeCount ?? 0;
  const expenseCount = dashboardData?.expenseCount ?? 0;
  const avgPerExpense = dashboardData?.avgPerExpense ?? 0;
  const biggest = dashboardData?.biggestExpense ?? null;
  const noSpendDays = dashboardData?.noSpendDays ?? 0;
  const daysTotal = daysInMonthOf(selectedMonth);
  const isCurrentMonth = useMemo(
    () => selectedMonth === jakartaDateString().slice(0, 7),
    [selectedMonth]
  );
  const daysShown = isCurrentMonth
    ? Math.min(daysTotal, Number(jakartaDateString().slice(8, 10)))
    : daysTotal;

  return (
    <section
      className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 anim-stagger"
      style={{ '--stagger': stagger } as CSSProperties}
      aria-label="Statistik bulan ini"
    >
      <StatCard
        label="Transaksi"
        value={`${txCount}`}
        sub={`${incomeCount} masuk · ${expenseCount} keluar`}
        chip="chip-icon chip-teal"
        icon={Receipt}
      />
      <StatCard
        label="Rata-rata/Transaksi"
        value={compactRupiahSafe(avgPerExpense)}
        sub="per transaksi keluar"
        chip="chip-icon chip-amber"
        icon={Scale}
      />
      <StatCard
        label="Pengeluaran Terbesar"
        value={biggest ? compactRupiahSafe(biggest.amount) : '—'}
        sub={biggest ? biggest.description : 'belum ada transaksi'}
        chip="chip-icon chip-rose"
        icon={Flame}
        // CONNECTED-APP: bawa kategori pengeluaran terbesar sebagai filter
        // (dulu cuma pindah sub-tab — konteks kategori hilang).
        onClick={biggest ? () => openFinanceFocus({ category: biggest.category ?? undefined, txType: 'expense' }) : undefined}
        ariaLabel="Buka transaksi kategori pengeluaran terbesar bulan ini"
      />
      <StatCard
        label="Hari Tanpa Belanja"
        value={`${noSpendDays}`}
        sub={`dari ${daysShown} hari berjalan`}
        chip="chip-icon chip-emerald"
        icon={CalendarCheck}
      />
    </section>
  );
}

// ── 3. Top Kategori ────────────────────────────────────────────────────────

export function CategoryTopList({
  dashboardData,
  stagger,
}: Stagger & { dashboardData: DashboardData }) {
  const openFinanceFocus = useAppStore(s => s.openFinanceFocus);
  const byCategory = dashboardData?.byCategory ?? [];
  const monthExpense = dashboardData?.monthExpense ?? 0;
  const top5 = byCategory.slice(0, 5);
  if (top5.length === 0) return null;
  const maxAmount = Math.max(1, top5[0]?.amount ?? 1);

  return (
    <section
      className="premium-card premium-card-sheen rounded-2xl anim-stagger"
      style={{ '--stagger': stagger } as CSSProperties}
      aria-label="Top kategori pengeluaran"
    >
      <div className="flex items-center justify-between gap-2 p-4 pb-2 sm:p-5 sm:pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="chip-icon chip-rose h-8 w-8 shrink-0" aria-hidden="true">
            <PieChart className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold">Top Kategori</h3>
        </div>
        <p className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
          {compactRupiah(monthExpense)} keluar
        </p>
      </div>

      <div className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-1">
        {top5.map(cat => {
          const share = monthExpense > 0 ? Math.round((cat.amount / monthExpense) * 100) : 0;
          const momPct = cat.momPct ?? null;
          const momTone =
            momPct === null
              ? null
              : momPct <= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : momPct <= 10
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-rose-600 dark:text-rose-400';
          const MomIcon = momPct !== null && momPct > 0 ? TrendingUp : TrendingDown;
          return (
            <button
              key={cat.category}
              type="button"
              className="w-full px-2 py-2 rounded-xl text-left cursor-pointer transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.99]"
              onClick={() => openFinanceFocus({ category: cat.category })}
              aria-label={`Lihat transaksi kategori ${cat.category}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="h-9 w-9 rounded-xl grid place-items-center text-base shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                  style={{ backgroundColor: tintFromColor(cat.color) }}
                  aria-hidden="true"
                >
                  {cat.emoji}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-sm font-medium truncate">{cat.category}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {share}%
                    </span>
                  </span>
                  <span className="block h-1 rounded-full bg-muted mt-1 overflow-hidden" aria-hidden="true">
                    <span
                      className="block h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(3, Math.round((cat.amount / maxAmount) * 100))}%`,
                        backgroundColor: cat.color,
                      }}
                    />
                  </span>
                </span>
                <span className="flex flex-col items-end shrink-0 gap-0.5">
                  <span className="text-sm font-semibold tabular-nums">
                    {compactRupiahSafe(cat.amount)}
                  </span>
                  {momPct !== null && momTone && (
                    <span className={cn('inline-flex items-center gap-0.5 text-[10px] tabular-nums', momTone)}>
                      <MomIcon className="h-3 w-3" aria-hidden="true" />
                      {momPct > 0 ? '+' : ''}{momPct}%
                    </span>
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── 4. Budget per Kategori ─────────────────────────────────────────────────

export function BudgetDetailList({
  budgetDetail,
  stagger,
}: Stagger & { budgetDetail: NonNullable<DashboardData['budgetDetail']> }) {
  const openFinanceSubTab = useAppStore(s => s.openFinanceSubTab);
  // CONNECTED-APP: baris budget → transaksi kategori (drill-down).
  const openFinanceFocus = useAppStore(s => s.openFinanceFocus);
  if (budgetDetail.length === 0) return null;
  const items = budgetDetail.slice(0, 6);

  return (
    <section
      className="premium-card premium-card-sheen rounded-2xl anim-stagger"
      style={{ '--stagger': stagger } as CSSProperties}
      aria-label="Budget per kategori"
    >
      <div className="flex items-center justify-between gap-2 p-4 pb-2 sm:p-5 sm:pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="chip-icon chip-amber h-8 w-8 shrink-0" aria-hidden="true">
            <Target className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold">Budget per Kategori</h3>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
          onClick={() => openFinanceSubTab('budgets')}
          aria-label="Kelola budget"
        >
          Kelola
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      <div className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-2">
        {items.map(b => {
          const pct = Math.max(0, b.pct);
          const tone =
            pct > 100
              ? 'bg-rose-500'
              : pct >= 80
                ? 'bg-amber-500'
                : 'bg-emerald-500';
          const remainingTone =
            b.remaining < 0
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-muted-foreground';
          return (
            /* CONNECTED-APP: baris budget di Ringkasan kini drill-down ke
               transaksi kategori itu (dulu hover palsu tanpa onClick —
               ketidakselarasan vs sub-tab Anggaran yang sudah terhubung). */
            <button
              type="button"
              key={b.category}
              onClick={() => openFinanceFocus({ category: b.category, txType: 'expense' })}
              aria-label={`Lihat transaksi kategori ${b.category} — terpakai ${pct}%`}
              className="w-full cursor-pointer rounded-xl px-2 py-1.5 text-left hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-8 w-8 rounded-lg grid place-items-center text-sm shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                  style={{ backgroundColor: tintFromColor(b.color) }}
                  aria-hidden="true"
                >
                  {b.emoji}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{b.category}</span>
                  <span className={cn('block text-[10px] tabular-nums', remainingTone)}>
                    {b.remaining < 0
                      ? `Lewat ${compactRupiahSafe(Math.abs(b.remaining))}`
                      : `Sisa ${compactRupiahSafe(b.remaining)}`}
                  </span>
                </span>
                <span className="text-xs font-semibold tabular-nums shrink-0">
                  {compactRupiah(b.spent)}
                  <span className="text-muted-foreground font-normal"> / {compactRupiah(b.amount)}</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden" role="presentation">
                <div
                  className={cn('h-full rounded-full transition-all', tone)}
                  style={{ width: `${Math.min(100, Math.max(pct > 0 ? 3 : 0, pct))}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── 5. Tagihan Mendatang (berulang) ────────────────────────────────────────

export function UpcomingRecurringList({
  upcoming,
  stagger,
}: Stagger & { upcoming: NonNullable<DashboardData['upcomingRecurring']> }) {
  const openFinanceSubTab = useAppStore(s => s.openFinanceSubTab);
  if (upcoming.length === 0) return null;
  const items = upcoming.slice(0, 6);

  return (
    <section
      className="premium-card premium-card-sheen rounded-2xl anim-stagger"
      style={{ '--stagger': stagger } as CSSProperties}
      aria-label="Tagihan dan pemasukan berulang mendatang"
    >
      <div className="flex items-center justify-between gap-2 p-4 pb-2 sm:p-5 sm:pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="chip-icon chip-violet h-8 w-8 shrink-0" aria-hidden="true">
            <CalendarClock className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold">Tagihan Mendatang</h3>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
          onClick={() => openFinanceSubTab('recurring')}
          aria-label="Kelola transaksi berulang"
        >
          Kelola
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      <div className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-1">
        {items.map(item => {
          const days = daysFromToday(item.nextDate);
          const whenLabel = item.overdue
            ? 'Terlambat'
            : item.notStarted
              ? 'Mulai'
              : days === 0
                ? 'Hari ini'
                : days === 1
                  ? 'Besok'
                  : `${days} hari lagi`;
          const whenTone = item.overdue
            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
            : item.notStarted
              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
              : days <= 3
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'bg-muted text-muted-foreground';
          return (
            <button
              key={item.id}
              type="button"
              className="w-full px-2 py-2 rounded-xl text-left cursor-pointer transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.99]"
              onClick={() => openFinanceSubTab('recurring')}
              aria-label={`Kelola ${item.name} — ${weekdayShort(item.nextDate)} ${formatDateShort(item.nextDate)}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="h-9 w-9 rounded-xl grid place-items-center text-base shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                  style={{ backgroundColor: tintFromColor('#8b5cf6') }}
                  aria-hidden="true"
                >
                  {item.emoji}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{item.name}</span>
                    <span
                      className={cn(
                        'text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
                        whenTone
                      )}
                    >
                      {whenLabel}
                    </span>
                  </span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    {frequencyLabel(item.frequency)} · {weekdayShort(item.nextDate)},{' '}
                    {formatDateShort(item.nextDate)}
                    {item.sourceName ? ` · ${item.sourceName}` : ''}
                  </span>
                </span>
                <span
                  className={cn(
                    'text-sm font-semibold tabular-nums shrink-0',
                    item.type === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  )}
                >
                  {item.type === 'income' ? '+' : '−'}{compactRupiahSafe(item.amount)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
