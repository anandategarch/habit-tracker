'use client';

// components/habit-tracker/category-explorer-detail-anomalies.tsx — "Anomali
// Terdeteksi" (D12) view detail kategori: transaksi dengan z-score > 1.5σ
// di atas rata-rata (maks 3 baris). Diekstraksi dari
// category-explorer-detail-view.tsx saat SPLIT god-file (Task 71-g) — JSX
// identik; guard render (anomalies.length > 0) kini di dalam komponen.

import type { CSSProperties } from 'react';
import { TrendingUp } from 'lucide-react';
import { formatTxTime, formatDateShort } from '@/lib/finance-helpers';
import { compactRupiahSafe } from './category-explorer-helpers';
import type { CategoryDetailData } from './category-explorer-detail-data';

export interface CategoryDetailAnomaliesProps {
  anomalies: CategoryDetailData['anomalies'];
}

export function CategoryDetailAnomalies({ anomalies }: CategoryDetailAnomaliesProps) {
  if (anomalies.length <= 0) return null;
  return (
    <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger" style={{ '--stagger': 13 } as CSSProperties}>
      <h3 className="premium-label mb-2.5 flex items-center gap-2">
        <span className="chip-icon h-7 w-7 chip-rose shrink-0" aria-hidden="true">
          <TrendingUp className="h-3.5 w-3.5" />
        </span>
        Anomali Terdeteksi
      </h3>
      <div className="space-y-1.5">
        {anomalies.slice(0, 3).map((a, i) => (
          <div key={a.tx.id || i} className="flex items-center gap-2 text-xs">
            <span className="text-warning shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {a.tx.description || a.tx.category}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatDateShort(a.tx.date)} · {formatTxTime(a.tx.date)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold tabular-nums text-warning dark:text-warning/80">
                {compactRupiahSafe(a.tx.amount)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {a.zScore}σ di atas rata-rata ({compactRupiahSafe(a.mean)})
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
