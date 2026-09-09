'use client';

// components/habit-tracker/dashboard-charts.tsx — 5 grafik tab Dashboard
// (recharts). Kontrak visual "Rutina Aurora": container div.premium-card
// premium-card-sheen rounded-2xl + header .premium-label + ikon .chip-soft.
//
// - Semua label Indonesia: mingguan "Sen/Sel/…" & bulanan "8 Sep" datang
//   dari mapper (lib/dashboard/contract.ts) via eeeIdFormatter/
//   mmmDdIdFormatter — BUKAN format() TZ lokal browser.
// - Bar mingguan → 1-klik openTrackerDate(date) (wiring 4-a; klik kategori
//   sengaja TIDAK wired — fix 6-a FIX-2: kategori habit ≠ kategori finance).
// - Bar "Terlewat" memakai fill var(--muted-foreground) + fillOpacity 0.35
//   (dark-mode aman — fix 6-a FIX-3).
// - Tooltip berbahasa Indonesia ("Penyelesaian", "Terlewat").

import { useMemo } from 'react';

// Tipe formatter tooltip kompatibel dgn recharts v3 (ValueType/NameType
// tidak diekspor langsung dari paket di v3 — definisi lokal identik).
type TooltipVal = number | string | Array<number | string>;
type TooltipName = number | string;
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { LucideIcon } from 'lucide-react';
import { BarChart3, CalendarDays, Layers, Tags, TrendingUp } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { mmmDdIdFormatter } from '@/lib/date-utils';
import { dateFromYMD } from '@/lib/timezone';
import { isValidYMD } from '@/lib/timezone';
import { cn } from '@/lib/utils';
import { ChartInfo } from './dashboard-helpers';
import type {
  CategoryPerformance,
  MonthlyChartDatum,
  StackedBarDatum,
  WeeklyPatternDatum,
} from './dashboard-types';

interface WeeklyBarDatum extends Record<string, unknown> {
  date: string;
  day: string;
  rate: number;
  label: string;
}

interface DashboardChartsProps {
  weeklyBarData: WeeklyBarDatum[];
  categoryPerformance: CategoryPerformance[];
  monthlyChartData: MonthlyChartDatum[];
  stackedBarData: StackedBarDatum[];
  weeklyPattern: WeeklyPatternDatum[];
  chartLabel: string;
  /** Granularitas monthlyChartData — 'week' = agregasi mingguan (M-3). */
  chartUnit?: 'day' | 'week';
}

const CATEGORY_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

function ChartHeader({
  icon: Icon,
  title,
  chipClass,
  info,
}: {
  icon: LucideIcon;
  title: string;
  chipClass: string;
  info: string;
}) {
  return (
    <h3 className="premium-label mb-4 flex items-center gap-2">
      <span className={cn('chip-soft h-8 w-8 justify-center', chipClass)} aria-hidden="true">
        <Icon className="h-4 w-4" />
      </span>
      {title}
      <ChartInfo text={info} />
    </h3>
  );
}

function ChartEmpty({ text }: { text: string }) {
  return (
    <div className="premium-empty py-6">
      <div className="premium-empty-orb">
        <BarChart3 className="h-7 w-7" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}

export default function DashboardCharts({
  weeklyBarData,
  categoryPerformance,
  monthlyChartData,
  stackedBarData,
  weeklyPattern,
  chartLabel,
  chartUnit = 'day',
}: DashboardChartsProps) {
  const openTrackerDate = useAppStore((s) => s.openTrackerDate);
  // Fix 11-c M-3: judul & penjelasan chart jujur terhadap granularitas data
  // (harian vs agregasi mingguan) dan jendela periode yang sebenarnya.
  const isWeekly = chartUnit === 'week';
  const trendInfo = isWeekly
    ? `Jumlah habit yang selesai per minggu (agregasi mingguan, label = awal minggu) selama ${chartLabel.toLowerCase()}.`
    : `Jumlah habit yang selesai per hari selama ${chartLabel.toLowerCase()}.`;

  // ONE-CLICK (4-a): klik batang mingguan → buka tracker pada tanggal bar.
  // Handler defensif: recharts 2.x mengirim datum (dengan .payload) — dua
  // bentuk sama-sama ditangani, tanggal divalidasi YMD ketat.
  const handleWeeklyBarClick = (data: unknown) => {
    const d = data as { date?: string; payload?: { date?: string } } | null | undefined;
    const dateKey = d?.payload?.date ?? d?.date;
    if (typeof dateKey === 'string' && isValidYMD(dateKey)) {
      openTrackerDate(dateKey);
    }
  };

  const monthlyData = useMemo(
    () =>
      monthlyChartData.map((d) => ({
        ...d,
        label: mmmDdIdFormatter(dateFromYMD(d.date)),
      })),
    [monthlyChartData],
  );

  return (
    <section aria-label="Grafik dashboard" className="space-y-4">
      {/* ── Baris 1: Gambaran Mingguan + Performa Kategori ─────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5">
          <ChartHeader
            icon={BarChart3}
            title="Gambaran Mingguan"
            chipClass="chip-soft-teal"
            info="Persentase habit yang selesai per hari selama 7 hari terakhir. Klik batang untuk membuka tracker harian pada tanggal tersebut."
          />
          {weeklyBarData.length === 0 ? (
            <ChartEmpty text="Belum ada data mingguan" />
          ) : (
            <ChartContainer
              config={{ rate: { label: 'Penyelesaian', color: 'var(--primary)' } }}
              className="h-64 w-full cursor-pointer"
            >
              <BarChart data={weeklyBarData} margin={{ top: 8, bottom: 0, left: 0, right: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis hide domain={[0, 100]} />
                <ChartTooltip
                  cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label: unknown, payload: unknown) => {
                        const first = Array.isArray(payload)
                          ? (payload[0] as { payload?: { day?: string; date?: string } } | undefined)
                          : undefined;
                        const datum = first?.payload;
                        if (datum?.day && datum?.date) {
                          return `${datum.day}, ${mmmDdIdFormatter(dateFromYMD(datum.date))}`;
                        }
                        return String(label ?? '');
                      }}
                      formatter={(value: TooltipVal, name: TooltipName) => (
                        <div className="flex w-full items-center justify-between gap-4 leading-none">
                          <span className="text-muted-foreground">{name}</span>
                          <span className="font-mono font-medium tabular-nums text-foreground">
                            {Array.isArray(value) ? value.join('/') : value}%
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Bar
                  dataKey="rate"
                  name="Penyelesaian"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                  fill="var(--primary)"
                  onClick={handleWeeklyBarClick}
                />
              </BarChart>
            </ChartContainer>
          )}
        </div>

        <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5">
          <ChartHeader
            icon={Tags}
            title="Performa Kategori"
            chipClass="chip-soft-violet"
            info="Jumlah penyelesaian habit per kategori dalam periode yang dipilih."
          />
          {categoryPerformance.length === 0 ? (
            <ChartEmpty text="Belum ada data kategori" />
          ) : (
            <ChartContainer
              config={{ count: { label: 'Penyelesaian', color: 'var(--chart-1)' } }}
              className="h-64 w-full"
              role="img"
              aria-label="Grafik jumlah penyelesaian habit per kategori"
            >
              <BarChart
                data={categoryPerformance}
                layout="vertical"
                margin={{ top: 0, right: 12, bottom: 0, left: 8 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="category"
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.4 }} content={<ChartTooltipContent />} />
                <Bar dataKey="count" name="Penyelesaian" radius={[0, 6, 6, 0]} maxBarSize={18}>
                  {categoryPerformance.map((entry) => (
                    <Cell
                      key={entry.category}
                      fill={CATEGORY_COLORS[entry.category.charCodeAt(0) % CATEGORY_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </div>
      </div>

      {/* ── Baris 2: Tren Penyelesaian (lebar penuh) ───────────────────── */}
      <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5">
        <ChartHeader
          icon={TrendingUp}
          title={`Tren Penyelesaian — ${chartLabel}`}
          chipClass="chip-soft-teal"
          info={trendInfo}
        />
        {monthlyData.length === 0 ? (
          <ChartEmpty text="Belum ada data tren" />
        ) : (
          <ChartContainer
            config={{ completed: { label: 'Penyelesaian', color: 'var(--primary)' } }}
            className="h-72 w-full"
            role="img"
            aria-label="Grafik tren jumlah habit selesai per hari"
          >
            <AreaChart data={monthlyData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="dashMonthlyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis hide />
              <ChartTooltip
                cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
                content={
                  <ChartTooltipContent
                    formatter={(value: TooltipVal, name: TooltipName) => (
                      <div className="flex w-full items-center justify-between gap-4 leading-none">
                        <span className="text-muted-foreground">{name}</span>
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {value}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="completed"
                name="Penyelesaian"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#dashMonthlyFill)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </div>

      {/* ── Baris 3: Detail bertumpuk + Pola Mingguan ──────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5">
          <ChartHeader
            icon={Layers}
            title="Detail Penyelesaian"
            chipClass="chip-soft-amber"
            info={
              isWeekly
                ? 'Perbandingan habit selesai (teal) vs terlewat (abu) per minggu — agregasi mingguan, label = awal minggu.'
                : 'Perbandingan habit selesai (teal) vs terlewat (abu) per hari — batang atas adalah yang selesai.'
            }
          />
          {stackedBarData.length === 0 ? (
            <ChartEmpty text="Belum ada data detail" />
          ) : (
            <ChartContainer
              config={{
                completed: { label: 'Penyelesaian', color: 'var(--primary)' },
                missed: { label: 'Terlewat', color: 'var(--muted-foreground)' },
              }}
              className="h-64 w-full"
              role="img"
              aria-label="Grafik bertumpuk habit selesai dan terlewat per hari"
            >
              <BarChart data={stackedBarData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
                <YAxis hide />
                <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.4 }} content={<ChartTooltipContent />} />
                <Bar dataKey="completed" name="Penyelesaian" stackId="detail" fill="var(--primary)" />
                <Bar
                  dataKey="missed"
                  name="Terlewat"
                  stackId="detail"
                  fill="var(--muted-foreground)"
                  fillOpacity={0.35}
                />
              </BarChart>
            </ChartContainer>
          )}
        </div>

        <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5">
          <ChartHeader
            icon={CalendarDays}
            title="Pola Mingguan"
            chipClass="chip-soft-violet"
            info="Rata-rata persentase penyelesaian untuk tiap hari dalam seminggu (Senin–Minggu), dihitung dari 90 hari terakhir."
          />
          {weeklyPattern.length === 0 ? (
            <ChartEmpty text="Belum ada pola mingguan" />
          ) : (
            <ChartContainer
              config={{ rate: { label: 'Penyelesaian', color: 'var(--chart-2)' } }}
              className="h-64 w-full"
              role="img"
              aria-label="Grafik rata-rata penyelesaian per hari dalam seminggu"
            >
              <BarChart data={weeklyPattern} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis hide domain={[0, 100]} />
                <ChartTooltip
                  cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                  content={
                    <ChartTooltipContent
                      formatter={(value: TooltipVal, name: TooltipName) => (
                        <div className="flex w-full items-center justify-between gap-4 leading-none">
                          <span className="text-muted-foreground">{name}</span>
                          <span className="font-mono font-medium tabular-nums text-foreground">
                            {Array.isArray(value) ? value.join('/') : value}%
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Bar dataKey="rate" name="Penyelesaian" radius={[6, 6, 0, 0]} maxBarSize={28} fill="var(--chart-2)" />
              </BarChart>
            </ChartContainer>
          )}
        </div>
      </div>
    </section>
  );
}
