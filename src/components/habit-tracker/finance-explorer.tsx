'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  ChevronLeft,
  Calendar,
  TrendingUp,
  Wallet,
  Target,
  Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRupiah, type Transaction } from './finance-types';
import { useThemeColor } from '@/hooks/use-theme-color';
import { CountUpRupiah, CountUpNumber } from './count-up';
import { dayToWeek, jakartaDateKey } from '@/lib/timezone';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

import type {
  DrillLevel,
  MonthData,
  DayData,
  WeekBudgetData,
  WeekData,
  FinanceExplorerProps,
} from './finance-explorer-types';
import { monthLabel, fullMonthLabel, buildMonthOptions } from './finance-explorer-helpers';
import { MonthView } from './finance-explorer-month-view';
import { WeekView } from './finance-explorer-week-view';
import { DayView } from './finance-explorer-day-view';
import { TransactionsView } from './finance-explorer-transactions-view';
import { BudgetDialog } from './finance-explorer-budget-dialog';

// ── Component ───────────────────────────────────────────────────────────

export default function FinanceExplorer({
  getCategoryMeta,
}: FinanceExplorerProps) {
  // FIX-COLOR-P3: pull additional theme tokens as hex so they can be used
  // in string-concatenation contexts (gradient stops, alpha hex suffixes)
  // AND adapt to the user's chosen color theme. useThemeColor converts the
  // oklch CSS variables to hex under the hood.
  const primaryColor = useThemeColor('primary');
  const warningColor = useThemeColor('warning');
  const destructiveColor = useThemeColor('destructive');
  const chart2Color = useThemeColor('chart-2');
  const mutedFgColor = useThemeColor('muted-foreground');
  const queryClient = useQueryClient();
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [level, setLevel] = useState<DrillLevel>('month');
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Budget edit dialog state
  const [editingWeek, setEditingWeek] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState('');
  const [editRollover, setEditRollover] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch weekly budget data for target/rollover/suggestion
  const { data: budgetData } = useQuery<WeekBudgetData>({
    queryKey: ['finance', 'weekly-budget', selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/finance/weekly-budget?month=${selectedMonth}`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 15_000,
  });

  // Fetch ALL expense transactions for the selected month
  const { data: allTxRaw = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ['finance', 'explorer', selectedMonth],
    queryFn: async () => {
      // Use the `month` param (already timezone-fixed with 7h buffer +
      // jakartaDateKey post-filter in the API) instead of startDate/endDate
      // which had a midnight-truncation bug (date-only string parsed as
      // UTC midnight → transactions after midnight excluded).
      const res = await fetch(`/api/finance/transactions?month=${selectedMonth}&type=expense`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 15_000,
  });

  // Exclude "Penyesuaian Saldo" and "Transfer Antar Sumber" from all
  // explorer calculations. These are internal movements, not real expenses.
  // Filter once here so all derived data (weekData, dayData, stats) uses
  // the clean set.
  const EXCLUDED_CATEGORIES = ['Penyesuaian Saldo', 'Transfer Antar Sumber'];
  const allTx = allTxRaw.filter((tx) => !EXCLUDED_CATEGORIES.includes(tx.category));

  // Also fetch 6-month overview for Level 1 bar chart
  const { data: monthlyData = [], isError: monthlyError } = useQuery<MonthData[]>({
    queryKey: ['finance', 'explorer-monthly'],
    queryFn: async () => {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      // Send FULL ISO datetime strings (not date-only) to avoid midnight
      // truncation. Previously sent "2026-08-01" which API parsed as UTC
      // midnight → all transactions after midnight on Aug 1 were excluded
      // → August bar didn't appear in the chart despite having transactions.
      // Add 1 day buffer to endDate to include all of today's transactions.
      const startDate = sixMonthsAgo.toISOString();
      const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      const res = await fetch(
        `/api/finance/transactions?type=expense&startDate=${startDate}&endDate=${endDate}`,
      );
      if (!res.ok) throw new Error('Failed to fetch monthly data');
      const txs: Transaction[] = await res.json();
      // Group by Jakarta month using jakartaDateKey for correct assignment
      // (previously used manual JAKARTA_OFFSET_MS which only works on UTC servers).
      // Also exclude internal movements (adjustment + transfer) from totals.
      const monthMap: Record<string, number> = {};
      for (const tx of txs) {
        if (EXCLUDED_CATEGORIES.includes(tx.category)) continue;
        const key = jakartaDateKey(new Date(tx.date)).slice(0, 7);
        monthMap[key] = (monthMap[key] || 0) + (tx.amount || 0);
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
      // Use jakartaDateKey for correct day-of-month extraction (works on
      // any server TZ, not just UTC).
      const day = parseInt(jakartaDateKey(new Date(tx.date)).slice(8, 10), 10);
      weeks[dayToWeek(day) - 1] += (tx.amount || 0);
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
      const day = parseInt(jakartaDateKey(new Date(tx.date)).slice(8, 10), 10);
      if (dayToWeek(day) !== selectedWeek) continue;
      if (!dayMap[day]) dayMap[day] = { total: 0, count: 0 };
      dayMap[day].total += (tx.amount || 0);
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
        const day = parseInt(jakartaDateKey(new Date(tx.date)).slice(8, 10), 10);
        return dayToWeek(day) === selectedWeek && day === selectedDay;
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

  // ── Budget handlers ──

  const openEditDialog = (week: number) => {
    const bw = budgetData?.weeks.find((w) => w.week === week);
    setEditingWeek(week);
    setEditTarget(bw && bw.target > 0 ? String(bw.target) : String(budgetData?.suggestedTarget || '500000'));
    setEditRollover(bw?.rollover ?? true);
  };

  const handleSaveBudget = async () => {
    if (editingWeek === null) return;
    setSaving(true);
    try {
      const res = await fetch('/api/finance/weekly-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          week: editingWeek,
          target: parseInt(editTarget) || 0,
          rollover: editRollover,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(`Target Week ${editingWeek} disimpan`);
      queryClient.invalidateQueries({ queryKey: ['finance', 'weekly-budget'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      setEditingWeek(null);
    } catch {
      toast.error('Gagal menyimpan target');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoSuggest = async () => {
    const target = budgetData?.suggestedTarget;
    if (!target) return;
    try {
      await Promise.all(
        [1, 2, 3, 4].map((w) =>
          fetch('/api/finance/weekly-budget', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month: selectedMonth, week: w, target, rollover: true }),
          })
        )
      );
      toast.success(`Target ${formatRupiah(target)} diterapkan ke semua minggu`);
      queryClient.invalidateQueries({ queryKey: ['finance', 'weekly-budget'] });
    } catch {
      toast.error('Gagal menerapkan target');
    }
  };

  const handleSplit = async () => {
    const target = budgetData?.suggestedTarget;
    if (!target) return;
    const perWeek = Math.round(target / 4);
    try {
      await Promise.all(
        [1, 2, 3, 4].map((w) =>
          fetch('/api/finance/weekly-budget', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month: selectedMonth, week: w, target: perWeek, rollover: true }),
          })
        )
      );
      toast.success(`${formatRupiah(perWeek)} per minggu`);
      queryClient.invalidateQueries({ queryKey: ['finance', 'weekly-budget'] });
    } catch {
      toast.error('Gagal membagi target');
    }
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

  // FIX-COLOR-P2: was { indigo: '#6366F1', purple: '#8B5CF6', amber: '#F59E0B', blue: '#3B82F6' }.
  // Replaced the hex values (NOT the keys — KPI definitions reference these keys
  // by name) so indigo→green, purple→teal, blue→rose. No visual blue remains.
  // FIX-COLOR-P3: hex values now sourced from theme tokens via useThemeColor
  // above, so the KPI card gradient follows the user's chosen theme (was
  // hardcoded #22C55E/#14B8A6/#F59E0B/#F43F5E).
  const accentColors: Record<string, string> = {
    indigo: primaryColor,
    purple: chart2Color,
    amber: warningColor,
    blue: destructiveColor,
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
          <button
            onClick={() => { setLevel('month'); setSelectedWeek(null); setSelectedDay(null); }}
            className={cn('text-xs font-medium hover:underline', level === 'month' ? 'text-foreground' : 'text-muted-foreground')}
          >
            {fullMonthLabel(selectedMonth)}
          </button>
          {level !== 'month' && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <button
                onClick={() => { setLevel('week'); setSelectedDay(null); }}
                className={cn('text-xs font-medium hover:underline', level === 'week' ? 'text-foreground' : 'text-muted-foreground')}
              >
                Weeks
              </button>
            </>
          )}
          {selectedWeek !== null && (level === 'day' || level === 'transactions') && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <button
                onClick={() => { setLevel('week'); setSelectedDay(null); }}
                className="text-xs font-medium text-muted-foreground hover:underline"
              >
                W{selectedWeek}
              </button>
            </>
          )}
          {selectedDay !== null && level === 'transactions' && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <button
                onClick={() => setLevel('day')}
                className="text-xs font-medium text-muted-foreground hover:underline"
              >
                {dayData.find((d) => d.day === selectedDay)?.date || `Day ${selectedDay}`}
              </button>
            </>
          )}
        </div>

        {/* Month picker — only visible at month level */}
        {level === 'month' && (
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs">
              <Calendar className="h-3 w-3" />
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
        {level === 'month' && (
          <MonthView
            monthlyData={monthlyData}
            monthlyError={monthlyError}
            selectedMonth={selectedMonth}
            primaryColor={primaryColor}
            mutedFgColor={mutedFgColor}
            onDrillToMonth={drillToMonth}
          />
        )}

        {level === 'week' && (
          <WeekView
            weekData={weekData}
            budgetData={budgetData}
            selectedMonth={selectedMonth}
            primaryColor={primaryColor}
            warningColor={warningColor}
            destructiveColor={destructiveColor}
            onDrillFromWeekToDay={drillFromWeekToDay}
            onOpenEditDialog={openEditDialog}
            onAutoSuggest={handleAutoSuggest}
            onSplit={handleSplit}
          />
        )}

        {level === 'day' && selectedWeek !== null && (
          <DayView
            selectedWeek={selectedWeek}
            weekData={weekData}
            dayData={dayData}
            primaryColor={primaryColor}
            onDrillFromDayToTransactions={drillFromDayToTransactions}
          />
        )}

        {level === 'transactions' && selectedDay !== null && (
          <TransactionsView
            selectedDay={selectedDay}
            dayData={dayData}
            transactionList={transactionList}
            getCategoryMeta={getCategoryMeta}
          />
        )}
      </div>

      {/* ── KPI Cards (change per level) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          const color = accentColors[kpi.accent];
          return (
            <div key={`${level}-${i}`} className="fe-kpi anim-stagger" style={{ animationDelay: `${i * 60}ms` }}>
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

      {/* ── Budget Edit Dialog ── */}
      <BudgetDialog
        editingWeek={editingWeek}
        budgetData={budgetData}
        editTarget={editTarget}
        editRollover={editRollover}
        saving={saving}
        onSetEditingWeek={setEditingWeek}
        onSetEditTarget={setEditTarget}
        onSetEditRollover={setEditRollover}
        onSave={handleSaveBudget}
      />
    </div>
  );
}
