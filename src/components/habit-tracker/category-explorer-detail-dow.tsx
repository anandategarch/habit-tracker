'use client';

// components/habit-tracker/category-explorer-detail-dow.tsx — "Pola per
// Hari" (A1) view detail kategori: DowLineChart (area chart Min..Sab,
// sibling read-only) + insight hari paling boros. Diekstraksi dari
// category-explorer-detail-view.tsx saat SPLIT god-file (Task 71-g) —
// JSX identik; guard render (catTx.length > 0) kini di dalam komponen.

import type { CSSProperties } from 'react';
import { Calendar, Lightbulb } from 'lucide-react';
import { compactRupiahSafe } from './category-explorer-helpers';
import { DowLineChart } from './category-explorer-dow-chart';
import { DOW_NAMES, type CategoryDetailData } from './category-explorer-detail-data';

export interface CategoryDetailDowProps {
  dowData: CategoryDetailData['dowData'];
  dowTop: CategoryDetailData['dowTop'];
  /** catTx.length — guard render kartu. */
  txCount: number;
  primaryColor: string;
}

export function CategoryDetailDow({ dowData, dowTop, txCount, primaryColor }: CategoryDetailDowProps) {
  if (txCount <= 0) return null;
  return (
    <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger" style={{ '--stagger': 11 } as CSSProperties}>
      <h3 className="premium-label mb-3 flex items-center gap-2">
        <span className="chip-icon h-7 w-7 chip-emerald shrink-0" aria-hidden="true">
          <Calendar className="h-3.5 w-3.5" />
        </span>
        Pola per Hari
      </h3>
      <DowLineChart data={dowData} topIdx={dowTop.idx} color={primaryColor} />
      {dowTop.total > 0 && (
        <div className="mt-3 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-primary/5 border border-primary/10">
          <span className="chip-icon h-7 w-7 chip-amber shrink-0" aria-hidden="true">
            <Lightbulb className="h-3.5 w-3.5" />
          </span>
          <span className="text-[11px] text-muted-foreground">
            Paling boros di hari <span className="font-semibold text-foreground">{DOW_NAMES[dowTop.idx]}</span> —{' '}
            <span className="font-semibold text-foreground">{compactRupiahSafe(dowTop.total)}</span> ({dowTop.count}×)
          </span>
        </div>
      )}
    </div>
  );
}
