'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
} from 'recharts';
import {
  ChevronRight,
  ChevronLeft,
  Calendar,
  TrendingUp,
  Wallet,
  Target,
  Receipt,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRupiah, type Transaction } from './finance-types';
import { useThemeColor } from '@/hooks/use-theme-color';
import { CountUpRupiah, CountUpNumber } from './count-up';
import { jakartaDateString } from '@/lib/jakarta-date';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ── Types ───────────────────────────────────────────────────────────────

type DrillLevel = 'month' | 'week' | 'day' | 'transactions';

interface MonthData {
  month: string;
  label: string;
  total: number;
}

interface DayData {
  day: number;
  date: string;
  dayName: string;
  total: number;
  count: number;
}

interface WeekData {
  week: number;
  label: string;
  dateRange: string;
  total: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function compactRupiah(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function dayToWeek(day: number): number {
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
}

function fullMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

/** Build last 6 months options for the picker */
function buildMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const opts: { value: string; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
    // For current month, cap end date at today
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = i === 0
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : new Date(d.getFullYear(), d.getMonth() + 1, 0);
    opts.push({ value: key, label });
  }
  return opts;
}

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

// ── Component ───────────────────────────────────────────────────────────

export default function FinanceExplorer({
  getCategoryMeta,
}: {
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
}) {
  const primaryColor = useThemeColor('primary');
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [level, setLevel] = useState<DrillLevel>('month');
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Fetch ALL expense transactions for the selected month
  const { data: allTx = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ['finance', 'explorer', selectedMonth],
    queryFn: async () => {
      const [y, m] = selectedMonth.split('-');
      const start = new Date(parseInt(y), parseInt(m) - 1, 1);
      const end = new Date(parseInt(y), parseInt(m), 0, 23, 59, 59, 999);
      const res = await fetch(
        `/api/finance/transactions?type=expense&startDate=${start.toISOString().slice(0, 10)}&endDate=${end.toISOString().slice(0, 10)}`,
      );
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 15_000,
  });

  // Also fetch 6-month overview for Level 1 bar chart
  const { data: monthlyData = [] } = useQuery<MonthData[]>({
    queryKey: ['finance', 'explorer-monthly'],
    queryFn: async () => {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const res = await fetch(
        `/api/finance/transactions?type=expense&startDate=${sixMonthsAgo.toISOString().slice(0, 10)}&endDate=${now.toISOString().slice(0, 10)}`,
      );
      if (!res.ok) return [];
      const txs: Transaction[] = await res.json();
      // Group by month
      const monthMap: Record<string, number> = {};
      for (const tx of txs) {
        const jakartaDate = new Date(new Date(tx.date).getTime() + JAKARTA_OFFSET_MS);
        const key = `${jakartaDate.getUTCFullYear()}-${String(jakartaDate.getUTCMonth() + 1).padStart(2, '0')}`;
        monthMap[key] = (monthMap[key] || 0) + tx.amount;
      }
      return Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, total]) => ({ month, label: monthLabel(month), total }));
    },
    staleTime: 60_000,
  });

  // ── Derive data per level ──

  // Level 2: Weekly breakdown for selected month
  const weekData = useMemo<WeekData[]>(() => {
    const weeks = [0, 0, 0, 0];
    for (const tx of allTx) {
      const jakartaDate = new Date(new Date(tx.date).getTime() + JAKARTA_OFFSET_MS);
      const day = jakartaDate.getUTCDate();
      weeks[dayToWeek(day) - 1] += tx.amount;
    }
    const [y, m] = selectedMonth.split('-').map(Number);
    return [1, 2, 3, 4].map((w) => {
      const startDay = w === 1 ? 1 : w === 2 ? 8 : w === 3 ? 15 : 22;
      const endDay = w === 4 ? new Date(y, m, 0).getDate() : startDay + 6;
      return { week: w, label: `W${w}`, dateRange: `${startDay}-${endDay}`, total: weeks[w - 1] };
    });
  }, [allTx, selectedMonth]);

  // Level 3: Daily breakdown for selected week
  const dayData = useMemo<DayData[]>(() => {
    if (selectedWeek === null) return [];
    const dayMap: Record<number, { total: number; count: number }> = {};
    for (const tx of allTx) {
      const jakartaDate = new Date(new Date(tx.date).getTime() + JAKARTA_OFFSET_MS);
      const day = jakartaDate.getUTCDate();
      if (dayToWeek(day) !== selectedWeek) continue;
      if (!dayMap[day]) dayMap[day] = { total: 0, count: 0 };
      dayMap[day].total += tx.amount;
      dayMap[day].count++;
    }
    const [y, m] = selectedMonth.split('-').map(Number);
    return Object.entries(dayMap)
      .map(([dayStr, d]) => {
        const day = parseInt(dayStr);
        const date = new Date(y, m - 1, day);
        return {
          day,
          date: date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
          dayName: date.toLocaleDateString('id-ID', { weekday: 'long' }),
          total: d.total,
          count: d.count,
        };
      })
      .sort((a, b) => a.day - b.day);
  }, [allTx, selectedWeek, selectedMonth]);

  // Level 4: Transactions for selected day
  const transactionList = useMemo<Transaction[]>(() => {
    if (selectedWeek === null || selectedDay === null) return [];
    return allTx
      .filter((tx) => {
        const jakartaDate = new Date(new Date(tx.date).getTime() + JAKARTA_OFFSET_MS);
        return dayToWeek(jakartaDate.getUTCDate()) === selectedWeek && jakartaDate.getUTCDate() === selectedDay;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allTx, selectedWeek, selectedDay]);

  // ── KPI values per level ──

  const kpis = useMemo(() => {
    if (level === 'month') {
      const total = monthlyData.reduce((s, m) => s + m.total, 0);
      const avg = monthlyData.length > 0 ? Math.round(total / monthlyData.length) : 0;
      const highest = monthlyData.reduce((max, m) => m.total > max.total ? m : max, monthlyData[0] || { total: 0, label: '—' });
      const lowest = monthlyData.reduce((min, m) => m.total < min.total ? m : min, monthlyData[0] || { total: 0, label: '—' });
      return [
        { icon: Wallet, label: 'Total 6 Bulan', value: <CountUpRupiah amount={total} />, accent: 'indigo' as const },
        { icon: TrendingUp, label: 'Rata-rata/Bulan', value: <CountUpRupiah amount={avg} />, accent: 'purple' as const },
        { icon: Target, label: 'Bulan Tertinggi', value: <span><CountUpRupiah amount={highest.total} /> <span className="text-xs text-muted-foreground">{highest.label}</span></span>, accent: 'amber' as const },
        { icon: Receipt, label: 'Bulan Terendah', value: <span><CountUpRupiah amount={lowest.total} /> <span className="text-xs text-muted-foreground">{lowest.label}</span></span>, accent: 'blue' as const },
      ];
    }
    if (level === 'week') {
      const total = weekData.reduce((s, w) => s + w.total, 0);
      const avg = weekData.length > 0 ? Math.round(total / weekData.length) : 0;
      const highest = weekData.reduce((max, w) => w.total > max.total ? w : max, weekData[0] || { total: 0, label: '—' });
      const txCount = allTx.length;
      return [
        { icon: Wallet, label: 'Total Bulan Ini', value: <CountUpRupiah amount={total} />, accent: 'indigo' as const },
        { icon: TrendingUp, label: 'Rata-rata/Minggu', value: <CountUpRupiah amount={avg} />, accent: 'purple' as const },
        { icon: Target, label: 'Minggu Tertinggi', value: <span><CountUpRupiah amount={highest.total} /> <span className="text-xs text-muted-foreground">{highest.label}</span></span>, accent: 'amber' as const },
        { icon: Receipt, label: 'Total Transaksi', value: <CountUpNumber value={txCount} />, accent: 'blue' as const },
      ];
    }
    if (level === 'day') {
      const total = dayData.reduce((s, d) => s + d.total, 0);
      const avg = dayData.length > 0 ? Math.round(total / dayData.length) : 0;
      const top = dayData.reduce((max, d) => d.total > max.total ? d : max, dayData[0] || { total: 0, date: '—', dayName: '' });
      const txCount = dayData.reduce((s, d) => s + d.count, 0);
      return [
        { icon: Wallet, label: `Total W${selectedWeek}`, value: <CountUpRupiah amount={total} />, accent: 'indigo' as const },
        { icon: TrendingUp, label: 'Rata-rata/Hari', value: <CountUpRupiah amount={avg} />, accent: 'purple' as const },
        { icon: Target, label: 'Hari Terbesar', value: <span><CountUpRupiah amount={top.total} /> <span className="text-xs text-muted-foreground">{top.date}</span></span>, accent: 'amber' as const },
        { icon: Receipt, label: 'Total Transaksi', value: <CountUpNumber value={txCount} />, accent: 'blue' as const },
      ];
    }
    // transactions level
    const validTx = transactionList.filter((t) => t && typeof t.amount === 'number');
    const total = validTx.reduce((s, t) => s + t.amount, 0);
    const avg = validTx.length > 0 ? Math.round(total / validTx.length) : 0;
    const highest = validTx.length > 0
      ? validTx.reduce((max, t) => (t.amount > max.amount ? t : max), validTx[0])
      : null;
    const dayLabel = dayData.find((d) => d.day === selectedDay);
    return [
      { icon: Wallet, label: dayLabel ? `${dayLabel.dayName}` : 'Total Hari', value: <CountUpRupiah amount={total} />, accent: 'indigo' as const },
      { icon: TrendingUp, label: 'Rata-rata/Transaksi', value: <CountUpRupiah amount={avg} />, accent: 'purple' as const },
      { icon: Target, label: 'Transaksi Terbesar', value: highest ? <CountUpRupiah amount={highest.amount} /> : '—', accent: 'amber' as const },
      { icon: Receipt, label: 'Jumlah Transaksi', value: <CountUpNumber value={validTx.length} />, accent: 'blue' as const },
    ];
  }, [level, monthlyData, weekData, dayData, transactionList, allTx.length, selectedWeek, selectedDay]);

  // ── Drill handlers ──

  // From month level: click a month bar → set month + drill to week level
  const drillToMonth = (month: string) => {
    setSelectedMonth(month);
    setSelectedWeek(null);
    setSelectedDay(null);
    setLevel('week');
  };

  // From week level: click a week bar → set week + drill to day level
  const drillFromWeekToDay = (week: number) => {
    setSelectedWeek(week);
    setSelectedDay(null);
    setLevel('day');
  };
  // From day list: click a day → set day + drill to transactions
  const drillFromDayToTransactions = (day: number) => {
    setSelectedDay(day);
    setLevel('transactions');
  };
  const goBack = () => {
    if (level === 'transactions') setLevel('day');
    else if (level === 'day') { setLevel('week'); setSelectedDay(null); }
    else if (level === 'week') { setLevel('month'); setSelectedWeek(null); }
  };

  // ── Loading ──

  if (isLoading && level === 'month') {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  // ── Render ──

  const accentColors: Record<string, string> = {
    indigo: '#6366F1',
    purple: '#8B5CF6',
    amber: '#F59E0B',
    blue: '#3B82F6',
  };

  return (
    <div className="space-y-4">
      {/* ── Breadcrumb + Month Picker ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {level !== 'month' && (
            <button
              onClick={goBack}
              className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}
          <span className={cn('text-xs font-medium', level === 'month' ? 'text-foreground' : 'text-muted-foreground')}>
            {fullMonthLabel(selectedMonth)}
          </span>
          {level !== 'month' && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <button
                onClick={() => { setLevel('month'); setSelectedWeek(null); setSelectedDay(null); }}
                className={cn('text-xs font-medium', level === 'week' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                Weeks
              </button>
            </>
          )}
          {selectedWeek !== null && level !== 'month' && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <button
                onClick={() => { setLevel('week'); setSelectedDay(null); }}
                className={cn('text-xs font-medium', level === 'week' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                W{selectedWeek}
              </button>
            </>
          )}
          {selectedDay !== null && (level === 'day' || level === 'transactions') && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <button
                onClick={() => { setLevel('day'); }}
                className={cn('text-xs font-medium', level === 'day' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {dayData.find((d) => d.day === selectedDay)?.date || `Day ${selectedDay}`}
              </button>
            </>
          )}
        </div>

        {/* Month picker — only visible at month level */}
        {level === 'month' && (
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── Chart Area (changes per level) ── */}
      <div key={level} className="anim-tab-enter">
        {/* Level 1: Monthly bar chart */}
        {level === 'month' && (
          <div className="fe-card">
            <h3 className="fe-card-title">Overview 6 Bulan</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={(v) => compactRupiah(Number(v))} width={48} />
                <RechartsTooltip
                  formatter={(value: number) => [formatRupiah(value), 'Pengeluaran']}
                  contentStyle={{ borderRadius: '12px', fontSize: '11px', border: '1px solid #EEF2FF' }}
                  cursor={{ fill: `${primaryColor}10` }}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={48} onClick={(d: MonthData) => { if (d?.month) drillToMonth(d.month); }}>
                  {monthlyData.map((entry, i) => (
                    <Cell key={i} fill={entry.month === selectedMonth ? primaryColor : `${primaryColor}60`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-muted-foreground text-center mt-2">Klik bar bulan untuk drill-down ke minggu →</p>
          </div>
        )}

        {/* Level 2: Weekly bar chart */}
        {level === 'week' && (
          <div className="fe-card">
            <h3 className="fe-card-title">Breakdown per Minggu — {fullMonthLabel(selectedMonth)}</h3>
            <div className="flex items-end justify-around gap-3 h-48 mt-4">
              {weekData.map((w, i) => {
                const maxVal = Math.max(...weekData.map((d) => d.total), 1);
                const height = maxVal > 0 ? (w.total / maxVal) * 80 : 0;
                return (
                  <div
                    key={w.week}
                    className="flex-1 flex flex-col items-center gap-2 cursor-pointer"
                    onClick={() => drillFromWeekToDay(w.week)}
                  >
                    <span className="text-[10px] font-bold tabular-nums">{w.total > 0 ? formatRupiah(w.total).replace('Rp ', '') : '—'}</span>
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className="w-full rounded-t-lg anim-stagger transition-all duration-300 hover:opacity-80"
                        style={{
                          height: `${height}%`,
                          background: `linear-gradient(180deg, ${primaryColor}, ${primaryColor}80)`,
                          minHeight: w.total > 0 ? '8px' : '0',
                          animationDelay: `${i * 80}ms`,
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-muted-foreground">{w.label}</span>
                    <span className="text-[9px] text-muted-foreground">{w.dateRange}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">Klik minggu untuk drill-down ke hari →</p>
          </div>
        )}

        {/* Level 3: Daily breakdown for selected week */}
        {level === 'day' && selectedWeek !== null && (
          <div className="fe-card">
            <h3 className="fe-card-title">Rincian Harian — Week {selectedWeek} ({weekData.find(w => w.week === selectedWeek)?.dateRange})</h3>
            {dayData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Tidak ada transaksi di minggu ini</p>
            ) : (
              <div className="space-y-1.5 mt-4">
                {dayData.map((d, i) => {
                  const maxVal = Math.max(...dayData.map((dd) => dd.total), 1);
                  const pct = maxVal > 0 ? Math.round((d.total / maxVal) * 100) : 0;
                  return (
                    <button
                      key={d.day}
                      onClick={() => drillFromDayToTransactions(d.day)}
                      className="fe-cat-row anim-stagger w-full"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex flex-col items-center w-10 shrink-0">
                          <span className="text-sm font-bold tabular-nums">{d.day}</span>
                          <span className="text-[9px] text-muted-foreground truncate w-full text-center">{d.dayName.slice(0, 3)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs text-muted-foreground truncate">{d.count} transaksi</span>
                            <span className="text-sm font-bold tabular-nums">{formatRupiah(d.total)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: primaryColor }}
                            />
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground text-center mt-2">Klik hari untuk lihat transaksi →</p>
          </div>
        )}

        {/* Level 4: Transaction list for selected day */}
        {level === 'transactions' && selectedDay !== null && (
          <div className="fe-card">
            <h3 className="fe-card-title">Transaksi — {dayData.find((d) => d.day === selectedDay)?.dayName}, {dayData.find((d) => d.day === selectedDay)?.date}</h3>
            {transactionList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Tidak ada transaksi</p>
            ) : (
              <div className="space-y-1 mt-4 max-h-96 overflow-y-auto">
                {transactionList.map((tx, i) => {
                  const meta = getCategoryMeta(tx.category);
                  const d = new Date(tx.date);
                  return (
                    <div key={tx.id} className="fe-tx-row anim-stagger" style={{ animationDelay: `${i * 30}ms` }}>
                      <div className="fe-tx-logo">{meta.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tx.description || tx.category}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · {tx.category}
                        </p>
                      </div>
                      <span className="text-sm font-bold tabular-nums">{formatRupiah(tx.amount)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── KPI Cards (change per level) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          const color = accentColors[kpi.accent];
          return (
            <div key={i} className="fe-kpi anim-stagger anim-lift" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="fe-kpi-icon" style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}>
                <Icon className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="fe-kpi-label">{kpi.label}</p>
                <p className="fe-kpi-value">{kpi.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
