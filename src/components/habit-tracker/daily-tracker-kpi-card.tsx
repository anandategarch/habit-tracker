// ---------------------------------------------------------------------------
// KpiCard — small KPI stat card used in the daily summary row.
// Extracted from daily-tracker.tsx during SPLIT-PHASE3.
// ---------------------------------------------------------------------------

'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  staggerIndex = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  accent: 'green' | 'orange' | 'rose' | 'amber';
  staggerIndex?: number;
}) {
  const accents: Record<string, string> = {
    green: 'kpi-card-green',
    orange: 'kpi-card-orange',
    rose: 'kpi-card-rose',
    amber: 'kpi-card-amber',
  };
  const iconColors: Record<string, string> = {
    green: 'text-success',
    orange: 'text-orange-500',
    rose: 'text-rose-500',
    amber: 'text-warning',
  };
  return (
    <Card
      className={cn('group anim-stagger p-4', accents[accent])}
      style={{ animationDelay: `${staggerIndex * 60}ms` }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={cn('h-3.5 w-3.5', iconColors[accent])} />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="text-xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="text-[11px] mt-0.5 text-muted-foreground">{sub}</p>
    </Card>
  );
}
