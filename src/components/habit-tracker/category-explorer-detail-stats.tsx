'use client';

// components/habit-tracker/category-explorer-detail-stats.tsx — grid 4 kartu
// statistik view detail kategori (Rata²/tx, Rata²/hari, Tertinggi, Hari
// Tertinggi). Diekstraksi dari category-explorer-detail-view.tsx saat
// SPLIT god-file (Task 71-g) — JSX/stagger identik.

import type { CSSProperties } from 'react';
import { compactRupiahSafe } from './category-explorer-helpers';
import type { CategoryDetailData } from './category-explorer-detail-data';

export interface CategoryDetailStatsProps {
  avgPerTx: number;
  avgPerDay: number;
  maxTx: CategoryDetailData['maxTx'];
  maxDay: CategoryDetailData['maxDay'];
}

export function CategoryDetailStats({ avgPerTx, avgPerDay, maxTx, maxDay }: CategoryDetailStatsProps) {
  return (
    /* Stats grid */
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger" style={{ '--stagger': 2 } as CSSProperties}>
        <p className="premium-label">Rata²/tx</p>
        <p className="premium-stat text-base sm:text-lg mt-1">{compactRupiahSafe(avgPerTx)}</p>
      </div>
      <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger" style={{ '--stagger': 3 } as CSSProperties}>
        <p className="premium-label">Rata²/hari</p>
        <p className="premium-stat text-base sm:text-lg mt-1">{compactRupiahSafe(avgPerDay)}</p>
      </div>
      <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger" style={{ '--stagger': 4 } as CSSProperties}>
        <p className="premium-label">Tertinggi</p>
        <p className="premium-stat text-base sm:text-lg mt-1">{compactRupiahSafe(maxTx.amount)}</p>
      </div>
      <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger" style={{ '--stagger': 5 } as CSSProperties}>
        <p className="premium-label">Hari Tertinggi</p>
        <p className="premium-stat text-base sm:text-lg mt-1">{maxDay.day > 0 ? `Tgl ${maxDay.day}` : '—'}</p>
      </div>
    </div>
  );
}
