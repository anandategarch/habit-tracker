'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Info, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatRupiah } from './finance-types';
import { CountUpRupiah, CountUpNumber } from './count-up';
import type { DashboardData, LastDoneItem } from './finance-types';
import SourceBalanceSection from './source-balance';
import DailyRecap from './daily-recap';

function ChartInfo({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0" aria-label="Info">
            <Info className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface FinanceOverviewProps {
  dashboardData: DashboardData;
  lastDoneData: LastDoneItem[];
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
}

export default function FinanceOverview({
  dashboardData,
  lastDoneData,
  getCategoryMeta,
}: FinanceOverviewProps) {
  const incomeChange = dashboardData.previousMonth.income > 0
    ? Math.round(((dashboardData.totalIncome - dashboardData.previousMonth.income) / dashboardData.previousMonth.income) * 100)
    : 0;

  const expenseChange = dashboardData.previousMonth.expense > 0
    ? Math.round(((dashboardData.totalExpense - dashboardData.previousMonth.expense) / dashboardData.previousMonth.expense) * 100)
    : 0;

  return (
    <div className="space-y-4 mt-4">
      {/* ── DAILY RECAP: Today's transaction insights (premium) ──────── */}
      <DailyRecap />

      {/* Saldo per Sumber Dana */}
      <SourceBalanceSection />

      {/* ── HERO CARD: Finance Summary ─────────────────────────── */}
      <Card className="overflow-hidden anim-stagger" style={{ animationDelay: '0ms' }}>
        {/* Top section: big balance number — ACTUAL total from fund sources */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-4 py-4 sm:px-6 sm:py-5">
          <p className="text-xs text-muted-foreground font-medium">Total Saldo</p>
          <p className={cn(
            'text-2xl sm:text-3xl font-bold tracking-tight mt-0.5',
            dashboardData.balance >= 0 ? 'text-primary' : 'text-red-600'
          )}>
            <CountUpRupiah amount={dashboardData.balance} />
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            <CountUpNumber value={dashboardData.transactionCount} /> transaksi bulan ini
            {dashboardData.netCashFlow !== undefined && (
              <span className="ml-1.5">
                ·{' '}
                <span className={dashboardData.netCashFlow >= 0 ? 'text-primary' : 'text-red-500'}>
                  {dashboardData.netCashFlow >= 0 ? '+' : '−'}
                  {formatRupiah(Math.abs(dashboardData.netCashFlow))}
                </span>
                {' '}cash flow
              </span>
            )}
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Middle section: income vs expense (2 columns) */}
        <div className="grid grid-cols-2 divide-x divide-border">
          {/* Income */}
          <div className="px-4 py-3 sm:px-6">
            <div className="flex items-center gap-1 mb-0.5">
              <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">Pemasukan</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-primary"><CountUpRupiah amount={dashboardData.totalIncome} /></p>
            {dashboardData.previousMonth.income > 0 && (
              <p className={cn('text-xs mt-0.5', incomeChange >= 0 ? 'text-primary' : 'text-red-500')}>
                {incomeChange >= 0 ? '↑' : '↓'} {Math.abs(incomeChange)}% vs lalu
              </p>
            )}
          </div>

          {/* Expense */}
          <div className="px-4 py-3 sm:px-6">
            <div className="flex items-center gap-1 mb-0.5">
              <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
              <span className="text-xs font-medium text-red-500">Pengeluaran</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-red-500"><CountUpRupiah amount={dashboardData.totalExpense} /></p>
            {dashboardData.previousMonth.expense > 0 && (
              <p className={cn('text-xs mt-0.5', expenseChange <= 0 ? 'text-primary' : 'text-red-500')}>
                {expenseChange <= 0 ? '↓' : '↑'} {Math.abs(expenseChange)}% vs lalu
              </p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Bottom section: avg/day + projection (inline) */}
        <div className="px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Rata-rata:</span>
            <span className="text-xs font-semibold">{formatRupiah(dashboardData.avgDailyExpense)}/hari</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Proyeksi:</span>
            <span className="text-xs font-semibold">{formatRupiah(dashboardData.projectedMonthlyExpense)}/bln</span>
          </div>
        </div>
      </Card>

      {/* ── Last Done Tracking (compact list, no grid of cards) ── */}
      {lastDoneData.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              Terakhir Transaksi
              <ChartInfo text="Menampilkan kapan terakhir transaksi untuk kategori yang kamu tandai 'Track Terakhir Transaksi' di pengaturan Kategori. Diurutkan dari yang paling lama belum transaksi." />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-1.5">
              {lastDoneData.map(item => (
                <div key={item.category} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-b-0">
                  <span className="text-base shrink-0">{item.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.category}</p>
                    {item.daysAgo !== null ? (
                      <p className="text-xs text-muted-foreground">
                        {item.daysAgo === 0 ? 'Hari ini' : item.daysAgo === 1 ? 'Kemarin' : `${item.daysAgo} hari lalu`}
                        {item.lastAmount !== null ? ` · ${formatRupiah(item.lastAmount)}` : ''}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Belum ada transaksi</p>
                    )}
                  </div>
                  {item.daysAgo !== null && item.daysAgo > 7 && (
                    <div className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0',
                      item.daysAgo > 14 ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                    )}>
                      {item.daysAgo}d
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
