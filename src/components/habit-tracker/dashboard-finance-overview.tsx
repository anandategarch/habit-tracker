// Extracted from dashboard.tsx in PHASE-A-2 — "Keuangan Bulan Ini" card.
// Pure presentational — renders income / expense / net balance / budget
// status from the financeOverview slice of DashboardData.
// PREMIUM UI v2 ("Rutina Aurora"): premium-card container + premium-label
// header + chip-soft accents.
// ONE-CLICK (Task 4-a): "Lihat detail" → finance overview sub-tab; the
// budget-status tile → budgets sub-tab (store deep-link primitives).
'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowUpRight, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { ChartInfo } from './dashboard-helpers';
import type { FinanceOverview } from './dashboard-types';

export function FinanceOverviewCard({
  data,
}: {
  data: FinanceOverview;
}) {
  // ONE-CLICK (4-a): "Lihat detail" deep-links to the finance tab overview
  // sub-tab; the budget-status tile jumps to the Budgets sub-tab.
  const openFinanceSubTab = useAppStore((s) => s.openFinanceSubTab);

  return (
    <section aria-label="Finance overview">
      <div className="premium-card premium-card-sheen rounded-2xl p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2.5">
              <span className="chip-soft chip-soft-teal h-8 w-8" aria-hidden="true">
                <Wallet className="h-4 w-4" />
              </span>
              <span className="premium-label flex items-center gap-2">
                Keuangan Bulan Ini
                <ChartInfo text="Pemasukan dan pengeluaran dari semua transaksi bulan ini. Saldo = pemasukan − pengeluaran. Status anggaran menunjukkan jumlah kategori yang terlampaui 80% atau 100%." />
              </span>
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {data.transactionCount} transaksi
              </Badge>
              {/* ONE-CLICK (4-a): clear "Lihat detail" affordance → finance
                  overview sub-tab. */}
              <button
                type="button"
                onClick={() => openFinanceSubTab('overview')}
                aria-label="Lihat detail keuangan"
                className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                Lihat detail
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Income */}
            <div className="flex flex-col gap-1.5 rounded-xl border border-primary/15 bg-primary/5 p-3.5 dark:border-primary/20 dark:bg-primary/10">
              <div className="flex items-center gap-2 text-primary">
                <span className="chip-soft chip-soft-teal h-7 w-7" aria-hidden="true">
                  <TrendingUp className="h-3.5 w-3.5" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">Pemasukan</span>
              </div>
              <span className="premium-stat text-lg text-primary">
                {data.totalIncome.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            {/* Expense */}
            <div className="flex flex-col gap-1.5 rounded-xl border border-red-500/20 bg-red-500/5 p-3.5 dark:border-red-400/20 dark:bg-red-400/10">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <span className="chip-soft chip-soft-rose h-7 w-7" aria-hidden="true">
                  <TrendingDown className="h-3.5 w-3.5" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">Pengeluaran</span>
              </div>
              <span className="premium-stat text-lg text-red-600 dark:text-red-400">
                {data.totalExpense.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            {/* Net Balance */}
            <div className="flex flex-col gap-1.5 rounded-xl border border-teal-500/20 bg-teal-500/5 p-3.5 dark:border-teal-400/20 dark:bg-teal-400/10">
              <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400">
                <span className="chip-soft chip-soft-teal h-7 w-7" aria-hidden="true">
                  <Wallet className="h-3.5 w-3.5" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">Saldo Bersih</span>
              </div>
              <span className={cn(
                'premium-stat text-lg',
                data.netBalance >= 0
                  ? 'text-teal-700 dark:text-teal-300'
                  : 'text-red-600 dark:text-red-400'
              )}>
                {data.netBalance.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            {/* Budget Alerts — ONE-CLICK (4-a): whole tile is a deep-link to
                the Budgets finance sub-tab (real <button> for a11y). */}
            <button
              type="button"
              onClick={() => openFinanceSubTab('budgets')}
              aria-label="Lihat status anggaran di tab keuangan"
              className={cn(
                'group flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3.5 text-left',
                'transition-colors hover:border-primary/30 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                (data.budgetExceeded > 0 || data.budgetWarning > 0)
                  ? 'border-orange-500/25 bg-orange-500/5 hover:bg-orange-500/10 dark:border-orange-400/20 dark:bg-orange-400/10'
                  : 'border-primary/15 bg-primary/5 hover:bg-primary/10 dark:border-primary/20 dark:bg-primary/10'
              )}
            >
              <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <span className="chip-soft chip-soft-amber h-7 w-7" aria-hidden="true">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">Status Anggaran</span>
                <ArrowUpRight
                  className="ml-auto h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  aria-hidden="true"
                />
              </div>
              {data.budgetExceeded > 0 ? (
                <span className="text-sm font-bold text-red-600 dark:text-red-400">
                  {data.budgetExceeded} melebihi batas
                </span>
              ) : data.budgetWarning > 0 ? (
                <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                  {data.budgetWarning} hampir limit
                </span>
              ) : (
                <span className="text-sm font-bold text-primary">
                  Semua aman
                </span>
              )}
            </button>
          </div>
      </div>
    </section>
  );
}
