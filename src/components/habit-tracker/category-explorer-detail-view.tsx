// ---------------------------------------------------------------------------
// CategoryDetailView — drill-down view for a single category.
// Extracted from category-explorer.tsx during SPLIT-PHASE3.
//
// MERGE Task 32 (Opsi A): kini satu-satunya konsumen adalah sub-tab
// "Analisis" (finance-analysis.tsx) — penggabungan Eksplorasi + Kategori.
// Dua transplant dari Eksplorasi lama: (1) ringkasan mingguan M1–M5 di bawah
// stats grid; (2) baris transaksi jadi tombol — tap membuka dialog edit di
// root finance.tsx (lewat prop onEditTx, pola Task 4-b A.5).
//
// This is the "big one" — encapsulates ALL of the per-category analytics:
//   - daily chart (bars + 7-day moving average + avg reference line)
//   - stats grid (avg/tx, avg/day, max tx, max day)
//   - peak-hour insight
//   - A2 time-of-day distribution
//   - C9 source breakdown
//   - D11 personality tag (Heavy Spender / Daily Ritual / Weekend Splurger / …)
//   - A1 day-of-week pattern (DowLineChart)
//   - C8 amount distribution histogram (5 MiniProgressRings)
//   - D12 anomaly detection (z-score > 1.5σ)
//   - transaction list
//
// TASK 71-g (SPLIT god-file): file ini kini AKAR KOMPOSISI. Derivasi data
// berat dipindah ke category-explorer-detail-data.ts (useCategoryDetailData
// + useCategoryWeeklySummary); seksi-seksi UI ke sibling dengan prefix
// category-explorer-detail-*: -header (breadcrumb + hero), -filters
// (pemilih bulan), -chart, -stats, -weekly, -insights, -breakdown, -dow,
// -histogram (MiniProgressRing tetap lokal di sana), -anomalies,
// -transactions. Urutan DOM, stagger anim-stagger 0–14, guard render, dan
// seluruh perilaku identik.
// ---------------------------------------------------------------------------

'use client';

import { useAppStore } from '@/store/app-store';
import type { Transaction } from './finance-types';
import type { CategoryTotal } from './category-explorer-types';
import {
  useCategoryDetailData,
  useCategoryWeeklySummary,
} from './category-explorer-detail-data';
import { CategoryDetailBreadcrumb, CategoryDetailHero } from './category-explorer-detail-header';
import { CategoryDetailFilters } from './category-explorer-detail-filters';
import { CategoryDetailChart } from './category-explorer-detail-chart';
import { CategoryDetailStats } from './category-explorer-detail-stats';
import { CategoryDetailWeekly } from './category-explorer-detail-weekly';
import { CategoryPeakHourCard, CategoryPersonalityCard } from './category-explorer-detail-insights';
import {
  CategoryTimeOfDayBreakdown,
  CategorySourceBreakdown,
} from './category-explorer-detail-breakdown';
import { CategoryDetailDow } from './category-explorer-detail-dow';
import { CategoryDetailHistogram } from './category-explorer-detail-histogram';
import { CategoryDetailAnomalies } from './category-explorer-detail-anomalies';
import { CategoryDetailTransactions } from './category-explorer-detail-transactions';

// ── CategoryDetailView ─────────────────────────────────────────────────

export interface CategoryDetailViewProps {
  cat: CategoryTotal;
  transactions: Transaction[];
  prevTransactions: Transaction[];
  selectedMonth: string;
  monthOptions: { value: string; label: string }[];
  onBack: () => void;
  onSelectMonth: (m: string) => void;
  /** MERGE Task 32 (transplant Eksplorasi): tap baris transaksi → buka dialog
   * edit di root finance.tsx (mutasi.openEditTx). */
  onEditTx: (tx: Transaction) => void;
}

export function CategoryDetailView({
  cat,
  transactions,
  prevTransactions,
  selectedMonth,
  monthOptions,
  onBack,
  onSelectMonth,
  onEditTx,
}: CategoryDetailViewProps) {
  // ONE-CLICK-8 (Task 4-b A.7): 1-tap jump from a category's analytics
  // detail to the Transactions sub-tab with this category's filter applied
  // (openFinanceFocus). Sejak MERGE Task 32 bulan sudah global — mirroring
  // bulan ke store tidak lagi diperlukan.
  const openFinanceFocus = useAppStore(s => s.openFinanceFocus);

  const handleViewTransactions = () => {
    openFinanceFocus({ category: cat.name });
  };

  const {
    catTx,
    chartData,
    avgPerTx,
    activeDays,
    avgPerDay,
    maxTx,
    maxDay,
    peakHour,
    vsLastMonthPct,
    vsLastMonthDir,
    prevTotal,
    timeOfDayMap,
    maxTimeSlot,
    topTimeSlot,
    sourceList,
    dailyAverage,
    dowData,
    dowTop,
    histogram,
    histMaxCount,
    dominantBucket,
    personalityTag,
    anomalies,
    primaryColor,
  } = useCategoryDetailData({ transactions, prevTransactions, cat, selectedMonth });

  const weekly = useCategoryWeeklySummary(chartData, selectedMonth);

  return (
    <div className="space-y-4 overflow-x-hidden">
      <CategoryDetailBreadcrumb cat={cat} onBack={onBack} onViewTransactions={handleViewTransactions} />

      <CategoryDetailFilters selectedMonth={selectedMonth} monthOptions={monthOptions} onSelectMonth={onSelectMonth} />

      <CategoryDetailHero
        cat={cat}
        selectedMonth={selectedMonth}
        txCount={catTx.length}
        activeDays={activeDays}
        vsLastMonthPct={vsLastMonthPct}
        vsLastMonthDir={vsLastMonthDir}
        prevTotal={prevTotal}
      />

      <CategoryDetailChart chartData={chartData} dailyAverage={dailyAverage} primaryColor={primaryColor} />

      <CategoryDetailStats avgPerTx={avgPerTx} avgPerDay={avgPerDay} maxTx={maxTx} maxDay={maxDay} />

      <CategoryDetailWeekly weekly={weekly} primaryColor={primaryColor} />

      <CategoryPeakHourCard peakHour={peakHour} />

      <CategoryTimeOfDayBreakdown
        timeOfDayMap={timeOfDayMap}
        topTimeSlot={topTimeSlot}
        maxTimeSlot={maxTimeSlot}
        txCount={catTx.length}
        primaryColor={primaryColor}
      />

      <CategorySourceBreakdown sourceList={sourceList} primaryColor={primaryColor} />

      <CategoryPersonalityCard personalityTag={personalityTag} />

      <CategoryDetailDow dowData={dowData} dowTop={dowTop} txCount={catTx.length} primaryColor={primaryColor} />

      <CategoryDetailHistogram
        histogram={histogram}
        histMaxCount={histMaxCount}
        dominantBucket={dominantBucket}
        txCount={catTx.length}
        primaryColor={primaryColor}
      />

      <CategoryDetailAnomalies anomalies={anomalies} />

      <CategoryDetailTransactions cat={cat} catTx={catTx} selectedMonth={selectedMonth} onEditTx={onEditTx} />
    </div>
  );
}
