'use client';

// ── UI Chips (ComparisonPill + AlertChip + StatTile) ──────────────────────
// Extracted from daily-recap.tsx during SPLIT-PHASE2-UI.

import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, Zap, Target,
  Activity, Calendar, Sparkles, Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyRecapAlert } from './daily-recap-types';

// ── Comparison Pill ──────────────────────────────────────────────────────

export function ComparisonPill({ changePct, direction, label }: { changePct: number | null; direction: string; label: string }) {
  if (changePct === null || direction === 'unknown') {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}: —</span>
      </div>
    );
  }
  const isUp = direction === 'up';
  const isSame = direction === 'same';
  // For expense, "down" is good (green), "up" is bad (red)
  const colorClass = isSame ? 'text-muted-foreground'
    : isUp ? 'text-destructive'
    : 'text-success';
  const Icon = isSame ? Minus : isUp ? TrendingUp : TrendingDown;
  return (
    <div className={cn('flex items-center gap-1 text-xs font-medium min-w-0', colorClass)}>
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{label} {Math.abs(changePct)}%</span>
    </div>
  );
}

// ── Alert Chip ───────────────────────────────────────────────────────────

export function AlertChip({ alert }: { alert: DailyRecapAlert }) {
  const severityClass =
    alert.severity === 'danger' ? 'bg-destructive/10 text-destructive border-destructive/30 dark:bg-destructive/15 dark:text-destructive/80 dark:border-destructive/30'
    : alert.severity === 'warning' ? 'bg-warning/10 text-warning border-warning/30 dark:bg-warning/15 dark:text-warning/80 dark:border-warning/30'
    : 'bg-primary/10 text-primary border-primary/20';
  const Icon = alert.type === 'late_night' ? Moon
    : alert.type === 'big_ticket' ? Zap
    : alert.type === 'over_budget' ? AlertTriangle
    : alert.type === 'nearing_budget' ? Target
    : alert.type === 'unusual_activity' ? Activity
    : alert.type === 'recurring' ? Calendar
    : Sparkles;
  return (
    <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border max-w-full', severityClass)}>
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate min-w-0">{alert.message}</span>
    </div>
  );
}

// ── Stat Tile ────────────────────────────────────────────────────────────

export function StatTile({
  label, value, icon: Icon, iconClass, valueClass,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  iconClass?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className={cn('flex items-center justify-center w-6 h-6 rounded-md shrink-0', iconClass ?? 'bg-muted/50 text-muted-foreground')}>
        <Icon className="h-3 w-3" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] sm:text-[11px] text-muted-foreground uppercase tracking-wide truncate">{label}</p>
        <p className={cn('text-xs sm:text-sm font-semibold truncate', valueClass)}>{value}</p>
      </div>
    </div>
  );
}
