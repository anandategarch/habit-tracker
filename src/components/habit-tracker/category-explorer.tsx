'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  Trophy,
  Wallet,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatRupiah, compactRupiah, type Transaction } from './finance-types';
import { CountUpRupiah, CountUpNumber } from './count-up';
import { jakartaMonthString, jakartaDateKey } from '@/lib/timezone';
import { format as formatDate, subMonths } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

// ── Types ────────────────────────────────────────────────────────────────

interface CategoryTotal {
  name: string;
  emoji: string;
  color: string;
  total: number;
  count: number;
  percentage: number;
}

interface DailyData {
  day: number;
  date: string;
  label: string;
  dateLabel: string; // full date for tooltip (e.g. "15 Jul")
  total: number;
  count: number;
  cumulative: number;
}

interface CategoryExplorerProps {
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return formatDate(new Date(y, m - 1, 1), 'MMM yyyy', { locale: idLocale });
}

function formatTxTime(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatDateShort(d: string): string {
  const [y, m, day] = d.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(day));
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function compactRupiahSafe(n: number): string {
  if (n === 0) return '0';
  return compactRupiah(n);
}

// ── Main Component ───────────────────────────────────────────────────────

export default function CategoryExplorer({ getCategoryMeta }: CategoryExplorerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(jakartaMonthString());

  // Month options (last 12 months)
  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i <= 11; i++) {
      const d = subMonths(now, i);
      opts.push({
        value: formatDate(d, 'yyyy-MM'),
        label: formatDate(d, 'MMMM yyyy', { locale: idLocale }),
      });
    }
    return opts;
  }, []);

  // Fetch all expense transactions for the selected month
  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ['finance', 'category-explorer', selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/finance/transactions?month=${selectedMonth}&type=expense`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  // Fetch previous month for comparison (B4: vs Last Month)
  const prevMonthStr = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  }, [selectedMonth]);

  const { data: prevTransactions = [] } = useQuery<Transaction[]>({
    queryKey: ['finance', 'category-explorer', prevMonthStr],
    queryFn: async () => {
      const res = await fetch(`/api/finance/transactions?month=${prevMonthStr}&type=expense`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });

  // Group transactions by category for the list view
  const categoryTotals = useMemo<CategoryTotal[]>(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const tx of transactions) {
      const existing = map.get(tx.category) ?? { total: 0, count: 0 };
      existing.total += tx.amount || 0;
      existing.count += 1;
      map.set(tx.category, existing);
    }
    const grandTotal = Array.from(map.values()).reduce((s, v) => s + v.total, 0);
    return Array.from(map.entries())
      .map(([name, v]) => {
        const meta = getCategoryMeta(name);
        return {
          name,
          emoji: meta.emoji,
          color: meta.color,
          total: v.total,
          count: v.count,
          percentage: grandTotal > 0 ? Math.round((v.total / grandTotal) * 100) : 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [transactions, getCategoryMeta]);

  const grandTotal = useMemo(
    () => categoryTotals.reduce((s, c) => s + c.total, 0),
    [categoryTotals]
  );

  // ── Category Detail View ──────────────────────────────────────────────

  if (selectedCategory) {
    // When month changes, transactions briefly become [] during refetch.
    // Without this guard, categoryTotals is [] → cat not found → user
    // bounces back to list view even if category exists in new month.
    if (isLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-[120px] rounded-xl" />
          <Skeleton className="h-[260px] rounded-xl" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        </div>
      );
    }

    const cat = categoryTotals.find((c) => c.name === selectedCategory);
    if (!cat) {
      // Category genuinely doesn't exist in this month — go back to list
      setSelectedCategory(null);
      return null;
    }

    // Filter transactions for this category
    const catTx = transactions
      .filter((t) => t.category === selectedCategory)
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
    for (let d = 1; d <= daysInMonth; d++) {
      const data = dailyMap.get(d);
      cumulative += data?.total ?? 0;
      const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
      // Format label as "DD" for axis ticks (every 5 days), but full date
      // for tooltip. Previously just showed bare day numbers (1, 5, 10...)
      // without month context — confusing when switching between months.
      const dateObj = new Date(Number(selectedMonth.split('-')[0]), Number(selectedMonth.split('-')[1]) - 1, d);
      const dayLabel = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      // XAxis label: show "DD Mon" for tick days (every 5), empty otherwise.
      // Previously just showed bare day numbers (1, 5, 10...) without month —
      // user couldn't tell which month they're looking at.
      const axisLabel = d % 5 === 0 || d === 1 ? dayLabel : '';
      chartData.push({
        day: d,
        date: dateStr,
        label: axisLabel,
        dateLabel: dayLabel,
        total: data?.total ?? 0,
        count: data?.count ?? 0,
        cumulative,
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

    // Peak hour pattern
    const hourMap = new Map<number, number>();
    for (const tx of catTx) {
      const h = parseInt(
        new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }).format(new Date(tx.date)),
        10
      ) % 24;
      hourMap.set(h, (hourMap.get(h) ?? 0) + 1);
    }
    const peakHour = Array.from(hourMap.entries()).reduce(
      (max, [h, count]) => (count > max.count ? { hour: h, count } : max),
      { hour: 0, count: 0 }
    );

    // ── B4: vs Last Month comparison ──────────────────────────────────
    const prevCatTx = prevTransactions.filter((t) => t.category === selectedCategory);
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
      const h = parseInt(
        new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }).format(new Date(tx.date)),
        10
      ) % 24;
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
    const DOW_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const dowMap = new Array(7).fill(0).map(() => ({ total: 0, count: 0 }));
    for (const tx of catTx) {
      const dateKey = jakartaDateKey(new Date(tx.date));
      const d = new Date(dateKey + 'T00:00:00Z');
      const dow = d.getUTCDay();
      dowMap[dow].total += tx.amount || 0;
      dowMap[dow].count += 1;
    }
    const dowMaxTotal = Math.max(...dowMap.map((d) => d.total), 1);
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
        return { tag: 'Heavy Spender', emoji: '💸', desc: '>30% dari total pengeluaran bulan ini' };
      }
      if (freq >= 1.5) {
        return { tag: 'Daily Ritual', emoji: '🔄', desc: 'Rata-rata lebih dari 1× per hari aktif' };
      }
      if (weekendPct >= 0.5) {
        return { tag: 'Weekend Splurger', emoji: '🎉', desc: `${Math.round(weekendPct * 100)}% transaksi di weekend` };
      }
      if (morningPct >= 0.7) {
        return { tag: 'Morning Ritual', emoji: '🌅', desc: `${Math.round(morningPct * 100)}% transaksi di pagi hari` };
      }
      if (catTx.length < 4) {
        return { tag: 'Occasional', emoji: '🍃', desc: 'Kurang dari 4× per bulan' };
      }
      return { tag: 'Steady Spender', emoji: '⚖️', desc: 'Pola spending yang konsisten' };
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

    const primaryColor = cat.color || '#6366f1';

    return (
      <div className="space-y-4">
        {/* Breadcrumb + back */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Kategori
          </button>
          <ChevronLeft className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-xs font-medium text-foreground">{cat.emoji} {cat.name}</span>
        </div>

        {/* Month picker */}
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-full sm:w-[180px] h-9">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
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
          <div className="bg-gradient-to-br from-[#5B5FFB]/[0.025] via-[#7C6CFF]/[0.015] to-transparent px-4 py-5 sm:px-6">
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
                  ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                  : vsLastMonthDir === 'down'
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
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

        {/* Combination chart: bars (daily) + line (cumulative) */}
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
                  <span className="w-4 h-0.5" style={{ backgroundColor: '#7C6CFF' }} />
                  Kumulatif
                </span>
                {dailyAverage > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-4 h-0 border-t-2 border-dashed" style={{ borderColor: '#f59e0b' }} />
                    Rata²
                  </span>
                )}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => compactRupiahSafe(v)} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, name: string) => [
                    formatRupiah(value),
                    name === 'total' ? 'Harian' : name === 'cumulative' ? 'Kumulatif' : name,
                  ]}
                  labelFormatter={(_label: string, payload: any) => {
                    // Use the full dateLabel from the data point for context
                    const data = payload?.[0]?.payload;
                    return data?.dateLabel || `Tgl ${_label}`;
                  }}
                />
                <Bar dataKey="total" fill={primaryColor} radius={[3, 3, 0, 0]} maxBarSize={20} />
                {/* E15: Average line — dashed reference showing daily average */}
                {dailyAverage > 0 && (
                  <ReferenceLine
                    y={dailyAverage}
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                    label={{
                      value: `Avg ${compactRupiahSafe(dailyAverage)}`,
                      position: 'right',
                      fill: '#f59e0b',
                      fontSize: 9,
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#7C6CFF"
                  strokeWidth={2}
                  dot={false}
                  yAxisId={0}
                />
              </ComposedChart>
            </ResponsiveContainer>
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
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Hari max</p>
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
                  <span className="text-[11px] text-muted-foreground w-28 shrink-0 truncate">{slot.label}</span>
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
                  <div className="w-20 h-2 bg-muted/30 rounded-full overflow-hidden shrink-0">
                    <div
                      className="h-full rounded-full transition-all duration-500"
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

        {/* A1: Day-of-week breakdown */}
        {catTx.length > 0 && (
          <Card className="p-3">
            <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              Pola per Hari
            </h3>
            <div className="flex items-end justify-between gap-1.5 h-20">
              {dowData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <span className="text-[11px] font-medium tabular-nums shrink-0">
                    {d.total > 0 ? compactRupiahSafe(d.total) : ''}
                  </span>
                  <div className="w-full flex-1 flex items-end min-h-0">
                    <div
                      className={cn(
                        'w-full rounded-t-sm transition-all duration-500',
                        i === dowTop.idx && d.total > 0 && 'ring-1 ring-foreground/20'
                      )}
                      style={{
                        height: d.total > 0 ? `${(d.total / dowMaxTotal) * 100}%` : '2px',
                        minHeight: d.total > 0 ? '8px' : '2px',
                        backgroundColor: i === dowTop.idx ? primaryColor : `${primaryColor}50`,
                      }}
                    />
                  </div>
                  <span className={cn(
                    'text-[11px] shrink-0',
                    i === dowTop.idx && d.total > 0 ? 'font-bold text-foreground' : 'text-muted-foreground'
                  )}>
                    {d.day}
                  </span>
                </div>
              ))}
            </div>
            {dowTop.total > 0 && (
              <p className="text-[11px] text-muted-foreground mt-2">
                💡 Paling boros di hari {DOW_NAMES[dowTop.idx]} — {compactRupiahSafe(dowTop.total)} ({dowTop.count}×)
              </p>
            )}
          </Card>
        )}

        {/* C8: Amount distribution histogram */}
        {histogram.length > 0 && catTx.length >= 3 && (
          <Card className="p-3">
            <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <Receipt className="h-3 w-3 text-muted-foreground" />
              Distribusi Nominal
            </h3>
            <div className="flex items-end justify-between gap-2 h-20">
              {histogram.map((b, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <span className="text-[11px] font-medium tabular-nums shrink-0">
                    {b.count > 0 ? `${b.count}×` : ''}
                  </span>
                  <div className="w-full flex-1 flex items-end min-h-0">
                    <div
                      className={cn(
                        'w-full rounded-t-sm transition-all duration-500',
                        i === dominantBucket.idx && b.count > 0 && 'ring-1 ring-foreground/20'
                      )}
                      style={{
                        height: b.count > 0 ? `${(b.count / histMaxCount) * 100}%` : '2px',
                        minHeight: b.count > 0 ? '8px' : '2px',
                        backgroundColor: i === dominantBucket.idx ? primaryColor : `${primaryColor}50`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground text-center leading-tight shrink-0 truncate w-full">
                    {b.range}
                  </span>
                </div>
              ))}
            </div>
            {dominantBucket.count > 0 && (
              <p className="text-[11px] text-muted-foreground mt-2">
                💡 Mayoritas transaksi di range {dominantBucket.range} ({dominantBucket.count}×)
              </p>
            )}
          </Card>
        )}

        {/* D12: Anomaly detection */}
        {anomalies.length > 0 && (
          <Card className="p-3 border-amber-200 dark:border-amber-900/50">
            <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <TrendingUp className="h-3 w-3" />
              Anomali Terdeteksi
            </h3>
            <div className="space-y-1.5">
              {anomalies.slice(0, 3).map((a, i) => (
                <div key={a.tx.id || i} className="flex items-center gap-2 text-xs">
                  <span className="text-amber-500 shrink-0">⚠️</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {a.tx.description || a.tx.category}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDateShort(jakartaDateKey(new Date(a.tx.date)))} · {formatTxTime(a.tx.date)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold tabular-nums text-amber-600 dark:text-amber-400">
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
                  <span className="text-xs font-semibold tabular-nums shrink-0 text-red-500">
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

  // ── Category List View ────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Month picker */}
      <div className="flex items-center justify-between gap-2">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-full sm:w-[180px] h-9">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-right">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Total</p>
          <p className="text-sm font-bold tabular-nums">{isLoading ? '...' : formatRupiah(grandTotal)}</p>
        </div>
      </div>

      {/* Category list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : categoryTotals.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-3xl mb-2 anim-float-subtle">📊</div>
          <p className="text-sm font-medium">Belum ada pengeluaran</p>
          <p className="text-xs text-muted-foreground mt-1">
            Catat transaksi untuk melihat breakdown per kategori
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {categoryTotals.map((cat, idx) => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className="w-full text-left anim-row-stagger group"
              style={{ '--stagger-index': idx } as React.CSSProperties}
            >
              <Card className="overflow-hidden transition-all hover:shadow-md hover:border-primary/30 contain-card">
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Emoji */}
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-xl text-lg shrink-0"
                    style={{ backgroundColor: `${cat.color}15` }}
                  >
                    {cat.emoji}
                  </div>

                  {/* Name + count */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{cat.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {cat.count} transaksi · {cat.percentage}% dari total
                    </p>
                  </div>

                  {/* Total */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold tabular-nums">{formatRupiah(cat.total)}</p>
                  </div>

                  {/* Progress bar */}
                  <div className="hidden sm:block w-20 shrink-0">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Mobile progress bar (full width below) */}
                <div className="sm:hidden h-1 bg-muted">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${cat.percentage}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
