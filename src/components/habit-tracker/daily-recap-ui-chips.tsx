'use client';

// components/habit-tracker/daily-recap-ui-chips.tsx — chip kecil rekap harian:
// ComparisonPill (vs kemarin / vs 7 hari), AlertChip (peringatan), StatTile
// (tile Masuk/Keluar/Bersih).

import type { ReactNode } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, Info, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ComparisonPill({
  changePct,
  direction,
  label,
}: {
  changePct: number | null;
  direction: 'up' | 'down' | 'flat';
  label: string;
}) {
  const showPct = changePct !== null && Number.isFinite(changePct);
  const isUp = direction === 'up';
  const isDown = direction === 'down';
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
        isUp && 'bg-destructive/10 text-destructive dark:bg-destructive/15 dark:text-destructive/80',
        isDown && 'bg-success/10 text-success dark:bg-success/15 dark:text-success/80',
        !isUp && !isDown && 'bg-muted text-muted-foreground'
      )}
      title={showPct ? `${label}: ${changePct}%` : label}
    >
      {isUp ? (
        <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden="true" />
      ) : isDown ? (
        <ArrowDownRight className="h-3 w-3 shrink-0" aria-hidden="true" />
      ) : (
        <Minus className="h-3 w-3 shrink-0" aria-hidden="true" />
      )}
      <span>
        {label}
        {showPct ? ` ${Math.abs(Math.round(changePct ?? 0))}%` : ''}
      </span>
    </div>
  );
}

export function AlertChip({ alert }: { alert: { tone: 'info' | 'warning' | 'danger'; text: string } }) {
  const Icon = alert.tone === 'info' ? Info : AlertTriangle;
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium max-w-full',
        alert.tone === 'info' && 'bg-primary/10 text-primary',
        alert.tone === 'warning' && 'bg-warning/10 text-warning dark:bg-warning/15 dark:text-warning/80',
        alert.tone === 'danger' && 'bg-destructive/10 text-destructive dark:bg-destructive/15 dark:text-destructive/80'
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{alert.text}</span>
    </div>
  );
}

export function StatTile({
  label,
  value,
  icon: Icon,
  iconClass,
  valueClass,
}: {
  label: string;
  value: ReactNode;
  icon: React.ElementType;
  iconClass?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className={cn(
          'h-8 w-8 rounded-lg grid place-items-center shrink-0',
          iconClass ?? 'bg-muted/50 text-muted-foreground'
        )}
        aria-hidden="true"
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn('text-sm font-bold tabular-nums truncate', valueClass)}>{value}</p>
      </div>
    </div>
  );
}

/** Chip streak hemat (penggunaan ringkas di rekap). */
export function StreakChip({ days }: { days: number }) {
  if (days <= 0) return null;
  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success dark:bg-success/15 dark:text-success/80 text-xs font-medium">
      <Flame className="h-3 w-3" aria-hidden="true" />
      {days} hari no-spend
    </div>
  );
}
