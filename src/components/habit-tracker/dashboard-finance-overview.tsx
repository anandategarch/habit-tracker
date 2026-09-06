// Extracted from dashboard.tsx in PHASE-A-2 — "Keuangan Bulan Ini" card.
// Pure presentational — renders income / expense / net balance / budget
// status from the financeOverview slice of DashboardData.
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { ChartInfo } from './dashboard-helpers';
import type { FinanceOverview } from './dashboard-types';

export function FinanceOverviewCard({
  data,
}: {
  data: FinanceOverview;
}) {
  return (
    <section aria-label="Finance overview">
      <Card className="p-4">
        <CardContent className="p-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold flex items-center gap-2">
                Keuangan Bulan Ini
                <ChartInfo text="Pemasukan dan pengeluaran dari semua transaksi bulan ini. Saldo = pemasukan − pengeluaran. Status anggaran menunjukkan jumlah kategori yang terlampaui 80% atau 100%." />
              </h3>
            </div>
            <Badge variant="secondary" className="text-xs">
              {data.transactionCount} transaksi
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Income */}
            <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <TrendingUp className="h-3.5 w-3.5" />
                Pemasukan
              </div>
              <span className="text-lg font-bold text-primary">
                {data.totalIncome.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            {/* Expense */}
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                <TrendingDown className="h-3.5 w-3.5" />
                Pengeluaran
              </div>
              <span className="text-lg font-bold text-red-700 dark:text-red-300">
                {data.totalExpense.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            {/* Net Balance */}
            <div className="rounded-lg border border-teal-200 bg-teal-50 dark:bg-teal-950/20 dark:border-teal-900 p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-teal-600 dark:text-teal-400">
                <Wallet className="h-3.5 w-3.5" />
                Saldo Bersih
              </div>
              <span className={cn(
                'text-lg font-bold',
                data.netBalance >= 0
                  ? 'text-teal-700 dark:text-teal-300'
                  : 'text-red-700 dark:text-red-300'
              )}>
                {data.netBalance.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            {/* Budget Alerts */}
            <div className={cn(
              'rounded-lg border p-3 flex flex-col gap-1.5',
              (data.budgetExceeded > 0 || data.budgetWarning > 0)
                ? 'border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900'
                : 'border-primary/20 bg-primary/10'
            )}>
              <div className="flex items-center gap-1.5 text-xs font-medium text-orange-600 dark:text-orange-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Status Anggaran
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
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
