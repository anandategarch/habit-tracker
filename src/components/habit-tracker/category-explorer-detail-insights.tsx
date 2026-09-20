'use client';

// components/habit-tracker/category-explorer-detail-insights.tsx — dua kartu
// insight satu-baris view detail kategori:
//   • CategoryPeakHourCard  — jam belanja paling sering (pattern insight).
//   • CategoryPersonalityCard — D11 tag kepribadian kategori (Pengeluar
//     Besar / Ritual Harian / Boros Akhir Pekan / …).
// Diekstraksi dari category-explorer-detail-view.tsx saat SPLIT god-file
// (Task 71-g) — JSX identik; guard render (count > 0 / tag != null) kini
// di dalam komponen (sebelumnya kondisi && di JSX induk — DOM sama).

import type { CSSProperties } from 'react';
import { Clock } from 'lucide-react';
import type { CategoryDetailData } from './category-explorer-detail-data';

export interface CategoryPeakHourCardProps {
  peakHour: CategoryDetailData['peakHour'];
}

export function CategoryPeakHourCard({ peakHour }: CategoryPeakHourCardProps) {
  if (peakHour.count <= 0) return null;
  return (
    <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 flex items-center gap-3 anim-stagger" style={{ '--stagger': 7 } as CSSProperties}>
      <span className="chip-icon h-8 w-8 chip-sky shrink-0" aria-hidden="true">
        <Clock className="h-4 w-4" />
      </span>
      <p className="text-xs text-muted-foreground">
        Paling sering beli jam{' '}
        <span className="font-semibold text-foreground">
          {String(peakHour.hour).padStart(2, '0')}:00
        </span>{' '}
        ({peakHour.count}×)
      </p>
    </div>
  );
}

export interface CategoryPersonalityCardProps {
  personalityTag: CategoryDetailData['personalityTag'];
}

export function CategoryPersonalityCard({ personalityTag }: CategoryPersonalityCardProps) {
  if (!personalityTag) return null;
  return (
    <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 flex items-center gap-3 anim-stagger" style={{ '--stagger': 10 } as CSSProperties}>
      <span className="text-2xl shrink-0">{personalityTag.emoji}</span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-primary">{personalityTag.tag}</p>
        <p className="text-[11px] text-muted-foreground">{personalityTag.desc}</p>
      </div>
    </div>
  );
}
