// ---------------------------------------------------------------------------
// CategoryDetailView — drill-down view for a single category.
// Extracted from category-explorer.tsx during SPLIT-PHASE3.
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
// MiniProgressRing is kept local here (only used by the histogram). When a
// shared `src/components/ui/progress-ring.tsx` lands, it can be lifted out.
// ---------------------------------------------------------------------------

'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts';
import {
  ChevronLeft,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Receipt,
  Clock,
  Wallet,
  ArrowUpRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import { formatRupiah, type Transaction } from './finance-types';
import { CountUpRupiah, CountUpNumber } from './count-up';
import { jakartaDateKey } from '@/lib/timezone';
import { formatTxTime, formatDateShort } from '@/lib/finance-helpers';
import { DowLineChart } from './category-explorer-dow-chart';
import { monthLabel, compactRupiahSafe } from './category-explorer-helpers';
import type { CategoryTotal, DailyData } from './category-explorer-types';

// ── MiniProgressRing: circular progress ring for histogram ──────────────

function MiniProgressRing({
  percentage,
  size = 48,
  strokeWidth = 3.5,
  color,
  isHighlighted = false,
  children,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  isHighlighted?: boolean;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.min(Math.max(percentage, 0), 100);
  const offset = circumference - (clampedPct / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Highlight glow ring for dominant bucket */}
        {isHighlighted && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius + 1.5}
            fill="none"
            stroke={color}
            strokeWidth="1"
            opacity="0.2"
          />
        )}
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
          opacity={isHighlighted ? 1 : 0.5}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

// ── Module-scope constants (hoisted out of component for reuse) ──────────
//
// PERF-REACT-1 fix: `new Intl.DateTimeFormat(...)` was being constructed
// inside per-transaction loops (peak-hour + time-of-day), creating hundreds
// of formatter objects per render for a category with many transactions.
// Hoisting the formatter to module scope means it is created once on module
// load and reused for the lifetime of the app.
const JAKARTA_HOUR_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  hour12: false,
});

const DOW_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// ── CategoryDetailView ─────────────────────────────────────────────────

export interface CategoryDetailViewProps {
  cat: CategoryTotal;
  transactions: Transaction[];
  prevTransactions: Transaction[];
  selectedMonth: string;
  monthOptions: { value: string; label: string }[];
  onBack: () => void;
  onSelectMonth: (m: string) => void;
}

export function CategoryDetailView({
  cat,
  transactions,
  prevTransactions,
  selectedMonth,
  monthOptions,
  onBack,
  onSelectMonth,
}: CategoryDetailViewProps) {
  // ONE-CLICK-8 (Task 4-b A.7): 1-tap jump from a category's analytics
  // detail to the Transactions sub-tab with this category's filter applied
  // (openFinanceFocus). The explorer's month is mirrored to the global month
  // picker first so the filtered list shows the same period being explored.
  const setStoreMonth = useAppStore(s => s.setSelectedMonth);
  const openFinanceFocus = useAppStore(s => s.openFinanceFocus);

  const handleViewTransactions = () => {
    setStoreMonth(selectedMonth);
    openFinanceFocus({ category: cat.name });
  };

  // PERF-REACT-1 fix: ALL 9 heavy derived datasets (catTx filter/sort,
  // dailyMap, chartData with 7-day moving avg, peakHour, timeOfDayMap,
  // sourceList, dowMap, histogram, anomalies) are wrapped in a single
  // useMemo so they only recompute when transactions, prevTransactions,
  // cat, or selectedMonth changes. Previously every render iterated
  // catTx 5+ times and constructed two `new Intl.DateTimeFormat(...)`
  // instances inside per-tx loops. The formatter is now hoisted to
  // module scope (JAKARTA_HOUR_FORMAT above) and reused.
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
  } = useMemo(() => {
    // Filter transactions for this category
    const catTx = transactions
      .filter((t) => t.category === cat.name)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Build daily breakdown for chart
    const [yy, mm] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(yy, mm, 0).getDate();
    const dailyMap = new Map<number, { total: number; count: number }>();
    for (const tx of catTx) {
      const day = parseInt(jakartaDateKey(new Date(tx.date)).slice(8, 10), 10);
      const existing = dailyMap.get(day) ?? { total: 0, count: 0 };
      existing.total += tx.amount || 0;
      existing.count += 1;
      dailyMap.set(day, existing);
    }

    let cumulative = 0;
    const chartData: DailyData[] = [];
    // Build raw daily totals first for moving average calculation
    const rawTotals: number[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const data = dailyMap.get(d);
      rawTotals.push(data?.total ?? 0);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const data = dailyMap.get(d);
      cumulative += data?.total ?? 0;
      const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
      const dateObj = new Date(Number(selectedMonth.split('-')[0]), Number(selectedMonth.split('-')[1]) - 1, d);
      const dayLabel = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      const axisLabel = d % 5 === 0 || d === 1 ? dayLabel : '';
      // 7-day moving average centered on current day (3 days before + current + 3 after)
      // Shows fluctuation trend instead of cumulative (which always goes up).
      const windowStart = Math.max(0, d - 4); // 0-indexed, 3 days before
      const windowEnd = Math.min(daysInMonth, d + 3); // 3 days after
      const window = rawTotals.slice(windowStart, windowEnd);
      const movingAvg = window.length > 0
        ? Math.round(window.reduce((s, v) => s + v, 0) / window.length)
        : 0;
      chartData.push({
        day: d,
        date: dateStr,
        label: axisLabel,
        dateLabel: dayLabel,
        total: data?.total ?? 0,
        count: data?.count ?? 0,
        cumulative,
        movingAvg,
      });
    }

    // Stats
    const avgPerTx = catTx.length > 0 ? Math.round(cat.total / catTx.length) : 0;
    const activeDays = dailyMap.size;
    const avgPerDay = activeDays > 0 ? Math.round(cat.total / activeDays) : 0;
    const maxTx = catTx.reduce((max, t) => (t.amount > max.amount ? t : max), catTx[0] ?? { amount: 0, description: '', date: '' });
    const maxDay = Array.from(dailyMap.entries()).reduce(
      (max, [day, v]) => (v.total > max.total ? { day, total: v.total } : max),
      { day: 0, total: 0 }
    );

    // Peak hour pattern (uses hoisted JAKARTA_HOUR_FORMAT instead of
    // creating a new Intl.DateTimeFormat per iteration)
    const hourMap = new Map<number, number>();
    for (const tx of catTx) {
      const h = parseInt(JAKARTA_HOUR_FORMAT.format(new Date(tx.date)), 10) % 24;
      hourMap.set(h, (hourMap.get(h) ?? 0) + 1);
    }
    const peakHour = Array.from(hourMap.entries()).reduce(
      (max, [h, count]) => (count > max.count ? { hour: h, count } : max),
      { hour: 0, count: 0 }
    );

    // ── B4: vs Last Month comparison ──────────────────────────────────
    const prevCatTx = prevTransactions.filter((t) => t.category === cat.name);
    const prevTotal = prevCatTx.reduce((s, t) => s + (t.amount || 0), 0);
    const vsLastMonthPct = prevTotal > 0
      ? Math.round(((cat.total - prevTotal) / prevTotal) * 100)
      : null;
    const vsLastMonthDir = vsLastMonthPct === null ? 'unknown'
      : vsLastMonthPct > 0 ? 'up'
      : vsLastMonthPct < 0 ? 'down'
      : 'same';

    // ── A2: Time-of-day distribution ──────────────────────────────────
    const timeOfDayMap = {
      pagi: { label: '🌅 Pagi (5-12)', count: 0, total: 0, hours: '05:00-11:59' },
      siang: { label: '☀️ Siang (12-17)', count: 0, total: 0, hours: '12:00-16:59' },
      sore: { label: '🌆 Sore (17-22)', count: 0, total: 0, hours: '17:00-21:59' },
      malam: { label: '🌙 Malam (22-5)', count: 0, total: 0, hours: '22:00-04:59' },
    };
    for (const tx of catTx) {
      const h = parseInt(JAKARTA_HOUR_FORMAT.format(new Date(tx.date)), 10) % 24;
      if (h >= 5 && h < 12) { timeOfDayMap.pagi.count++; timeOfDayMap.pagi.total += tx.amount || 0; }
      else if (h >= 12 && h < 17) { timeOfDayMap.siang.count++; timeOfDayMap.siang.total += tx.amount || 0; }
      else if (h >= 17 && h < 22) { timeOfDayMap.sore.count++; timeOfDayMap.sore.total += tx.amount || 0; }
      else { timeOfDayMap.malam.count++; timeOfDayMap.malam.total += tx.amount || 0; }
    }
    const maxTimeSlot = Math.max(
      timeOfDayMap.pagi.count, timeOfDayMap.siang.count,
      timeOfDayMap.sore.count, timeOfDayMap.malam.count, 1
    );
    const topTimeSlot = Object.entries(timeOfDayMap).reduce(
      (max, [key, v]) => v.count > max.count ? { key, ...v } : max,
      { key: '', label: '', count: 0, total: 0, hours: '' }
    );

    // ── C9: Source breakdown ──────────────────────────────────────────
    const sourceMap = new Map<string, number>();
    for (const tx of catTx) {
      sourceMap.set(tx.source, (sourceMap.get(tx.source) ?? 0) + (tx.amount || 0));
    }
    const sourceList = Array.from(sourceMap.entries())
      .map(([name, total]) => ({
        name,
        total,
        percentage: cat.total > 0 ? Math.round((total / cat.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // ── E15: Daily average for chart reference line ───────────────────
    const dailyAverage = activeDays > 0 ? Math.round(cat.total / activeDays) : 0;

    // ── A1: Day-of-week breakdown ─────────────────────────────────────
    const dowMap = new Array(7).fill(0).map(() => ({ total: 0, count: 0 }));
    for (const tx of catTx) {
      const dateKey = jakartaDateKey(new Date(tx.date));
      const d = new Date(dateKey + 'T00:00:00Z');
      const dow = d.getUTCDay();
      dowMap[dow].total += tx.amount || 0;
      dowMap[dow].count += 1;
    }
    const dowTop = dowMap.reduce<{ idx: number; total: number; count: number }>(
      (max, d, i) => (d.total > max.total ? { idx: i, total: d.total, count: d.count } : max),
      { idx: 0, total: 0, count: 0 }
    );
    const dowData = dowMap.map((d, i) => ({
      day: DOW_NAMES[i],
      total: d.total,
      count: d.count,
      pct: cat.total > 0 ? Math.round((d.total / cat.total) * 100) : 0,
    }));

    // ── C8: Amount distribution histogram ─────────────────────────────
    const histogram = (() => {
      if (catTx.length === 0) return [];
      // Determine bucket boundaries from max tx
      const max = Math.max(...catTx.map((t) => t.amount || 0), 1);
      // Create 5 buckets: 0-20%, 20-40%, 40-60%, 60-80%, 80-100% of max
      const bucketSize = max / 5;
      const buckets = new Array(5).fill(0).map((_, i) => ({
        range: `${compactRupiahSafe(Math.round(i * bucketSize))}-${compactRupiahSafe(Math.round((i + 1) * bucketSize))}`,
        count: 0,
        total: 0,
      }));
      for (const tx of catTx) {
        const amt = tx.amount || 0;
        let idx = Math.floor(amt / bucketSize);
        if (idx >= 5) idx = 4; // clamp max into last bucket
        if (idx < 0) idx = 0;
        buckets[idx].count++;
        buckets[idx].total += amt;
      }
      return buckets;
    })();
    const histMaxCount = Math.max(...histogram.map((b) => b.count), 1);
    const dominantBucket = histogram.reduce<{ idx: number; range: string; count: number; total: number }>(
      (max, b, i) => (b.count > max.count ? { idx: i, range: b.range, count: b.count, total: b.total } : max),
      { idx: 0, range: '', count: 0, total: 0 }
    );

    // ── D11: Personality tag ──────────────────────────────────────────
    const personalityTag = (() => {
      if (catTx.length === 0) return null;
      // Check weekend dominance
      const weekendCount = dowMap[0].count + dowMap[6].count; // Sun + Sat
      const weekendPct = catTx.length > 0 ? weekendCount / catTx.length : 0;
      // Check morning dominance
      const morningPct = catTx.length > 0 ? timeOfDayMap.pagi.count / catTx.length : 0;
      // Check frequency (transactions per active day)
      const freq = activeDays > 0 ? catTx.length / activeDays : 0;
      // Check if high spender (>30% of grand total)
      const isHighSpender = cat.percentage >= 30;

      if (isHighSpender) {
        return { tag: 'Pengeluar Besar', emoji: '💸', desc: '>30% dari total pengeluaran bulan ini' };
      }
      if (freq >= 1.5) {
        return { tag: 'Ritual Harian', emoji: '🔄', desc: 'Rata-rata lebih dari 1× per hari aktif' };
      }
      if (weekendPct >= 0.5) {
        return { tag: 'Boros Akhir Pekan', emoji: '🎉', desc: `${Math.round(weekendPct * 100)}% transaksi di weekend` };
      }
      if (morningPct >= 0.7) {
        return { tag: 'Ritual Pagi', emoji: '🌅', desc: `${Math.round(morningPct * 100)}% transaksi di pagi hari` };
      }
      if (catTx.length < 4) {
        return { tag: 'Sekali-sekali', emoji: '🍃', desc: 'Kurang dari 4× per bulan' };
      }
      return { tag: 'Pengeluar Stabil', emoji: '⚖️', desc: 'Pola spending yang konsisten' };
    })();

    // ── D12: Anomaly detection ────────────────────────────────────────
    const anomalies = (() => {
      if (catTx.length < 3) return []; // need at least 3 for meaningful average
      const amounts = catTx.map((t) => t.amount || 0);
      const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const variance = amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length;
      const sd = Math.sqrt(variance);
      if (sd === 0) return [];
      return catTx
        .map((tx) => {
          const z = (tx.amount - mean) / sd;
          return { tx, zScore: Math.round(z * 100) / 100, mean: Math.round(mean) };
        })
        .filter((a) => a.zScore > 1.5) // 1.5σ above normal
        .sort((a, b) => b.zScore - a.zScore);
    })();

    const primaryColor = cat.color || '#22c55e';

    return {
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
    };
    // Deps note: `cat` is included (rather than just `cat.name`) so the
    // memo recomputes whenever the parent's `categoryTotals` re-derives
    // (e.g. if `getCategoryMeta` changes the emoji/color, or any cat.*
    // field updates). `cat.name` alone would miss the getCategoryMeta
    // edge case. Functionally equivalent to the audit's recommendation
    // for the common case (transactions/selectedMonth change), stricter
    // for the rare case.
  }, [transactions, prevTransactions, cat, selectedMonth]);

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Breadcrumb + back + 1-click tx link */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
          Kategori
        </button>
        <ChevronLeft className="h-3 w-3 text-muted-foreground/50" />
        <span className="text-xs font-medium text-foreground">{cat.emoji} {cat.name}</span>
        {/* ONE-CLICK-8: ghost pill rata kanan — langsung ke transaksi
            kategori ini (filter terpasang). */}
        <button
          type="button"
          onClick={handleViewTransactions}
          className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 min-h-8 text-xs font-semibold text-primary hover:bg-primary/10 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={`Lihat transaksi kategori ${cat.name}`}
        >
          Lihat transaksi
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Month picker */}
      <Select value={selectedMonth} onValueChange={onSelectMonth}>
        <SelectTrigger className="w-full sm:w-[180px] h-9">
          <Calendar className="h-3.5 w-3.5" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {monthOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Hero number */}
      <Card className="overflow-hidden anim-stagger contain-card">
        <div className="bg-gradient-to-br from-[#22c55e]/[0.025] via-[#10b981]/[0.015] to-transparent px-4 py-5 sm:px-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{cat.emoji}</span>
            <p className="text-sm font-semibold">{cat.name}</p>
            <span className="text-xs text-muted-foreground">· {monthLabel(selectedMonth)}</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            <CountUpRupiah amount={cat.total} />
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            <CountUpNumber value={catTx.length} /> transaksi · {activeDays} hari aktif · {cat.percentage}% dari total
          </p>

          {/* B4: vs Last Month comparison */}
          {vsLastMonthPct !== null && (
            <div className={cn(
              'inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-medium',
              vsLastMonthDir === 'up'
                ? 'bg-destructive/10 text-destructive dark:bg-destructive/15 dark:text-destructive/80'
                : vsLastMonthDir === 'down'
                ? 'bg-success/10 text-success dark:bg-success/15 dark:text-success/80'
                : 'bg-muted text-muted-foreground'
            )}>
              {vsLastMonthDir === 'up' && <TrendingUp className="h-3 w-3" />}
              {vsLastMonthDir === 'down' && <TrendingDown className="h-3 w-3" />}
              {vsLastMonthDir === 'same' && <Minus className="h-3 w-3" />}
              <span>
                {vsLastMonthDir === 'same' ? 'Sama dengan' : `${Math.abs(vsLastMonthPct)}% ${vsLastMonthDir === 'up' ? 'naik' : 'turun'} dari`}
                {' '}bulan lalu ({compactRupiahSafe(prevTotal)})
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Combination chart: bars (daily) + line (7-day moving average) */}
      <Card className="overflow-hidden anim-stagger contain-card">
        <div className="px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              Grafik Harian
            </h3>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: primaryColor }} />
                Harian
              </span>
              <span className="flex items-center gap-1">
                {/* FIX-COLOR-P3: was hardcoded #10b981 — now var(--chart-2)
                    so the moving-avg legend swatch matches the Line stroke
                    and follows the user's theme. */}
                <span className="w-4 h-0.5" style={{ backgroundColor: 'var(--chart-2)' }} />
                Rata² 7 hari
              </span>
              {dailyAverage > 0 && (
                <span className="flex items-center gap-1">
                  {/* FIX-COLOR-P3: was hardcoded #f59e0b — now var(--warning)
                      so the avg-reference legend swatch matches the
                      ReferenceLine stroke and follows the user's theme. */}
                  <span className="w-4 h-0 border-t-2 border-dashed" style={{ borderColor: 'var(--warning)' }} />
                  Rata²
                </span>
              )}
            </div>
          </div>
          {/* min-w-0 + overflow-hidden: prevents Recharts ResponsiveContainer
              from expanding beyond parent width on mobile (known flex-layout bug) */}
          <div className="w-full min-w-0 overflow-hidden">
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
              {/* FIX-COLOR-P3: was hardcoded #64748B (slate-500) — now
                  var(--muted-foreground) so axis ticks follow the theme. */}
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => compactRupiahSafe(v)} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value, name) => [
                  formatRupiah(Number(value)),
                  name === 'total' ? 'Harian' : name === 'movingAvg' ? 'Rata² 7 hari' : name,
                ]}
                labelFormatter={(_label, payload: any) => {
                  const data = payload?.[0]?.payload;
                  return data?.dateLabel || `Tgl ${_label != null ? String(_label) : ''}`;
                }}
              />
              <Bar dataKey="total" fill={primaryColor} radius={[3, 3, 0, 0]} maxBarSize={20} />
              {dailyAverage > 0 && (
                <ReferenceLine
                  y={dailyAverage}
                  // FIX-COLOR-P3: was hardcoded #f59e0b — now var(--warning)
                  // so the avg reference line follows the user's theme.
                  stroke="var(--warning)"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  label={{
                    value: `Rata² ${compactRupiahSafe(dailyAverage)}`,
                    position: 'insideTopRight',
                    fill: 'var(--warning)',
                    fontSize: 11,
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="movingAvg"
                // FIX-COLOR-P3: was hardcoded #10b981 — now var(--chart-2)
                // (teal) so the moving-average line follows the user's theme
                // and stays visually distinct from the primary-green bars.
                stroke="var(--chart-2)"
                strokeWidth={2}
                dot={false}
                yAxisId={0}
              />
            </ComposedChart>
          </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card className="p-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Rata²/tx</p>
          <p className="text-sm font-bold tabular-nums mt-0.5">{compactRupiahSafe(avgPerTx)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Rata²/hari</p>
          <p className="text-sm font-bold tabular-nums mt-0.5">{compactRupiahSafe(avgPerDay)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Tertinggi</p>
          <p className="text-sm font-bold tabular-nums mt-0.5">{compactRupiahSafe(maxTx.amount)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Hari Tertinggi</p>
          <p className="text-sm font-bold tabular-nums mt-0.5">{maxDay.day > 0 ? `Tgl ${maxDay.day}` : '—'}</p>
        </Card>
      </div>

      {/* Pattern insights */}
      {peakHour.count > 0 && (
        <Card className="p-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Paling sering beli jam{' '}
            <span className="font-semibold text-foreground">
              {String(peakHour.hour).padStart(2, '0')}:00
            </span>{' '}
            ({peakHour.count}×)
          </p>
        </Card>
      )}

      {/* A2: Time-of-day distribution */}
      {catTx.length > 0 && (
        <Card className="p-3">
          <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-muted-foreground" />
            Distribusi Waktu
          </h3>
          <div className="space-y-1.5">
            {Object.entries(timeOfDayMap).map(([key, slot]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-24 sm:w-28 shrink-0 truncate">{slot.label}</span>
                <div className="flex-1 h-4 bg-muted/30 rounded-sm overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-sm transition-all duration-500',
                      key === topTimeSlot.key && slot.count > 0 && 'ring-1 ring-foreground/20'
                    )}
                    style={{
                      width: `${(slot.count / maxTimeSlot) * 100}%`,
                      backgroundColor: key === topTimeSlot.key ? primaryColor : `${primaryColor}60`,
                    }}
                  />
                </div>
                <span className="text-[11px] font-medium tabular-nums shrink-0 w-12 text-right">
                  {slot.count > 0 ? `${slot.count}×` : '—'}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-16 text-right hidden sm:block">
                  {slot.total > 0 ? compactRupiahSafe(slot.total) : ''}
                </span>
              </div>
            ))}
          </div>
          {topTimeSlot.count > 0 && (
            <p className="text-[11px] text-muted-foreground mt-2">
              💡 Dominan {topTimeSlot.label.toLowerCase()} — {topTimeSlot.count} dari {catTx.length} transaksi
            </p>
          )}
        </Card>
      )}

      {/* C9: Source breakdown */}
      {sourceList.length > 1 && (
        <Card className="p-3">
          <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <Wallet className="h-3 w-3 text-muted-foreground" />
            Sumber Dana
          </h3>
          <div className="space-y-1.5">
            {sourceList.map((src) => (
              <div key={src.name} className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground flex-1 truncate">{src.name}</span>
                <div className="w-16 sm:w-20 h-2 bg-muted/30 rounded-full overflow-hidden shrink-0">
                  <div
                    className="h-full rounded-full transition-all duration-500 anim-fill-bar"
                    style={{ width: `${src.percentage}%`, backgroundColor: primaryColor }}
                  />
                </div>
                <span className="text-[11px] font-medium tabular-nums shrink-0 w-16 text-right">
                  {compactRupiahSafe(src.total)}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-8 text-right">
                  {src.percentage}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* D11: Personality tag */}
      {personalityTag && (
        <Card className="p-3 flex items-center gap-3 bg-primary/5">
          <span className="text-2xl shrink-0">{personalityTag.emoji}</span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-primary">{personalityTag.tag}</p>
            <p className="text-[11px] text-muted-foreground">{personalityTag.desc}</p>
          </div>
        </Card>
      )}

      {/* A1: Pola per Hari — smooth line/area chart dengan nodes */}
      {catTx.length > 0 && (
        <Card className="p-3">
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            Pola per Hari
          </h3>
          <DowLineChart data={dowData} topIdx={dowTop.idx} color={primaryColor} />
          {dowTop.total > 0 && (
            <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/5 border border-primary/10">
              <span className="text-[11px]">💡</span>
              <span className="text-[11px] text-muted-foreground">
                Paling boros di hari <span className="font-semibold text-foreground">{DOW_NAMES[dowTop.idx]}</span> —{' '}
                <span className="font-semibold text-foreground">{compactRupiahSafe(dowTop.total)}</span> ({dowTop.count}×)
              </span>
            </div>
          )}
        </Card>
      )}

      {/* C8: Distribusi Nominal — 5 circular progress rings */}
      {histogram.length > 0 && catTx.length >= 3 && (
        <Card className="p-3">
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
            <Receipt className="h-3 w-3 text-muted-foreground" />
            Distribusi Nominal
          </h3>
          <div className="flex items-start justify-between gap-0.5 sm:gap-2">
            {histogram.map((b, i) => {
              const pct = histMaxCount > 0 ? Math.round((b.count / histMaxCount) * 100) : 0;
              const isDominant = i === dominantBucket.idx && b.count > 0;
              // Parse range into min/max for 2-line display on mobile
              const rangeParts = b.range.split('-');
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                  <MiniProgressRing
                    percentage={pct}
                    size={44}
                    strokeWidth={3}
                    color={primaryColor}
                    isHighlighted={isDominant}
                  >
                    <span className={cn(
                      'text-[11px] font-bold tabular-nums',
                      isDominant ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {b.count > 0 ? `${b.count}×` : '—'}
                    </span>
                  </MiniProgressRing>
                  {/* Range: 2-line on mobile (min / max), single-line on sm+ */}
                  <div className="text-center shrink-0">
                    <div className={cn(
                      'text-[10px] leading-tight',
                      isDominant ? 'font-semibold text-foreground' : 'text-muted-foreground'
                    )}>
                      {rangeParts[0]}
                    </div>
                    {rangeParts[1] && (
                      <div className={cn(
                        'text-[10px] leading-tight',
                        isDominant ? 'font-semibold text-foreground' : 'text-muted-foreground'
                      )}>
                        {rangeParts[1]}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {dominantBucket.count > 0 && (
            <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/5 border border-primary/10">
              <span className="text-[11px]">💡</span>
              <span className="text-[11px] text-muted-foreground">
                Mayoritas transaksi di range{' '}
                <span className="font-semibold text-foreground">{dominantBucket.range}</span> ({dominantBucket.count}×)
              </span>
            </div>
          )}
        </Card>
      )}

      {/* D12: Anomaly detection */}
      {anomalies.length > 0 && (
        <Card className="p-3 border-warning/30 dark:border-warning/20">
          <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-warning dark:text-warning/80">
            <TrendingUp className="h-3 w-3" />
            Anomali Terdeteksi
          </h3>
          <div className="space-y-1.5">
            {anomalies.slice(0, 3).map((a, i) => (
              <div key={a.tx.id || i} className="flex items-center gap-2 text-xs">
                <span className="text-warning shrink-0">⚠️</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {a.tx.description || a.tx.category}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDateShort(jakartaDateKey(new Date(a.tx.date)))} · {formatTxTime(a.tx.date)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold tabular-nums text-warning dark:text-warning/80">
                    {compactRupiahSafe(a.tx.amount)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {a.zScore}σ di atas rata-rata ({compactRupiahSafe(a.mean)})
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Transaction list */}
      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 sm:px-6 border-b border-border">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
            Rincian Transaksi
          </h3>
        </div>
        <div className="max-h-96 overflow-y-auto custom-scrollbar cv-auto">
          {catTx.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Belum ada transaksi {cat.emoji} {cat.name} di {monthLabel(selectedMonth)}
            </p>
          ) : (
            catTx.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center gap-3 px-4 py-2 sm:px-6 border-b border-border/40 last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {tx.description || tx.category}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDateShort(jakartaDateKey(new Date(tx.date)))} · {formatTxTime(tx.date)} · {tx.source}
                  </p>
                </div>
                <span className="text-xs font-semibold tabular-nums shrink-0 text-destructive">
                  −{compactRupiahSafe(tx.amount)}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
