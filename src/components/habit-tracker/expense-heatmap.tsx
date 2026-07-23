'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/app-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, CalendarDays } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { formatRupiah, type Transaction } from '@/components/habit-tracker/finance-types';
import { cn } from '@/lib/utils';

// ── ChartInfo Helper ─────────────────────────────────────────────────────

function ChartInfo({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
            aria-label="Info"
          >
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

// ── Heatmap color scale ──────────────────────────────────────────────────
// Returns a background color based on spending intensity (0 = no spend,
// 1 = max spend in month). Uses a green→yellow→red gradient so high-spend
// days visually "pop" as warnings.
function getHeatmapColor(intensity: number): string {
  if (intensity <= 0) return 'transparent';
  // 5 buckets: 0-20%, 20-40%, 40-60%, 60-80%, 80-100%
  if (intensity < 0.2) return 'oklch(0.95 0.05 142)';   // very light green
  if (intensity < 0.4) return 'oklch(0.85 0.12 142)';   // light green
  if (intensity < 0.6) return 'oklch(0.80 0.15 85)';    // yellow
  if (intensity < 0.8) return 'oklch(0.70 0.18 50)';    // orange
  return 'oklch(0.60 0.22 27)';                          // red
}

const WEEKDAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// ── Component ────────────────────────────────────────────────────────────

export function ExpenseHeatmap() {
  const selectedMonth = useAppStore(s => s.selectedMonth);

  // Fetch expense transactions for the selected month via TanStack Query.
  // Auto-cached, auto-refetched on month change, race-free.
  const { data: transactions = [], isLoading: loading } = useQuery<Transaction[]>({
    queryKey: ['finance-heatmap', selectedMonth],
    queryFn: async () => {
      const r = await fetch(`/api/finance/transactions?month=${selectedMonth}&type=expense`);
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 30_000,
  });

  // ── Build daily expense map for the selected month ───────────────────
  const { dailyExpenses, maxExpense, monthDate, totalExpense, daysInMonth } = useMemo(() => {
    const monthDate = parseISO(`${selectedMonth}-01`);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Sum expenses per day (YYYY-MM-DD -> amount)
    const expenseMap = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.type !== 'expense') continue;
      const dayKey = tx.date.slice(0, 10); // YYYY-MM-DD
      expenseMap.set(dayKey, (expenseMap.get(dayKey) || 0) + tx.amount);
    }

    const dailyExpenses = allDays.map((d) => {
      const key = format(d, 'yyyy-MM-dd');
      return {
        date: d,
        key,
        amount: expenseMap.get(key) || 0,
      };
    });

    const maxExpense = dailyExpenses.reduce((max, d) => Math.max(max, d.amount), 0);
    const totalExpense = dailyExpenses.reduce((sum, d) => sum + d.amount, 0);

    return {
      dailyExpenses,
      maxExpense,
      monthDate,
      totalExpense,
      daysInMonth: allDays.length,
    };
  }, [transactions, selectedMonth]);

  const monthLabel = format(monthDate, 'MMMM yyyy', { locale: idLocale });

  // ── Build calendar grid (Sunday-first to match Indonesian convention) ──
  // Pad start with empty cells so day 1 aligns with correct weekday column.
  const firstDayOfWeek = getDay(monthDate); // 0=Sun, 1=Mon, ...
  const calendarCells: (typeof dailyExpenses[0] | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...dailyExpenses,
  ];

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Skeleton className="h-[280px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Heatmap Pengeluaran ({monthLabel})
          <ChartInfo text="Warna sel menunjukkan intensitas pengeluaran harian: hijau = sedikit, kuning = sedang, merah = tinggi. Kosong = tidak ada pengeluaran. Hover untuk lihat detail nominal." />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {/* Summary */}
        <div className="flex items-center justify-between mb-3 text-xs">
          <span className="text-muted-foreground">
            Total pengeluaran: <span className="font-semibold text-foreground">{formatRupiah(totalExpense)}</span>
          </span>
          <span className="text-muted-foreground">
            Rata-rata/hari: <span className="font-semibold text-foreground">{formatRupiah(Math.round(totalExpense / daysInMonth))}</span>
          </span>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_LABELS.map((day) => (
            <div key={day} className="text-center text-[10px] font-medium text-muted-foreground py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((cell, idx) => {
            if (cell === null) {
              return <div key={`pad-${idx}`} className="aspect-square" />;
            }
            const intensity = maxExpense > 0 ? cell.amount / maxExpense : 0;
            const bgColor = getHeatmapColor(intensity);
            const hasSpend = cell.amount > 0;
            const today = isToday(cell.date);
            const dayNum = format(cell.date, 'd');

            return (
              <TooltipProvider key={cell.key} delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        'aspect-square rounded-md flex flex-col items-center justify-center text-[10px] font-medium cursor-default transition-transform hover:scale-110 hover:z-10 relative',
                        hasSpend ? 'text-foreground' : 'text-muted-foreground/50',
                        today && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                      )}
                      style={hasSpend ? { backgroundColor: bgColor } : undefined}
                    >
                      <span>{dayNum}</span>
                      {hasSpend && (
                        <span className="text-[8px] leading-none mt-0.5 opacity-70">
                          {(cell.amount / 1000).toFixed(0)}k
                        </span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <div className="text-center">
                      <div className="font-semibold">{format(cell.date, 'EEEE, d MMM', { locale: idLocale })}</div>
                      <div className={cn('mt-0.5', hasSpend ? 'text-red-500' : 'text-muted-foreground')}>
                        {hasSpend ? formatRupiah(cell.amount) : 'Tidak ada pengeluaran'}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-1.5 mt-3 text-[10px] text-muted-foreground">
          <span>Sedikit</span>
          <div className="flex gap-0.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'oklch(0.95 0.05 142)' }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'oklch(0.85 0.12 142)' }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'oklch(0.80 0.15 85)' }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'oklch(0.70 0.18 50)' }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'oklch(0.60 0.22 27)' }} />
          </div>
          <span>Banyak</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default ExpenseHeatmap;
