'use client';

// ── Hourly Heatmap (48-bar mini viz, 30-min granularity) ────────────────
// Extracted from daily-recap.tsx during SPLIT-PHASE2-UI.
// Shows total spending for the day as a label above the bars, then the 48-bar
// heatmap (each bar = 30 minutes) below, then the hour axis labels at the
// bottom. 30-min granularity means a 08.30 coffee shows in its own bar
// (bucket 17 = "08.30"), not rounded down to "08:00" (bucket 16).

import { cn } from '@/lib/utils';
import { formatRupiah } from './finance-types';
import { HOUR_LABELS, compactRupiahSafe, formatSlotLabel } from './daily-recap-helpers';

export function HourlyHeatmap({ hourly }: { hourly: number[] }) {
  const max = Math.max(...hourly, 1);
  const hasData = hourly.some((h) => h > 0);
  const total = hourly.reduce((s, a) => s + a, 0);

  if (!hasData) {
    return (
      <div className="h-8 flex items-center justify-center text-[11px] text-muted-foreground italic">
        Belum ada aktivitas
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Total spending label on top of the bars */}
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Total</span>
        <span className="text-xs font-bold tabular-nums text-foreground">{compactRupiahSafe(total)}</span>
      </div>
      {/* 48 bars: gap reduced from 3px to 1px so all bars fit on mobile
          (48 bars × 4px min-width + 47 × 1px gap = 239px — fits 375px
          viewport with room to spare). Each bar is flex-1 so it grows
          to fill available width on wider screens. */}
      <div className="flex items-end gap-[1px] h-10">
        {hourly.map((amt, bucket) => {
          const hRatio = amt / max;
          // Derive the actual hour (0-23) from the 30-min bucket for
          // color coding. bucket 0,1 → hour 0; bucket 2,3 → hour 1; etc.
          const hour = Math.floor(bucket / 2);
          const isLateNight = hour >= 22 || hour < 5;
          const isMorning = hour >= 5 && hour < 12;
          const isAfternoon = hour >= 12 && hour < 18;
          const color = amt === 0 ? 'bg-muted/30'
            : isLateNight ? 'bg-purple-400 dark:bg-purple-500'
            : isMorning ? 'bg-warning/80 dark:bg-warning'
            : isAfternoon ? 'bg-primary'
            : 'bg-success/80 dark:bg-success';
          // Use native title attribute instead of Tooltip component.
          // 48 Tooltip wrappers = 48 event listeners + 48 React state
          // instances = heavy. Native title is zero-JS, zero-cost.
          // Tooltip shows the precise 30-min slot label (e.g., "08.30")
          // so the user knows exactly which half-hour bucket they're hovering.
          return (
            <div
              key={bucket}
              className={cn('flex-1 min-w-[2px] rounded-sm transition-all hover:opacity-80 cursor-default', color)}
              style={{ height: amt === 0 ? '3px' : `${Math.max(10, hRatio * 100)}%` }}
              title={`${formatSlotLabel(bucket)} · ${amt > 0 ? formatRupiah(amt) : '—'}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground px-0.5">
        {HOUR_LABELS.map((h) => <span key={h}>{h}</span>)}
      </div>
    </div>
  );
}
