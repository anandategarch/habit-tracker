'use client';

// ─────────────────────────────────────────────────────────────────────────────
// SHADCN-PHASE-3 — Spending Heatmap (monthly calendar grid)
// ─────────────────────────────────────────────────────────────────────────────
//
// Inspired by shadcn-fintech's spending heatmap: a 7-column (Sun-Sat) ×
// variable-row (weeks in month) grid where each cell is colored by that day's
// expense intensity. Tap a cell to reveal the day's total + transaction count
// in a detail panel below the grid.
//
// Design constraints:
//   - Uses existing color system only (bg-primary, bg-muted) — no new colors.
//   - 5 intensity levels (0%, 20%, 40%, 60%, 80%, 100%) with a legend.
//   - Always 7 columns + gap-1 (responsive). Cells are aspect-square so they
//     scale to the container width; on a 375px viewport they're ~40px
//     (comfortably above the 32px touch-target floor).
//   - `prefers-reduced-motion` disables the hover:scale-110 effect via the
//     usePrefersReducedMotion hook (Tailwind hover scale is a transition, not
//     an animation, so the global reduced-motion CSS block doesn't catch it).
//   - All date math goes through jakartaDateKey() to avoid the off-by-one TZ
//     bug at midnight Jakarta (matches dashboard API + finance.tsx grouping).
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import { jakartaDateKey } from '@/lib/timezone';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { formatRupiah, type Transaction } from './finance-types';

interface SpendingHeatmapProps {
  /** All transactions for the month (income + expense — only expenses are counted). */
  transactions: Transaction[];
  /** Selected month in `yyyy-MM` format. */
  selectedMonth: string;
}

interface DayCell {
  day: number | null;
  spending: number;
  count: number;
}

export function SpendingHeatmap({ transactions, selectedMonth }: SpendingHeatmapProps) {
  const reduceMotion = usePrefersReducedMotion();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  // ONE-CLICK-7 (Task 4-b A.4): "Lihat transaksi bulan ini →" in the day
  // detail box. txFilter has no date filter, so we pin the store's month to
  // this grid's month + jump to the Transactions sub-tab (single call pair).
  const setStoreMonth = useAppStore(s => s.setSelectedMonth);
  const openFinanceSubTab = useAppStore(s => s.openFinanceSubTab);

  const handleOpenMonthTransactions = () => {
    setStoreMonth(selectedMonth);
    openFinanceSubTab('transactions');
  };

  // Reset selection when month changes — uses the "adjust state during render"
  // pattern (React docs) instead of useEffect+setState (which the
  // react-hooks/set-state-in-effect rule forbids). Without this, a stale
  // day-31 selection could persist into a month with fewer days, leaving
  // the detail panel showing "no spending" for a non-existent day.
  const [prevMonth, setPrevMonth] = useState(selectedMonth);
  if (prevMonth !== selectedMonth) {
    setPrevMonth(selectedMonth);
    setSelectedDay(null);
  }

  // Group expenses by Jakarta-local day key (yyyy-MM-dd).
  // BUGFIX POST-3 #1: Filter ke selectedMonth supaya heatmap tidak terpengaruh
  // oleh active search (saat user search di Transactions tab lalu pindah ke
  // Overview, transactions array mungkin berisi hasil search all-time).
  // Tanpa filter ini, maxSpending ke-inflate oleh transaksi dari bulan lain.
  const dailySpending = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    transactions
      .filter(t => t.type === 'expense' &&
                    jakartaDateKey(new Date(t.date)).startsWith(selectedMonth))
      .forEach(t => {
        const dayKey = jakartaDateKey(new Date(t.date));
        if (!map[dayKey]) map[dayKey] = { total: 0, count: 0 };
        map[dayKey].total += t.amount;
        map[dayKey].count += 1;
      });
    return map;
  }, [transactions, selectedMonth]);

  // Max daily spending — used as the denominator for color-intensity scaling.
  // BUGFIX POST-3 #7: Use separate hasExpenses boolean instead of maxSpending===1
  // sentinel. Sebelumnya, if a real day had exactly Rp 1 expense, header shows
  // "Rp 0 max" while cell shows full intensity (ratio 1/1 = 1.0).
  const hasExpenses = Object.keys(dailySpending).length > 0;
  const maxSpending = hasExpenses
    ? Math.max(...Object.values(dailySpending).map(d => d.total))
    : 0;

  // Build the calendar grid for `selectedMonth`.
  const [year, month] = selectedMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay(); // 0=Sun .. 6=Sat

  // Lead-in blanks (so day 1 lands on the correct day-of-week column), then
  // one cell per day of the month. Trailing blanks are omitted — the grid
  // auto-flows and the last row simply has fewer cells.
  const cells: DayCell[] = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    cells.push({ day: null, spending: 0, count: 0 });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dayKey = `${selectedMonth}-${String(d).padStart(2, '0')}`;
    const data = dailySpending[dayKey];
    cells.push({ day: d, spending: data?.total ?? 0, count: data?.count ?? 0 });
  }

  // 5-step color ramp from bg-muted/50 (no spend) → bg-primary (max spend).
  // Using /20 /40 /60 /80 /100 opacity stops keeps a single hue (the theme's
  // primary) so the heatmap reads as "intensity of the same thing" rather
  // than "different categories".
  const getColor = (spending: number) => {
    if (spending === 0 || maxSpending === 0) return 'bg-muted/50';
    const ratio = spending / maxSpending;
    if (ratio < 0.2) return 'bg-primary/20';
    if (ratio < 0.4) return 'bg-primary/40';
    if (ratio < 0.6) return 'bg-primary/60';
    if (ratio < 0.8) return 'bg-primary/80';
    return 'bg-primary';
  };

  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  // Lookup the selected day's data for the detail panel.
  const selectedDayKey = selectedDay
    ? `${selectedMonth}-${String(selectedDay).padStart(2, '0')}`
    : null;
  const selectedData = selectedDayKey ? dailySpending[selectedDayKey] : undefined;

  return (
    <div className="anim-stagger" style={{ animationDelay: '60ms' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Heatmap Pengeluaran</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {hasExpenses ? `${formatRupiah(maxSpending)} max` : 'Belum ada data'}
        </span>
      </div>

      {/* Day-name headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayNames.map(d => (
          <div key={d} className="text-[10px] text-muted-foreground text-center">
            {d}
          </div>
        ))}
      </div>

      {/* Heatmap grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          const isSelected = cell.day !== null && selectedDay === cell.day;
          const hasSpending = cell.spending > 0;
          return (
            <button
              key={i}
              type="button"
              disabled={cell.day === null}
              aria-label={
                cell.day === null
                  ? undefined
                  : `Hari ${cell.day}: ${hasSpending ? formatRupiah(cell.spending) : 'tidak ada pengeluaran'}`
              }
              onClick={() =>
                cell.day && setSelectedDay(selectedDay === cell.day ? null : cell.day)
              }
              className={cn(
                'aspect-square min-h-8 min-w-8 rounded-md text-[10px] flex items-center justify-center transition-colors',
                cell.day === null ? 'bg-transparent pointer-events-none' : getColor(cell.spending),
                isSelected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                cell.day !== null && 'cursor-pointer',
                // Hover scale — disabled under prefers-reduced-motion.
                cell.day !== null && !reduceMotion && 'hover:scale-110',
              )}
            >
              {cell.day !== null && (
                <span
                  className={cn(
                    hasSpending ? 'text-white font-medium' : 'text-muted-foreground',
                  )}
                >
                  {cell.day}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="mt-3 p-3 rounded-lg bg-muted/50 anim-tab-enter">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium">Tanggal {selectedDay}</p>
              {!selectedData ? (
                <p className="text-xs text-muted-foreground">Tidak ada pengeluaran</p>
              ) : (
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-semibold text-primary">
                    {formatRupiah(selectedData.total)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedData.count} transaksi
                  </p>
                </div>
              )}
            </div>
            {/* ONE-CLICK-7: single tap → Transactions sub-tab on this grid's
                month. Ghost pill — kecil, tidak mengganggu grid. */}
            <button
              type="button"
              onClick={handleOpenMonthTransactions}
              className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 min-h-8 -my-0.5 text-[11px] font-semibold text-primary hover:bg-primary/10 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="Lihat transaksi bulan ini"
            >
              Lihat transaksi bulan ini
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Legend — BUGFIX POST-3 #11: Hide saat 0 expenses (tidak ada range
          untuk ditampilkan) */}
      {hasExpenses && (
        <div className="flex items-center justify-end gap-1 mt-2">
          <span className="text-[10px] text-muted-foreground">Sedikit</span>
          <div className="w-3 h-3 rounded bg-muted/50" />
          <div className="w-3 h-3 rounded bg-primary/20" />
          <div className="w-3 h-3 rounded bg-primary/40" />
          <div className="w-3 h-3 rounded bg-primary/60" />
          <div className="w-3 h-3 rounded bg-primary/80" />
          <div className="w-3 h-3 rounded bg-primary" />
          <span className="text-[10px] text-muted-foreground">Banyak</span>
        </div>
      )}
    </div>
  );
}
