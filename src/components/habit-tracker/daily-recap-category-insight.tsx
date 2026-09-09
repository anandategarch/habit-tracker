'use client';

// components/habit-tracker/daily-recap-category-insight.tsx — baris insight
// per kategori pengeluaran hari ini. Tab periode "Bulan ini / All-time"
// dimiliki pemanggil; baris menampilkan statistik sesuai periode.

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatRupiah, compactRupiahSafe } from './finance-types';
import type { CategoryStat } from './daily-recap-types';

export interface AllTimeStat {
  maxTransaction: number;
  avgTransaction: number;
  maxDaily: number;
  avgDaily: number;
}

export function CategoryInsightRow({
  insight,
  period,
  allTime,
  allTimeError,
  onRetryAllTime,
}: {
  insight: CategoryStat;
  period: 'month' | 'alltime';
  allTime?: AllTimeStat;
  allTimeError?: boolean;
  onRetryAllTime?: () => void;
}) {
  return (
    <div className="premium-list-item px-3! py-2.5!">
      <span
        className="h-9 w-9 rounded-xl grid place-items-center text-base shrink-0 ring-1 ring-black/5 dark:ring-white/10"
        style={{ backgroundColor: `${insight.color}20` }}
        aria-hidden="true"
      >
        {insight.emoji}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium truncate">{insight.name}</p>
          <p className="text-xs font-semibold tabular-nums shrink-0">
            {formatRupiah(insight.total)}
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {period === 'month' ? (
            <>
              {insight.count}× hari ini · rata² {compactRupiahSafe(insight.avg)}
              {insight.max > 0 ? ` · maks ${compactRupiahSafe(insight.max)}` : ''}
            </>
          ) : allTimeError ? (
            <span className="inline-flex items-center gap-1.5">
              Gagal memuat statistik all-time
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px]"
                onClick={onRetryAllTime}
                aria-label="Coba muat ulang statistik all-time"
              >
                <RefreshCw className="h-2.5 w-2.5" /> Coba
              </Button>
            </span>
          ) : allTime ? (
            <>
              all-time · rata²/tx {compactRupiahSafe(allTime.avgTransaction)} · maks/tx{' '}
              {compactRupiahSafe(allTime.maxTransaction)}
            </>
          ) : (
            'Memuat statistik all-time…'
          )}
        </p>
      </div>
    </div>
  );
}

/** Chip error ringkas saat query all-time gagal (dipakai di header grid). */
export function AllTimeErrorChip({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive dark:bg-destructive/15 dark:text-destructive/80 text-[11px] font-medium">
      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>Statistik all-time gagal dimuat</span>
      <button
        type="button"
        onClick={onRetry}
        className="hover:bg-destructive/20 rounded px-1 transition-colors"
        aria-label="Coba lagi muat statistik all-time"
      >
        <RefreshCw className="h-3 w-3" />
      </button>
    </div>
  );
}
