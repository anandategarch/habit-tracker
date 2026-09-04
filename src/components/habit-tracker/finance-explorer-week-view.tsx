// ---------------------------------------------------------------------------
// WeekView — Level 2: weekly bar chart with budget targets.
// Extracted from finance-explorer.tsx during SPLIT-PHASE3.
// ---------------------------------------------------------------------------

'use client';

import { Sparkles, Copy, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compactRupiah } from './finance-types';
import { fullMonthLabel } from './finance-explorer-helpers';
import type { WeekBudgetData, WeekData } from './finance-explorer-types';

export interface WeekViewProps {
  weekData: WeekData[];
  budgetData: WeekBudgetData | null | undefined;
  selectedMonth: string;
  primaryColor: string;
  warningColor: string;
  destructiveColor: string;
  onDrillFromWeekToDay: (week: number) => void;
  onOpenEditDialog: (week: number) => void;
  onAutoSuggest: () => void;
  onSplit: () => void;
}

export function WeekView({
  weekData,
  budgetData,
  selectedMonth,
  primaryColor,
  warningColor,
  destructiveColor,
  onDrillFromWeekToDay,
  onOpenEditDialog,
  onAutoSuggest,
  onSplit,
}: WeekViewProps) {
  return (
    <div className="fe-card anim-slide-in-right">
      <div className="flex items-center justify-between mb-2">
        <h3 className="fe-card-title">Breakdown per Minggu — {fullMonthLabel(selectedMonth)}</h3>
        {budgetData && budgetData.suggestedTarget > 0 && (
          <div className="flex items-center gap-1.5">
            <button onClick={onAutoSuggest} className="flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline" title="Set all weeks to suggested target">
              <Sparkles className="h-3 w-3" /> Auto
            </button>
            <button onClick={onSplit} className="flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline" title="Distribute evenly">
              <Copy className="h-3 w-3" /> Split
            </button>
          </div>
        )}
      </div>
      <div className="flex items-end justify-between gap-1 sm:gap-3 mt-4 overflow-hidden" style={{ height: '210px' }}>
        {weekData.map((w) => {
          const bw = budgetData?.weeks.find((b) => b.week === w.week);
          const target = bw?.target || 0;
          const maxVal = Math.max(...weekData.map((d) => d.total), target, 1);
          const barAreaHeight = 130;
          const heightPx = maxVal > 0 ? Math.round((w.total / maxVal) * barAreaHeight) : 0;
          const targetHeightPx = target > 0 && maxVal > 0 ? Math.round((target / maxVal) * barAreaHeight) : 0;
          const isOver = bw?.isOverBudget ?? false;
          return (
            <div
              key={w.week}
              className="flex-1 min-w-0 flex flex-col items-center cursor-pointer h-full"
              onClick={() => onDrillFromWeekToDay(w.week)}
            >
              {/* Value label — compactRupiah for narrow mobile columns */}
              <div className="h-7 flex items-end justify-center shrink-0 w-full">
                <span className={cn('text-[11px] font-bold tabular-nums text-center truncate', isOver && 'text-destructive')}>{w.total > 0 ? compactRupiah(w.total) : '—'}</span>
              </div>
              {/* Bar + target line */}
              <div className="w-full flex-1 flex items-end min-h-0 relative">
                {/* Target dashed line */}
                {target > 0 && (
                  <div
                    className="absolute left-0 right-0 border-t-2 border-dashed z-20"
                    style={{ bottom: `${targetHeightPx}px`, borderColor: warningColor, opacity: 0.6 }}
                  />
                )}
                {/* Bar */}
                <div
                  className={cn(
                    'w-full rounded-t-lg transition-all duration-300 hover:opacity-80',
                    isOver && 'anim-flash-red'
                  )}
                  style={{
                    height: `${heightPx}px`,
                    background: isOver
                      // FIX-COLOR-P3: was #ef4444→#f87171 hardcoded red
                      // gradient. Now uses destructiveColor (hex from
                      // useThemeColor) with alpha suffix so it follows
                      // the theme while preserving the gradient effect.
                      ? `linear-gradient(180deg, ${destructiveColor}, ${destructiveColor}aa)`
                      : `linear-gradient(180deg, ${primaryColor}, ${primaryColor}80)`,
                    minHeight: w.total > 0 ? '8px' : '0',
                  }}
                />
              </div>
              {/* Label + set target button */}
              <div className="h-12 flex flex-col items-center justify-end shrink-0 gap-0.5 w-full">
                <span className="text-[11px] font-semibold text-muted-foreground">{w.label}</span>
                <span className="text-[11px] text-muted-foreground">{w.dateRange}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenEditDialog(w.week); }}
                  className={cn(
                    'flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap',
                    target > 0
                      ? isOver
                        ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                        : 'bg-success/10 text-success hover:bg-success/20'
                      : 'bg-primary/10 text-primary hover:bg-primary/20',
                  )}
                >
                  <Target className="h-2.5 w-2.5 shrink-0" />
                  <span className="hidden sm:inline">{target > 0 ? compactRupiah(target) : 'Set Target'}</span>
                  <span className="sm:hidden sr-only">{target > 0 ? 'Edit target' : 'Set target'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="w-2 h-2 rounded" style={{ backgroundColor: primaryColor }} /> Spent
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="w-3 h-0 border-t-2 border-dashed" style={{ borderColor: warningColor }} /> Target
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground text-center mt-1">Klik minggu untuk drill-down ke hari · Klik target untuk edit →</p>
    </div>
  );
}
