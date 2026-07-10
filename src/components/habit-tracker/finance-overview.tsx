'use client';

import { ResponsiveContainer, LineChart as RechartsLineChart, Line, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, Clock, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatRupiah, CHART_COLORS } from './finance-types';
import type { DashboardData, LastDoneItem } from './finance-types';

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-green-700 dark:text-green-400">Pemasukan</span>
            </div>
            <p className="text-xl font-bold text-green-700 dark:text-green-400">{formatRupiah(dashboardData.totalIncome)}</p>
            {dashboardData.previousMonth.income > 0 && (
              <p className={cn('text-[11px] mt-1', incomeChange >= 0 ? 'text-green-600' : 'text-red-500')}>
                {incomeChange >= 0 ? '↑' : '↓'} {Math.abs(incomeChange)}% vs bulan lalu
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-red-700 dark:text-red-400">Pengeluaran</span>
            </div>
            <p className="text-xl font-bold text-red-700 dark:text-red-400">{formatRupiah(dashboardData.totalExpense)}</p>
            {dashboardData.previousMonth.expense > 0 && (
              <p className={cn('text-[11px] mt-1', expenseChange <= 0 ? 'text-green-600' : 'text-red-500')}>
                {expenseChange <= 0 ? '↓' : '↑'} {Math.abs(expenseChange)}% vs bulan lalu
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Saldo</span>
            </div>
            <p className={cn('text-xl font-bold', dashboardData.balance >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-red-600')}>
              {formatRupiah(dashboardData.balance)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {dashboardData.transactionCount} transaksi
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Rata-rata/hari</span>
            </div>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{formatRupiah(dashboardData.avgDailyExpense)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Proyeksi: {formatRupiah(dashboardData.projectedMonthlyExpense)}/bulan
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Last Done Tracking Card */}
      {lastDoneData.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              Terakhir Transaksi
              <ChartInfo text="Menampilkan kapan terakhir transaksi untuk kategori yang kamu tandai 'Track Terakhir Transaksi' di pengaturan Kategori. Diurutkan dari yang paling lama belum transaksi." />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {lastDoneData.map(item => (
                <div key={item.category} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card">
                  <span className="text-lg">{item.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.category}</p>
                    {item.daysAgo !== null ? (
                      <>
                        <p className={cn('text-[11px]', item.daysAgo <= 3 ? 'text-green-600' : item.daysAgo <= 7 ? 'text-amber-600' : 'text-red-500')}>
                          {item.daysAgo === 0 ? 'Hari ini' : item.daysAgo === 1 ? 'Kemarin' : `${item.daysAgo} hari lalu`}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.lastDate ? format(new Date(item.lastDate), 'EEE, d MMM', { locale: idLocale }) : ''}
                          {item.lastAmount !== null ? ` · ${formatRupiah(item.lastAmount)}` : ''}
                        </p>
                      </>
                    ) : (
                      <p className="text-[11px] text-muted-foreground italic">Belum ada transaksi</p>
                    )}
                  </div>
                  {item.daysAgo !== null && item.daysAgo > 7 && (
                    <div className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
                      item.daysAgo > 14 ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                    )}>
                      {item.daysAgo > 14 ? '⚠️' : '🕐'} {item.daysAgo}d
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily Spending Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              Tren Pengeluaran Harian
              <ChartInfo text="Total pengeluaran per hari dalam bulan yang dipilih. Area merah menunjukkan intensitas pengeluaran. Tanggal tanpa transaksi tidak ditampilkan." />
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
              <ChartInfo text="Persentase setiap kategori dari total pengeluaran bulan ini. Hanya 6 kategori teratas yang ditampilkan. Persentase = (jumlah kategori) / (total pengeluaran) × 100%." />
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
                Belum ada data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budget Overview */}
      {dashboardData.budgetStatus.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4" />
              Status Budget Bulan Ini
              <ChartInfo text="Membandingkan total pengeluaran per kategori dengan batas anggaran. Progress bar kuning jika >80%, merah jika melebihi anggaran. Sisa/hari = (sisa anggaran) / (sisa hari di bulan ini)." />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dashboardData.budgetStatus.map(b => {
                const meta = getCategoryMeta(b.category);
                const isOver = (b.percentage || 0) > 100;
                return (
                  <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                    <span className="text-xl">{meta.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="font-medium truncate">{b.category}</span>
                        <span className={cn('shrink-0 font-semibold', isOver ? 'text-red-500' : 'text-muted-foreground')}>
                          {formatRupiah(b.spent || 0)} / {formatRupiah(b.amount)}
                        </span>
                      </div>
                      <Progress
                        value={Math.min((b.percentage || 0), 100)}
                        className={cn('h-2', isOver && '[&>div]:bg-red-500')}
                      />
                      {isOver && (
                        <p className="text-[10px] text-red-500 mt-0.5">Over budget {formatRupiah((b.spent || 0) - b.amount)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {dashboardData.totalBudget > 0 && (
              <div className="mt-3 pt-3 border-t flex justify-between text-xs text-muted-foreground">
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