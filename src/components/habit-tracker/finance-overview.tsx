'use client';

import { ResponsiveContainer, LineChart as RechartsLineChart, Line, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, Clock, Info, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatRupiah, CHART_COLORS } from './finance-types';
import { CountUpRupiah, CountUpNumber } from './count-up';
import type { DashboardData, LastDoneItem } from './finance-types';
import SourceBalanceSection from './source-balance';

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
  dailySpendingChartData: { date: string; amount: number }[];
  categoryPieData: { name: string; value: number }[];
}

export default function FinanceOverview({
  dashboardData,
  lastDoneData,
  getCategoryMeta,
  dailySpendingChartData,
  categoryPieData,
}: FinanceOverviewProps) {
  const incomeChange = dashboardData.previousMonth.income > 0
    ? Math.round(((dashboardData.totalIncome - dashboardData.previousMonth.income) / dashboardData.previousMonth.income) * 100)
    : 0;

  const expenseChange = dashboardData.previousMonth.expense > 0
    ? Math.round(((dashboardData.totalExpense - dashboardData.previousMonth.expense) / dashboardData.previousMonth.expense) * 100)
    : 0;

  return (
    <div className="space-y-4 mt-4">
      {/* Saldo per Sumber Dana */}
      <SourceBalanceSection />

      {/* ── HERO CARD: Finance Summary ─────────────────────────── */}
      <Card className="overflow-hidden anim-stagger" style={{ animationDelay: '0ms' }}>
        {/* Top section: big balance number */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-4 py-4 sm:px-6 sm:py-5">
          <p className="text-xs text-muted-foreground font-medium">Saldo Bulan Ini</p>
          <p className={cn(
            'text-2xl sm:text-3xl font-bold tracking-tight mt-0.5',
            dashboardData.balance >= 0 ? 'text-primary' : 'text-red-600'
          )}>
            <CountUpRupiah amount={dashboardData.balance} />
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            <CountUpNumber value={dashboardData.transactionCount} /> transaksi
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

      {/* ── Charts section (2 cols on desktop, stack on mobile) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily Spending Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              Tren Pengeluaran Harian
              <ChartInfo text="Total pengeluaran per hari dalam bulan yang dipilih. Area merah menunjukkan intensitas pengeluaran." />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {dailySpendingChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailySpendingChartData}>
                  <defs>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <RechartsTooltip
                    formatter={(value: number) => [formatRupiah(value), 'Pengeluaran']}
                    contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#ef4444" fill="url(#spendGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                Belum ada data pengeluaran bulan ini
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              Pengeluaran per Kategori
              <ChartInfo text="Persentase setiap kategori dari total pengeluaran bulan ini." />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {categoryPieData.length > 0 ? (
              <div className="space-y-3">
                {categoryPieData.slice(0, 6).map((item, i) => {
                  const meta = getCategoryMeta(item.name);
                  const total = categoryPieData.reduce((s, c) => s + c.value, 0);
                  const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                  return (
                    <div key={item.name} className="flex items-center gap-2">
                      <span className="text-base">{meta.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center text-xs mb-0.5">
                          <span className="truncate font-medium">{item.name}</span>
                          <span className="text-muted-foreground ml-1 shrink-0">{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                📊 Belum ada data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Budget Overview (compact list, no grid of cards) ── */}
      {dashboardData.budgetStatus.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4" />
              Status Budget Bulan Ini
              <ChartInfo text="Membandingkan total pengeluaran per kategori dengan batas anggaran." />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-3">
              {dashboardData.budgetStatus.map(b => {
                const meta = getCategoryMeta(b.category);
                const isOver = (b.percentage || 0) > 100;
                return (
                  <div key={b.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{meta.emoji} {b.category}</span>
                      <span className={cn('text-xs shrink-0', isOver ? 'text-red-500 font-semibold' : 'text-muted-foreground')}>
                        {formatRupiah(b.spent || 0)} / {formatRupiah(b.amount)}
                      </span>
                    </div>
                    <Progress
                      value={Math.min((b.percentage || 0), 100)}
                      className={cn('h-2', isOver && '[&>div]:bg-red-500')}
                    />
                    {isOver && (
                      <p className="text-xs text-red-500">Over budget {formatRupiah((b.spent || 0) - b.amount)}</p>
                    )}
                  </div>
                );
              })}
            </div>
            {dashboardData.totalBudget > 0 && (
              <div className="mt-3 pt-3 border-t flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span>Total Budget: {formatRupiah(dashboardData.totalBudget)}</span>
                <span>Terpakai: {formatRupiah(dashboardData.totalBudgetSpent)} ({Math.round((dashboardData.totalBudgetSpent / dashboardData.totalBudget) * 100)}%)</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
