'use client';

// components/habit-tracker/category-explorer-detail-weekly.tsx — "Ringkasan
// Mingguan" M1–M5 (MERGE Task 32, transplant Eksplorasi) view detail
// kategori. BUGHUNT-47: rentang tanggal minggu eksplisit per kartu.
// Diekstraksi dari category-explorer-detail-view.tsx saat SPLIT god-file
// (Task 71-g) — JSX identik; bar mini diskalakan ke minggu tertinggi.

import type { CSSProperties } from 'react';
import { Calendar } from 'lucide-react';
import { compactRupiahSafe } from './category-explorer-helpers';
import type { CategoryWeeklySummary } from './category-explorer-detail-data';

export interface CategoryDetailWeeklyProps {
  weekly: CategoryWeeklySummary;
  primaryColor: string;
}

export function CategoryDetailWeekly({ weekly, primaryColor }: CategoryDetailWeeklyProps) {
  if (weekly.length === 0) return null;
  return (
    <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger" style={{ '--stagger': 6 } as CSSProperties}>
      <h3 className="premium-label mb-3 flex items-center gap-2">
        <span className="chip-icon h-7 w-7 chip-emerald shrink-0" aria-hidden="true">
          <Calendar className="h-3.5 w-3.5" />
        </span>
        Ringkasan Mingguan
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {weekly.map((w) => {
          const maxWeek = Math.max(...weekly.map((x) => x.total), 1);
          return (
            <div key={w.name} className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 min-w-0">
              <div className="flex items-baseline justify-between gap-1 min-w-0">
                <p className="text-[11px] font-semibold text-muted-foreground truncate">{w.name}</p>
                {/* BUGHUNT-47: rentang tanggal minggu eksplisit — menghapus
                    ambiguitas "minggu mana" yang memicu laporan bug. */}
                <p className="text-[10px] text-muted-foreground/70 tabular-nums shrink-0">{w.rangeLabel}</p>
              </div>
              <p className="text-sm font-bold tabular-nums">{compactRupiahSafe(w.total)}</p>
              <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden mt-1.5" aria-hidden="true">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (w.total / maxWeek) * 100)}%`, backgroundColor: primaryColor }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{w.count} transaksi</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
