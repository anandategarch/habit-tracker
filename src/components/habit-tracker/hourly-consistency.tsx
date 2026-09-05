'use client';

// ─────────────────────────────────────────────────────────────────────────────
// PHASE3-HABIT — Hourly Consistency Heatmap ("Kapan paling konsisten?")
// ─────────────────────────────────────────────────────────────────────────────
//
// Shows which hours of the day the user most consistently completes habits.
// Renders a 24-cell horizontal heatmap (one cell per hour, 0-23, Jakarta TZ).
// Cell color intensity = completion rate (count / max count across all hours).
//
// Cells are grouped into 4 time-of-day bands with Indonesian labels:
//   Pagi   (05-11) — orange/yellow
//   Siang  (12-14) — primary
//   Sore   (15-18) — emerald
//   Malam  (19-04) — violet
//
// Uses CSS grid + Tailwind only (no recharts). Fetches data from
// /api/analytics/hourly-consistency?period=30 (added in PHASE3-HABIT).
//
// The component is self-contained and can be embedded in the Dashboard or
// the Time Analysis dialog. We expose both a default export (with its own
// card chrome) and the bare `HourlyHeatmap` for inline use.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sunrise, Sun, Sunset, Moon } from 'lucide-react';

interface HourBucket {
  hour: number;
  count: number;
  rate: number; // 0-100, count / maxCount * 100
}

interface HourlyConsistencyData {
  hours: HourBucket[];
  totalCompletions: number;
  peakHour: number | null;
  periodDays: number;
  periodStart: string;
  periodEnd: string;
}

type TimeBand = 'pagi' | 'siang' | 'sore' | 'malam';

const BAND_META: Record<TimeBand, { label: string; icon: typeof Sunrise; bar: string; bg: string }> = {
  pagi: { label: 'Pagi', icon: Sunrise, bar: 'bg-amber-400 dark:bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/20' },
  siang: { label: 'Siang', icon: Sun, bar: 'bg-primary', bg: 'bg-primary/10' },
  sore: { label: 'Sore', icon: Sunset, bar: 'bg-emerald-500 dark:bg-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
  malam: { label: 'Malam', icon: Moon, bar: 'bg-violet-500 dark:bg-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/20' },
};

function hourToBand(hour: number): TimeBand {
  if (hour >= 5 && hour <= 11) return 'pagi';
  if (hour >= 12 && hour <= 14) return 'siang';
  if (hour >= 15 && hour <= 18) return 'sore';
  return 'malam';
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

interface HourlyConsistencyProps {
  /** Number of days to look back. Default 30. */
  periodDays?: number;
  /** Compact mode: hides the per-band summary cards. */
  compact?: boolean;
}

export function HourlyConsistency({ periodDays = 30, compact = false }: HourlyConsistencyProps) {
  const [selected, setSelected] = useState<HourBucket | null>(null);

  const { data, isLoading } = useQuery<HourlyConsistencyData>({
    queryKey: ['hourly-consistency', periodDays],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/hourly-consistency?period=${periodDays}`);
      if (!res.ok) throw new Error('Failed to fetch hourly consistency');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Compute per-band totals.
  const bandStats = useMemo(() => {
    if (!data) return null;
    const stats: Record<TimeBand, { count: number; maxHour: number | null; maxCount: number }> = {
      pagi: { count: 0, maxHour: null, maxCount: 0 },
      siang: { count: 0, maxHour: null, maxCount: 0 },
      sore: { count: 0, maxHour: null, maxCount: 0 },
      malam: { count: 0, maxHour: null, maxCount: 0 },
    };
    for (const h of data.hours) {
      const band = hourToBand(h.hour);
      stats[band].count += h.count;
      if (h.count > stats[band].maxCount) {
        stats[band].maxCount = h.count;
        stats[band].maxHour = h.hour;
      }
    }
    return stats;
  }, [data]);

  if (isLoading) {
    return (
      <Card className="py-3">
        <CardHeader className="pb-2 pt-0 px-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Kapan Paling Konsisten?
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <Skeleton className="h-24 w-full rounded-md" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalCompletions === 0) {
    return (
      <Card className="py-6">
        <CardContent className="flex flex-col items-center gap-2 py-0">
          <span className="text-3xl">📊</span>
          <p className="text-sm text-muted-foreground">
            Belum ada data waktu untuk periode ini.
          </p>
          <p className="text-xs text-muted-foreground text-center">
            Centang habit dengan track waktu untuk mulai mengumpulkan data
            jam penyelesaian.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="py-3">
      <CardHeader className="pb-2 pt-0 px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
          <span>Kapan Paling Konsisten?</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {data.totalCompletions} selesai · {data.periodDays} hari
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 space-y-3">
        {/* 24-cell heatmap. Each cell is colored by its band + intensity
            based on rate. Cells are clickable to see the hour detail. */}
        <div className="flex items-end gap-[2px] h-20">
          {data.hours.map((h) => {
            const band = hourToBand(h.hour);
            const meta = BAND_META[band];
            const intensity = h.rate / 100; // 0-1
            // For zero-count cells, render a faint background bar.
            const isPeak = data.peakHour === h.hour;
            return (
              <button
                key={h.hour}
                type="button"
                onClick={() => setSelected(h)}
                title={`${formatHour(h.hour)} · ${h.count}x selesai`}
                className={cn(
                  'flex-1 min-w-[6px] rounded-t-[3px] transition-all hover:opacity-80 cursor-pointer relative',
                  h.count === 0 ? 'bg-muted/30 dark:bg-muted/40' : meta.bar,
                )}
                style={{
                  height: h.count === 0 ? '4px' : `${Math.max(8, intensity * 100)}%`,
                  opacity: h.count === 0 ? 1 : Math.max(0.35, intensity),
                }}
              >
                {isPeak && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-500 ring-2 ring-background" />
                )}
              </button>
            );
          })}
        </div>
        {/* Hour axis labels (every 3 hours) */}
        <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
          {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
            <span key={h}>{String(h).padStart(2, '0')}</span>
          ))}
          <span>23</span>
        </div>

        {/* Per-band summary cards (hidden in compact mode) */}
        {!compact && bandStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {(Object.keys(BAND_META) as TimeBand[]).map((band) => {
              const meta = BAND_META[band];
              const stat = bandStats[band];
              const Icon = meta.icon;
              const total = data.totalCompletions;
              const pct = total > 0 ? Math.round((stat.count / total) * 100) : 0;
              return (
                <div key={band} className={cn('rounded-lg p-2.5', meta.bg)}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-base font-bold tabular-nums">{stat.count}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    {pct}% · puncak {stat.maxHour !== null ? formatHour(stat.maxHour) : '—'}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Selected hour detail */}
        {selected && (
          <div className="p-3 rounded-lg border bg-muted/40 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold">{formatHour(selected.hour)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {selected.count}x selesai · {selected.rate}% dari puncak
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              tutup
            </button>
          </div>
        )}

        {data.peakHour !== null && (
          <p className="text-[11px] text-muted-foreground text-center pt-1">
            🔥 Paling konsisten jam{' '}
            <span className="font-semibold text-foreground">{formatHour(data.peakHour)}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default HourlyConsistency;
