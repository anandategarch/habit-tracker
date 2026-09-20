'use client';

// components/habit-tracker/category-explorer-detail-histogram.tsx — "Distribusi
// Nominal" (C8) view detail kategori: 5 MiniProgressRing (satu per bucket
// rentang nominal) + insight bucket dominan. Diekstraksi dari
// category-explorer-detail-view.tsx saat SPLIT god-file (Task 71-g) — JSX
// identik. MiniProgressRing tetap LOKAL di sini (hanya dipakai histogram;
// saat `src/components/ui/progress-ring.tsx` bersama lahir, bisa diangkat).

import type { CSSProperties } from 'react';
import { Lightbulb, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compactRupiahSafe } from './category-explorer-helpers';
import type { CategoryDetailData } from './category-explorer-detail-data';

// ── MiniProgressRing: circular progress ring for histogram ──────────────

function MiniProgressRing({
  percentage,
  size = 48,
  strokeWidth = 3.5,
  color,
  isHighlighted = false,
  children,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  isHighlighted?: boolean;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.min(Math.max(percentage, 0), 100);
  const offset = circumference - (clampedPct / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Highlight glow ring for dominant bucket */}
        {isHighlighted && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius + 1.5}
            fill="none"
            stroke={color}
            strokeWidth="1"
            opacity="0.2"
          />
        )}
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
          opacity={isHighlighted ? 1 : 0.5}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

// ── Histogram card ───────────────────────────────────────────────────────

export interface CategoryDetailHistogramProps {
  histogram: CategoryDetailData['histogram'];
  histMaxCount: number;
  dominantBucket: CategoryDetailData['dominantBucket'];
  /** catTx.length — guard render (butuh ≥ 3 transaksi). */
  txCount: number;
  primaryColor: string;
}

export function CategoryDetailHistogram({
  histogram,
  histMaxCount,
  dominantBucket,
  txCount,
  primaryColor,
}: CategoryDetailHistogramProps) {
  if (!(histogram.length > 0 && txCount >= 3)) return null;
  return (
    <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger" style={{ '--stagger': 12 } as CSSProperties}>
      <h3 className="premium-label mb-3 flex items-center gap-2">
        <span className="chip-icon h-7 w-7 chip-amber shrink-0" aria-hidden="true">
          <Receipt className="h-3.5 w-3.5" />
        </span>
        Distribusi Nominal
      </h3>
      <div className="flex items-start justify-between gap-0.5 sm:gap-2">
        {histogram.map((b, i) => {
          const pct = histMaxCount > 0 ? Math.round((b.count / histMaxCount) * 100) : 0;
          const isDominant = i === dominantBucket.idx && b.count > 0;
          // Parse range into min/max for 2-line display on mobile
          const rangeParts = b.range.split('-');
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
              <MiniProgressRing
                percentage={pct}
                size={44}
                strokeWidth={3}
                color={primaryColor}
                isHighlighted={isDominant}
              >
                <span className={cn(
                  'text-[11px] font-bold tabular-nums',
                  isDominant ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {b.count > 0 ? `${b.count}×` : '—'}
                </span>
              </MiniProgressRing>
              {/* Range: 2-line on mobile (min / max), single-line on sm+ */}
              <div className="text-center shrink-0">
                <div className={cn(
                  'text-[10px] leading-tight',
                  isDominant ? 'font-semibold text-foreground' : 'text-muted-foreground'
                )}>
                  {rangeParts[0]}
                </div>
                {rangeParts[1] && (
                  <div className={cn(
                    'text-[10px] leading-tight',
                    isDominant ? 'font-semibold text-foreground' : 'text-muted-foreground'
                  )}>
                    {rangeParts[1]}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {dominantBucket.count > 0 && (
        <div className="mt-3 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-primary/5 border border-primary/10">
          <span className="chip-icon h-7 w-7 chip-amber shrink-0" aria-hidden="true">
            <Lightbulb className="h-3.5 w-3.5" />
          </span>
          <span className="text-[11px] text-muted-foreground">
            Mayoritas transaksi di range{' '}
            <span className="font-semibold text-foreground">{dominantBucket.range}</span> ({dominantBucket.count}×)
          </span>
        </div>
      )}
    </div>
  );
}
