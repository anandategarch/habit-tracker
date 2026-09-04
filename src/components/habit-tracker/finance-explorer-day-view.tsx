// ---------------------------------------------------------------------------
// DayView — Level 3: daily breakdown for selected week.
// Extracted from finance-explorer.tsx during SPLIT-PHASE3.
// ---------------------------------------------------------------------------

'use client';

import { ChevronRight } from 'lucide-react';
import { formatRupiah } from './finance-types';
import type { DayData, WeekData } from './finance-explorer-types';

export interface DayViewProps {
  selectedWeek: number;
  weekData: WeekData[];
  dayData: DayData[];
  primaryColor: string;
  onDrillFromDayToTransactions: (day: number) => void;
}

export function DayView({
  selectedWeek,
  weekData,
  dayData,
  primaryColor,
  onDrillFromDayToTransactions,
}: DayViewProps) {
  return (
    <div className="fe-card">
      <h3 className="fe-card-title">Rincian Harian — Week {selectedWeek} ({weekData.find((w) => w.week === selectedWeek)?.dateRange})</h3>
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
                onClick={() => onDrillFromDayToTransactions(d.day)}
                className="fe-cat-row anim-stagger w-full"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex flex-col items-center w-10 shrink-0">
                    <span className="text-sm font-bold tabular-nums">{d.day}</span>
                    <span className="text-[11px] text-muted-foreground truncate w-full text-center">{d.dayName.slice(0, 3)}</span>
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
      <p className="text-[11px] text-muted-foreground text-center mt-2">Klik hari untuk lihat transaksi →</p>
    </div>
  );
}
