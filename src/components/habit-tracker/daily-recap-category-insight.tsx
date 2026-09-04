'use client';

// ── Category Insight Row (per-category deep stats) ───────────────────────
// Extracted from daily-recap.tsx during SPLIT-PHASE2-UI.
// For each category that has transactions today, shows:
//   Row 1: emoji + name + today's total + delta badge (vs avg daily)
//   Row 2: muted mini-stats — Max tx, Avg tx, Max/day, Avg/day
//
// Delta badge:
//   - Negative (today < avg) → green "↓ Xk below avg" (good for expense)
//   - Positive (today > avg) → red "↑ Xk above avg" (overspending)
//   - Zero → muted "at avg"

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CategoryStats } from './daily-recap-types';
import { compactRupiahSafe } from './daily-recap-helpers';

export function CategoryInsightRow({
  stats,
  pct,
  period,
  allTimeLoading = false,
  allTimeError = false,
  onRetryAllTime,
  staggerIndex = 0,
}: {
  stats: CategoryStats;
  pct: number;
  period: 'month' | 'alltime';
  allTimeLoading?: boolean;
  allTimeError?: boolean;
  onRetryAllTime?: () => void;
  staggerIndex?: number;
}) {
  const delta = stats.deltaVsAvgDaily;
  const isBelow = delta < 0;
  const isAbove = delta > 0;
  const isAtAvg = delta === 0;

  const deltaColorClass = isAtAvg ? 'text-muted-foreground'
    : isBelow ? 'text-success dark:text-success/80'
    : 'text-destructive dark:text-destructive/80';
  const DeltaIcon = isAtAvg ? Minus : isBelow ? TrendingDown : TrendingUp;

  // Select the 4 metrics based on the active period tab.
  // 'month' = current Jakarta month stats, 'alltime' = all-time stats.
  // The 30-day stats (maxTransaction etc.) are NOT shown in the tab UI —
  // they only power the delta badge above (today vs 30-day avg) and the
  // anomaly z-score. This keeps the tab UI focused on 2 comparable periods.
  const maxTx = period === 'month' ? stats.monthMaxTransaction : stats.allTimeMaxTransaction;
  const avgTx = period === 'month' ? stats.monthAvgTransaction : stats.allTimeAvgTransaction;
  const maxDay = period === 'month' ? stats.monthMaxDaily : stats.allTimeMaxDaily;
  const avgDay = period === 'month' ? stats.monthAvgDaily : stats.allTimeAvgDaily;

  return (
    <div
      className="py-1.5 border-b border-border/40 last:border-b-0 anim-row-stagger"
      style={{ '--stagger-index': staggerIndex } as React.CSSProperties}
    >
      {/* Row 1: emoji + name + count + pct + today amount + delta badge */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="text-sm shrink-0">{stats.emoji}</span>
          <span className="text-xs font-medium truncate">{stats.name}</span>
          <span className="text-[11px] text-muted-foreground shrink-0">· {stats.todayCount}x</span>
          <span className="text-[11px] text-muted-foreground/70 shrink-0 tabular-nums">({pct}%)</span>
        </div>
        <span className="text-xs font-bold tabular-nums shrink-0">
          {compactRupiahSafe(stats.todayAmount)}
        </span>
        <div className={cn('flex items-center gap-0.5 shrink-0 min-w-[60px] justify-end', deltaColorClass)}>
          <DeltaIcon className="h-3 w-3 shrink-0" />
          <span className="text-[11px] font-medium tabular-nums">
            {isAtAvg ? 'at avg' : `${compactRupiahSafe(Math.abs(delta))}`}
          </span>
        </div>
      </div>

      {/* Row 2: mini-stats line — Max tx, Avg tx, Max/day, Avg/day
          Shows the active period's metrics (month or all-time).
          - When all-time data is loading (lazy fetch in progress), show
            "Memuat..." instead of 0s to avoid confusion.
          - BUG-2 fix: when all-time fetch failed, show "Gagal memuat" with
            a retry button instead of getting stuck on "Memuat…" forever. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 pl-5 text-[11px] text-muted-foreground">
        {allTimeError ? (
          <span className="inline-flex items-center gap-1 text-destructive">
            <span>Gagal memuat</span>
            {onRetryAllTime && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetryAllTime();
                }}
                className="text-primary hover:underline font-medium"
              >
                Coba lagi
              </button>
            )}
          </span>
        ) : allTimeLoading ? (
          <span className="italic text-muted-foreground/50">Memuat data all-time…</span>
        ) : (
          <>
            <span className="shrink-0">
              Max tx <span className="font-medium text-foreground/80 tabular-nums">{compactRupiahSafe(maxTx)}</span>
            </span>
            <span className="shrink-0 text-muted-foreground/50">·</span>
            <span className="shrink-0">
              Avg tx <span className="font-medium text-foreground/80 tabular-nums">{compactRupiahSafe(avgTx)}</span>
            </span>
            <span className="shrink-0 text-muted-foreground/50">·</span>
            <span className="shrink-0">
              Max/day <span className="font-medium text-foreground/80 tabular-nums">{compactRupiahSafe(maxDay)}</span>
            </span>
            <span className="shrink-0 text-muted-foreground/50">·</span>
            <span className="shrink-0">
              Avg/day <span className="font-medium text-foreground/80 tabular-nums">{compactRupiahSafe(avgDay)}</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}
