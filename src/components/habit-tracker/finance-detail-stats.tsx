'use client';

// components/habit-tracker/finance-detail-stats.tsx — sektor 2 detail
// Ringkasan: Statistik Bulan (diekstrak verbatim dari
// finance-detail-sections.tsx, Task 71-i).
//
// 4 statistik bulan: jumlah transaksi, rata-rata, pengeluaran terbesar
// (drill-down kategori — CONNECTED-APP), hari tanpa belanja.

import { useMemo } from 'react';
import { CalendarCheck, Flame, Receipt, Scale } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { jakartaDateString } from '@/lib/jakarta-date';
import { compactRupiahSafe } from './finance-types';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';
import type { DashboardData } from './finance-types';
import { daysInMonthOf, type Stagger } from './finance-detail-utils';

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
  // CONNECTED-APP: drill-down kategori untuk kartu "Pengeluaran Terbesar".
  // (Task 71-i: langganan openFinanceSubTab yang tak terpakai di sektor ini
  // dihapus — dead code; fungsi store stabil, tanpa efek observabel.)
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
