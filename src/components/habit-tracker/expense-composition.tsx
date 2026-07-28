'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRupiah, type AnalyticsData } from '@/components/habit-tracker/finance-types';
import { CountUpRupiah } from '@/components/habit-tracker/count-up';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ── Category colour palette ──────────────────────────────────────────────
// Kopi→Red, Dating→Orange, Tak Terduga→Amber, Makanan Berat→Purple,
// Makanan Ringan→Pink, Lainnya→Blue. Assigned by rank so palette stays
// consistent regardless of actual category names in the data.
const CATEGORY_PALETTE = [
  { key: 'red',    hex: '#ef4444', soft: 'rgba(239,68,68,0.18)'  },
  { key: 'orange', hex: '#f97316', soft: 'rgba(249,115,22,0.18)' },
  { key: 'amber',  hex: '#eab308', soft: 'rgba(234,179,8,0.18)'  },
  { key: 'purple', hex: '#a855f7', soft: 'rgba(168,85,247,0.18)' },
  { key: 'pink',   hex: '#ec4899', soft: 'rgba(236,72,153,0.18)' },
  { key: 'blue',   hex: '#3b82f6', soft: 'rgba(59,130,246,0.18)' },
];

const OTHER_LABEL = 'Lainnya';

// ── Helpers ─────────────────────────────────────────────────────────────

function compactRupiah(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function fullMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

function shortMonthLabel(monthLabel: string): string {
  // monthLabel like "Feb 26" → "Feb"
  return monthLabel.split(' ')[0] || monthLabel;
}

// ── Props ───────────────────────────────────────────────────────────────

interface ExpenseCompositionProps {
  data: AnalyticsData;
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
}

// ── KPI Card with mini sparkline ────────────────────────────────────────

function KpiCard({
  emoji,
  label,
  value,
  sub,
  accent,
  spark,
  staggerIndex = 0,
}: {
  emoji: string;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent: 'red' | 'orange' | 'amber' | 'purple' | 'pink' | 'blue';
  spark?: number[];
  staggerIndex?: number;
}) {
  const accents: Record<string, string> = {
    red: 'ec-kpi-red',
    orange: 'ec-kpi-orange',
    amber: 'ec-kpi-amber',
    purple: 'ec-kpi-purple',
    pink: 'ec-kpi-pink',
    blue: 'ec-kpi-blue',
  };
  const hexMap: Record<string, string> = {
    red: '#ef4444',
    orange: '#f97316',
    amber: '#eab308',
    purple: '#a855f7',
    pink: '#ec4899',
    blue: '#3b82f6',
  };

  // Build sparkline path
  const sparkPath = useMemo(() => {
    if (!spark || spark.length < 2) return null;
    const w = 80;
    const h = 28;
    const max = Math.max(...spark);
    const min = Math.min(...spark);
    const range = max - min || 1;
    const step = w / (spark.length - 1);
    const pts = spark.map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    });
    return { line: `M ${pts.join(' L ')}`, area: `M 0,${h} L ${pts.join(' L ')} L ${w},${h} Z`, w, h };
  }, [spark]);

  return (
    <div
      className={cn('ec-kpi group anim-stagger anim-lift', accents[accent])}
      style={{ animationDelay: `${staggerIndex * 60}ms` }}
    >
      {/* Decorative gradient orb */}
      <div
        className="ec-kpi-orb"
        style={{ background: `radial-gradient(circle, ${hexMap[accent]}22 0%, transparent 70%)` }}
        aria-hidden
      />
      <div className="relative">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-sm leading-none">{emoji}</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {label}
          </span>
        </div>
        <p className="text-xl sm:text-[1.6rem] font-bold tracking-tight tabular-nums truncate leading-tight">
          {value}
        </p>
        <div className="flex items-end justify-between gap-2 mt-1.5">
          <div className="text-[11px] min-w-0 flex-1">{sub}</div>
          {sparkPath && (
            <svg
              width={sparkPath.w}
              height={sparkPath.h}
              viewBox={`0 0 ${sparkPath.w} ${sparkPath.h}`}
              className="shrink-0 ec-spark"
              aria-hidden
            >
              <defs>
                <linearGradient id={`spark-${accent}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={hexMap[accent]} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={hexMap[accent]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <path d={sparkPath.area} fill={`url(#spark-${accent})`} />
              <path
                d={sparkPath.line}
                fill="none"
                stroke={hexMap[accent]}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Custom tooltip for the area chart ───────────────────────────────────

interface AreaTooltipPayloadEntry {
  dataKey: string;
  value: number;
  color: string;
}

function AreaTooltip({
  active,
  payload,
  label,
  totals,
  palette,
}: {
  active?: boolean;
  payload?: AreaTooltipPayloadEntry[];
  label?: string;
  totals: { label: string; total: number }[];
  palette: { key: string; hex: string }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const total = totals.find((t) => t.label === label)?.total ?? 0;
  const rows = payload
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);
  return (
    <div className="ec-tooltip">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-xs font-bold">{label}</p>
        <p className="text-[11px] font-semibold tabular-nums text-foreground">
          {formatRupiah(total)}
        </p>
      </div>
      <div className="space-y-1">
        {rows.map((p) => {
          const pal = palette.find((c) => c.key === p.dataKey) || { hex: p.color };
          const pct = total > 0 ? (p.value / total) * 100 : 0;
          return (
            <div key={p.dataKey} className="flex items-center gap-2 text-[11px]">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: pal.hex }}
              />
              <span className="flex-1 truncate text-muted-foreground">{p.dataKey}</span>
              <span className="font-medium tabular-nums">{formatRupiah(p.value)}</span>
              <span className="text-muted-foreground tabular-nums w-10 text-right">
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Donut centre label ──────────────────────────────────────────────────

function DonutCenter({ total, hoveredName, hoveredValue, hoveredPct }: {
  total: number;
  hoveredName: string | null;
  hoveredValue: number | null;
  hoveredPct: number | null;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none ec-donut-center">
      {hoveredName ? (
        <>
          <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-0.5">
            {hoveredName}
          </span>
          <span className="text-sm font-bold tabular-nums leading-tight">
            {formatRupiah(hoveredValue ?? 0)}
          </span>
          <span className="text-[10px] font-medium tabular-nums text-muted-foreground mt-0.5">
            {hoveredPct?.toFixed(1)}%
          </span>
        </>
      ) : (
        <>
          <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-0.5">
            Total
          </span>
          <span className="text-sm font-bold tabular-nums leading-tight">
            {formatRupiah(total)}
          </span>
        </>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────

export default function ExpenseComposition({
  data,
  getCategoryMeta,
}: ExpenseCompositionProps) {
  const [activeSlice, setActiveSlice] = useState<number | null>(null);
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [monthRange, setMonthRange] = useState<1 | 3 | 6>(6);

  // Filter to the last N months based on the selected range.
  // The API returns 6 months — we slice client-side for instant switching.
  const allComp = data.monthlyComposition || [];
  const comp = useMemo(() => allComp.slice(-monthRange), [allComp, monthRange]);
  const hasData = comp.length > 0;

  // ── Compute top-5 categories + Lainnya ──
  const { stackedData, palette, categoryKeys, totals, lastMonth } = useMemo(() => {
    if (!hasData) {
      return {
        stackedData: [] as Record<string, string | number>[],
        palette: [] as { key: string; hex: string }[],
        categoryKeys: [] as string[],
        totals: [] as { label: string; total: number; month: string }[],
        lastMonth: null as null | { label: string; month: string; total: number; categories: Record<string, number> },
      };
    }

    const allCatsMap: Record<string, number> = {};
    comp.forEach((m) =>
      Object.entries(m.categories).forEach(([c, v]) => {
        allCatsMap[c] = (allCatsMap[c] || 0) + v;
      }),
    );
    const sortedCats = Object.entries(allCatsMap).sort(([, a], [, b]) => b - a);
    const topCats = sortedCats.slice(0, 5).map(([c]) => c);
    const otherCats = sortedCats.slice(5).map(([c]) => c);

    const catPalette: Record<string, { key: string; hex: string }> = {};
    topCats.forEach((c, i) => {
      catPalette[c] = { key: c, hex: CATEGORY_PALETTE[i % 5].hex };
    });
    if (otherCats.length > 0) {
      catPalette[OTHER_LABEL] = { key: OTHER_LABEL, hex: CATEGORY_PALETTE[5].hex };
    }
    const categoryKeys = otherCats.length > 0 ? [...topCats, OTHER_LABEL] : topCats;
    const paletteArr = categoryKeys.map((c) => catPalette[c]);

    const stackedData = comp.map((m) => {
      const row: Record<string, string | number> = { month: m.monthLabel };
      let otherTotal = 0;
      topCats.forEach((c) => {
        row[c] = Math.round(m.categories[c] || 0);
      });
      otherCats.forEach((c) => {
        otherTotal += m.categories[c] || 0;
      });
      if (otherCats.length > 0) row[OTHER_LABEL] = Math.round(otherTotal);
      return row;
    });

    const totals = comp.map((m) => ({
      label: m.monthLabel,
      month: m.month,
      total: Math.round(Object.values(m.categories).reduce((a, b) => a + b, 0)),
    }));

    const last = comp[comp.length - 1];
    const lastTotal = totals[totals.length - 1]?.total ?? 0;
    const lastMonthObj = {
      label: last.monthLabel,
      month: last.month,
      total: lastTotal,
      categories: last.categories,
    };

    return { stackedData, palette: paletteArr, categoryKeys, totals, lastMonth: lastMonthObj };
  }, [comp, hasData]);

  // ── KPI values ──
  const kpi = useMemo(() => {
    if (!hasData || totals.length === 0) {
      return {
        total: 0,
        growthPct: 0,
        avg: 0,
        highest: null as null | { label: string; month: string; total: number },
        lowest: null as null | { label: string; month: string; total: number },
      };
    }
    const total = totals[totals.length - 1].total;
    const prev = totals.length > 1 ? totals[totals.length - 2].total : total;
    const growthPct = prev > 0 ? ((total - prev) / prev) * 100 : 0;
    const avg = Math.round(totals.reduce((a, b) => a + b.total, 0) / totals.length);
    let highest = totals[0];
    let lowest = totals[0];
    for (const t of totals) {
      if (t.total > highest.total) highest = t;
      if (t.total < lowest.total) lowest = t;
    }
    return { total, growthPct, avg, highest, lowest };
  }, [totals, hasData]);

  // Sparkline arrays for KPI cards
  const totalSpark = useMemo(() => totals.map((t) => t.total), [totals]);
  const highestSpark = useMemo(() => {
    if (!kpi.highest) return [];
    return totals.map((t) => (t.month === kpi.highest!.month ? t.total : 0));
  }, [totals, kpi.highest]);
  const lowestSpark = useMemo(() => {
    if (!kpi.lowest) return [];
    return totals.map((t) => (t.month === kpi.lowest!.month ? t.total : 0));
  }, [totals, kpi.lowest]);

  // ── Donut data (last month) ──
  const donutData = useMemo(() => {
    if (!lastMonth) return [];
    const entries = categoryKeys
      .map((key) => {
        if (key === OTHER_LABEL) {
          const topSet = new Set(categoryKeys.filter((k) => k !== OTHER_LABEL));
          const otherTotal = Object.entries(lastMonth.categories)
            .filter(([c]) => !topSet.has(c))
            .reduce((a, [, v]) => a + v, 0);
          return { name: OTHER_LABEL, value: Math.round(otherTotal) };
        }
        return { name: key, value: Math.round(lastMonth.categories[key] || 0) };
      })
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
    return entries;
  }, [lastMonth, categoryKeys]);

  const donutTotal = donutData.reduce((a, b) => a + b.value, 0);

  // Hovered slice info for donut center
  const hoveredSlice = activeSlice !== null ? donutData[activeSlice] : null;
  const hoveredPct = hoveredSlice && donutTotal > 0 ? (hoveredSlice.value / donutTotal) * 100 : null;

  if (!hasData) {
    return (
      <section className="ec-section">
        <div className="ec-card h-[320px] flex flex-col items-center justify-center text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-sm font-medium text-muted-foreground">Belum ada data pengeluaran</p>
          <p className="text-xs text-muted-foreground mt-1">Mulai catat transaksi untuk melihat analisis ini.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="ec-section">
      {/* ───────────────── Header ───────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight ec-heading">
            Komposisi Pengeluaran Bulanan
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 ec-subheading">
            Lihat bagaimana distribusi pengeluaran setiap kategori berubah dari bulan ke bulan.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select value={String(monthRange)} onValueChange={(v) => setMonthRange(Number(v) as 1 | 3 | 6)}>
            <SelectTrigger className="ec-range-select">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              <SelectValue />
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-0.5" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="1">1 Bulan Terakhir</SelectItem>
              <SelectItem value="3">3 Bulan Terakhir</SelectItem>
              <SelectItem value="6">6 Bulan Terakhir</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* ───────────────── KPI Cards ───────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <KpiCard
          emoji="💳"
          label="Total Pengeluaran"
          accent="red"
          staggerIndex={0}
          value={<CountUpRupiah amount={kpi.total} />}
          spark={totalSpark}
          sub={
            totals.length > 1 ? (
              <span
                className={cn(
                  'ec-trend-pill',
                  kpi.growthPct >= 0 ? 'ec-trend-up' : 'ec-trend-down',
                )}
              >
                {kpi.growthPct >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(kpi.growthPct).toFixed(1)}%
                <span className="text-muted-foreground font-normal ml-1 hidden sm:inline">vs bln lalu</span>
              </span>
            ) : (
              <span className="text-muted-foreground">bulan terpilih</span>
            )
          }
        />
        <KpiCard
          emoji="📈"
          label="Rata-rata per Bulan"
          accent="orange"
          staggerIndex={1}
          value={<CountUpRupiah amount={kpi.avg} />}
          spark={totalSpark}
          sub={<span className="text-muted-foreground">dari {totals.length} bulan</span>}
        />
        <KpiCard
          emoji="📊"
          label="Bulan Tertinggi"
          accent="amber"
          staggerIndex={2}
          value={kpi.highest ? <CountUpRupiah amount={kpi.highest.total} /> : '-'}
          spark={highestSpark}
          sub={
            kpi.highest && (
              <span className="text-muted-foreground">{fullMonthLabel(kpi.highest.month)}</span>
            )
          }
        />
        <KpiCard
          emoji="📉"
          label="Bulan Terendah"
          accent="blue"
          staggerIndex={3}
          value={kpi.lowest ? <CountUpRupiah amount={kpi.lowest.total} /> : '-'}
          spark={lowestSpark}
          sub={
            kpi.lowest && (
              <span className="text-muted-foreground">{fullMonthLabel(kpi.lowest.month)}</span>
            )
          }
        />
      </div>

      {/* ───────────────── Main grid: Area chart + Donut panel ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Stacked Area Chart (hidden for 1-month range — single point is meaningless) ── */}
        {monthRange > 1 && (
        <div className="ec-card lg:col-span-2 ec-chart-card">
          <div className="flex items-start justify-between mb-4 gap-3">
            <div>
              <h3 className="text-sm font-semibold tracking-tight">Tren {monthRange} Bulan</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Komposisi kategori dari waktu ke waktu</p>
            </div>
            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap justify-end">
              {palette.slice(0, 6).map((p) => (
                <span
                  key={p.key}
                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-medium"
                >
                  <span
                    className="w-2 h-2 rounded-full ec-legend-dot"
                    style={{ backgroundColor: p.hex }}
                  />
                  {p.key.length > 10 ? `${p.key.slice(0, 9)}…` : p.key}
                </span>
              ))}
            </div>
          </div>

          {/* Total labels row above chart */}
          <div className="flex items-end justify-between px-1 mb-1.5 ec-totals-row">
            {totals.map((t) => {
              const isActive = activeMonth === t.label;
              return (
                <div
                  key={t.label}
                  className="flex-1 text-center ec-total-label"
                  onMouseEnter={() => setActiveMonth(t.label)}
                  onMouseLeave={() => setActiveMonth(null)}
                >
                  <div
                    className={cn(
                      'text-[11px] font-bold tabular-nums transition-all duration-200',
                      isActive ? 'text-foreground scale-110' : 'text-muted-foreground',
                    )}
                  >
                    {compactRupiah(t.total)}
                  </div>
                  <div
                    className={cn(
                      'text-[9px] uppercase tracking-wide font-medium mt-0.5 transition-colors',
                      isActive ? 'text-foreground' : 'text-muted-foreground/60',
                    )}
                  >
                    {shortMonthLabel(t.label)}
                  </div>
                </div>
              );
            })}
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              data={stackedData}
              margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              onMouseMove={(e: { activeLabel?: string }) => {
                if (e?.activeLabel) setActiveMonth(e.activeLabel);
              }}
              onMouseLeave={() => setActiveMonth(null)}
            >
              <defs>
                {palette.map((p) => {
                  const safeKey = p.key.replace(/[^a-zA-Z0-9]/g, '');
                  return (
                    <linearGradient
                      key={p.key}
                      id={`ec-grad-${safeKey}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={p.hex} stopOpacity={0.75} />
                      <stop offset="100%" stopColor={p.hex} stopOpacity={0.08} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid
                strokeDasharray="3 6"
                vertical={false}
                opacity={0.5}
                stroke="oklch(0.9 0.004 120)"
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: 'oklch(0.55 0.01 120)' }}
                tickLine={false}
                axisLine={false}
                dy={6}
                tickFormatter={(v) => shortMonthLabel(String(v))}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'oklch(0.55 0.01 120)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => compactRupiah(Number(v))}
                width={48}
              />
              <RechartsTooltip
                content={<AreaTooltip totals={totals} palette={palette} />}
                cursor={{
                  stroke: 'oklch(0.6 0.01 120)',
                  strokeWidth: 1.5,
                  strokeDasharray: '4 4',
                  opacity: 0.6,
                }}
              />
              {categoryKeys.map((key) => {
                const pal = palette.find((p) => p.key === key) || { hex: '#78716c' };
                const gradId = `ec-grad-${key.replace(/[^a-zA-Z0-9]/g, '')}`;
                return (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stackId="1"
                    stroke={pal.hex}
                    strokeWidth={1.5}
                    fill={`url(#${gradId})`}
                    animationDuration={900}
                    animationEasing="ease-out"
                    isAnimationActive
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* ── Donut panel (full-width when 1-month range hides the area chart) ── */}
        <div className={cn('ec-card ec-chart-card', monthRange === 1 ? 'lg:col-span-3' : 'lg:col-span-1')}>
          <div className="mb-4">
            <h3 className="text-sm font-semibold tracking-tight">Komposisi Bulan Terakhir</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {lastMonth ? fullMonthLabel(lastMonth.month) : ''}
            </p>
          </div>

          <div className="relative h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={80}
                  paddingAngle={2}
                  cornerRadius={6}
                  isAnimationActive
                  animationDuration={800}
                  animationEasing="ease-out"
                  onMouseEnter={(_, idx) => setActiveSlice(idx)}
                  onMouseLeave={() => setActiveSlice(null)}
                >
                  {donutData.map((d, i) => {
                    const pal = palette.find((p) => p.key === d.name) || { hex: '#78716c' };
                    const isHovered = activeSlice === i;
                    return (
                      <Cell
                        key={d.name}
                        fill={pal.hex}
                        stroke="oklch(1 0 0)"
                        strokeWidth={2}
                        opacity={activeSlice === null || isHovered ? 1 : 0.35}
                        style={{
                          transition: 'opacity 200ms ease, transform 200ms ease',
                          transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                          transformOrigin: 'center',
                          filter: isHovered
                            ? `drop-shadow(0 4px 12px ${pal.hex}55)`
                            : 'none',
                        }}
                      />
                    );
                  })}
                </Pie>
                <RechartsTooltip
                  formatter={(value: number, name: string) => [
                    formatRupiah(value),
                    name,
                  ]}
                  contentStyle={{
                    borderRadius: '12px',
                    fontSize: '11px',
                    border: '1px solid oklch(0.9 0.004 120)',
                    boxShadow: '0 8px 24px oklch(0 0 0 / 0.12)',
                    padding: '8px 12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <DonutCenter
              total={donutTotal}
              hoveredName={hoveredSlice?.name ?? null}
              hoveredValue={hoveredSlice?.value ?? null}
              hoveredPct={hoveredPct}
            />
          </div>

          {/* Legend */}
          <div className="mt-5 space-y-1">
            {donutData.map((d, i) => {
              const pal = palette.find((p) => p.key === d.name) || { hex: '#78716c' };
              const meta = d.name === OTHER_LABEL ? null : getCategoryMeta(d.name);
              const pct = donutTotal > 0 ? (d.value / donutTotal) * 100 : 0;
              const isHovered = activeSlice === i;
              return (
                <div
                  key={d.name}
                  className={cn(
                    'ec-legend-row',
                    isHovered && 'ec-legend-row-active',
                  )}
                  onMouseEnter={() => setActiveSlice(i)}
                  onMouseLeave={() => setActiveSlice(null)}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 ec-legend-dot"
                    style={{ backgroundColor: pal.hex }}
                  />
                  <span className="text-xs font-medium truncate flex-1 min-w-0">
                    {meta?.emoji ? `${meta.emoji} ` : ''}
                    {d.name}
                  </span>
                  <span className="text-xs font-semibold tabular-nums">
                    {formatRupiah(d.value)}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums w-12 text-right">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Total summary row */}
          <div className="ec-donut-total">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Total
            </span>
            <span className="text-base font-bold tabular-nums">
              {formatRupiah(donutTotal)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
