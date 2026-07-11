'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const CATEGORY_COLORS = [
  'hsl(142, 71%, 45%)',
  'hsl(160, 84%, 39%)',
  'hsl(174, 72%, 35%)',
  'hsl(84, 81%, 44%)',
  'hsl(142, 71%, 55%)',
  'hsl(160, 84%, 50%)',
  'hsl(174, 72%, 46%)',
  'hsl(84, 81%, 55%)',
];

function ChartInfo({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Info">
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

interface DashboardChartsProps {
  weeklyBarData: { day: string; label: string; date: string; completed: number; total: number; rate: number }[];
  categoryPerformance: { category: string; done: number; total: number; rate: number }[];
  monthlyChartData: { day: string; completed: number; total: number; rate: number }[];
  stackedBarData: { day: string; completed: number; missed: number; total: number; rate: number }[];
  weeklyPattern: { day: string; fullDay: string; rate: number; avgCompleted: string }[];
  chartLabel: string;
}

export default function DashboardCharts({
  weeklyBarData,
  categoryPerformance,
  monthlyChartData,
  stackedBarData,
  weeklyPattern,
  chartLabel,
}: DashboardChartsProps) {
  return (
    <>
      {/* ── Middle Row: Weekly Chart + Category Performance ─────── */}
      <section aria-label="Charts" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <CardContent className="p-0">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              Weekly Completion
              <ChartInfo text="Jumlah habit yang diselesaikan (hijau) vs tidak diselesaikan (merah) per hari dalam 7 hari terakhir. Total harian = jumlah habit aktif pada tanggal tersebut." />
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyBarData} margin={{ top: 20, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`${value}%`, 'Completion']}
                  />
                  <Bar dataKey="rate" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {weeklyBarData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.rate >= 80 ? 'hsl(142, 71%, 45%)' : entry.rate >= 50 ? 'hsl(142, 71%, 60%)' : 'hsl(142, 71%, 75%)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardContent className="p-0">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              Category Performance
              <ChartInfo text="Rasio penyelesaian per kategori: (jumlah log completed) / (jumlah habit × jumlah hari sejak habit pertama dibuat dalam kategori)." />
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryPerformance}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                    width={80}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`${value}%`, 'Rate']}
                  />
                  <Bar dataKey="rate" radius={[0, 6, 6, 0]} maxBarSize={20}>
                    {categoryPerformance.map((_, index) => (
                      <Cell
                        key={index}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                        fillOpacity={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Monthly/Period Trend Chart (Full Width) ────────────── */}
      <section aria-label="Period trend">
        <Card className="p-4">
          <CardContent className="p-0">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              {chartLabel} Completion Trend
              <ChartInfo text="Tren persentase penyelesaian harian selama periode yang dipilih. Setiap titik menunjukkan rasio habit completed terhadap total habit aktif pada hari tersebut." />
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`${value}%`, 'Completion']}
                  />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke="hsl(142, 71%, 45%)"
                    strokeWidth={2}
                    fill="url(#greenGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Stacked Bar: Completed vs Missed + Weekly Pattern ──────────── */}
      <section aria-label="Habit completion detail" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <CardContent className="p-0">
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
              {chartLabel} Detail
              <ChartInfo text="Setiap bar menunjukkan jumlah habit completed (hijau) vs missed (merah) per hari. Total harian = jumlah habit yang aktif pada tanggal tersebut, bukan jumlah log." />
            </h3>
            <p className="text-[10px] text-muted-foreground mb-3">Selesai vs Tidak selesai per hari</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stackedBarData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="completed" stackId="a" fill="hsl(142, 71%, 45%)" radius={[0, 0, 0, 0]} maxBarSize={24} name="Selesai" />
                  <Bar dataKey="missed" stackId="a" fill="hsl(0, 0%, 88%)" radius={[4, 4, 0, 0]} maxBarSize={24} name="Tidak" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Pattern */}
        <Card className="p-4">
          <CardContent className="p-0">
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
              Pola Mingguan
              <ChartInfo text="Rata-rata tingkat penyelesaian per hari dalam seminggu selama 30 hari terakhir. Misal Senin = rata-rata completion rate semua hari Senin dalam 30 hari." />
            </h3>
            <p className="text-[10px] text-muted-foreground mb-3">Rata-rata completion rate per hari (30 hari terakhir)</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyPattern} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'rate') return [`${value}%`, 'Completion'];
                      return [value, name];
                    }}
                    labelFormatter={(label: string) => {
                      const item = weeklyPattern.find(p => p.day === label);
                      return item?.fullDay || label;
                    }}
                  />
                  <Bar dataKey="rate" radius={[6, 6, 0, 0]} maxBarSize={32}>
                    {weeklyPattern.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.rate >= 80 ? 'hsl(142, 71%, 45%)' : entry.rate >= 50 ? 'hsl(142, 71%, 60%)' : 'hsl(142, 71%, 75%)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}