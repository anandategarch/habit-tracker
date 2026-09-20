'use client';

// components/habit-tracker/category-explorer-detail-breakdown.tsx — dua
// seksi "breakdown" view detail kategori:
//   • CategoryTimeOfDayBreakdown — A2 distribusi waktu (pagi/siang/sore/
//     malam) + footer dominan.
//   • CategorySourceBreakdown    — C9 sumber dana (bar persen per sumber).
// Diekstraksi dari category-explorer-detail-view.tsx saat SPLIT god-file
// (Task 71-g) — JSX identik; guard render (catTx.length > 0 /
// sourceList.length > 1) kini di dalam komponen (DOM sama).

import type { CSSProperties } from 'react';
import { Clock, Lightbulb, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compactRupiahSafe } from './category-explorer-helpers';
import type { CategoryDetailData } from './category-explorer-detail-data';

export interface CategoryTimeOfDayBreakdownProps {
  timeOfDayMap: CategoryDetailData['timeOfDayMap'];
  topTimeSlot: CategoryDetailData['topTimeSlot'];
  maxTimeSlot: number;
  /** catTx.length — footer "X dari N transaksi" + guard render. */
  txCount: number;
  primaryColor: string;
}

export function CategoryTimeOfDayBreakdown({
  timeOfDayMap,
  topTimeSlot,
  maxTimeSlot,
  txCount,
  primaryColor,
}: CategoryTimeOfDayBreakdownProps) {
  if (txCount <= 0) return null;
  return (
    <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger" style={{ '--stagger': 8 } as CSSProperties}>
      <h3 className="premium-label mb-2.5 flex items-center gap-2">
        <span className="chip-icon h-7 w-7 chip-sky shrink-0" aria-hidden="true">
          <Clock className="h-3.5 w-3.5" />
        </span>
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
        <div className="mt-2 flex items-center gap-2">
          <span className="chip-icon h-7 w-7 chip-amber shrink-0" aria-hidden="true">
            <Lightbulb className="h-3.5 w-3.5" />
          </span>
          <p className="text-[11px] text-muted-foreground">
            Dominan {topTimeSlot.label.toLowerCase()} — {topTimeSlot.count} dari {txCount} transaksi
          </p>
        </div>
      )}
    </div>
  );
}

export interface CategorySourceBreakdownProps {
  sourceList: CategoryDetailData['sourceList'];
  primaryColor: string;
}

export function CategorySourceBreakdown({ sourceList, primaryColor }: CategorySourceBreakdownProps) {
  if (sourceList.length <= 1) return null;
  return (
    <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger" style={{ '--stagger': 9 } as CSSProperties}>
      <h3 className="premium-label mb-2.5 flex items-center gap-2">
        <span className="chip-icon h-7 w-7 chip-violet shrink-0" aria-hidden="true">
          <Wallet className="h-3.5 w-3.5" />
        </span>
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
    </div>
  );
}
