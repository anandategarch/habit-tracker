'use client';

// components/habit-tracker/daily-recap-hourly-heatmap.tsx — distribusi jam
// pengeluaran hari ini (24 sel, 2 baris × 12, intensitas teal). Tooltip
// native title per sel (aksesibilitas sederhana tanpa JS tambahan).

import { useMemo } from 'react';
import { formatRupiah } from './finance-types';
import type { HourlyStat } from './daily-recap-types';
import { cn } from '@/lib/utils';

function level(total: number, max: number): string {
  if (total <= 0) return 'bg-muted/50 dark:bg-muted/30';
  const ratio = max > 0 ? total / max : 0;
  if (ratio < 0.25) return 'bg-teal-200/70 dark:bg-teal-900/50';
  if (ratio < 0.5) return 'bg-teal-300/80 dark:bg-teal-800/60';
  if (ratio < 0.75) return 'bg-teal-400/90 dark:bg-teal-700/70';
  return 'bg-teal-600 dark:bg-teal-500';
}

export function HourlyHeatmap({ hourly }: { hourly: HourlyStat[] }) {
  const cells = useMemo(() => {
    const map = new Map<number, HourlyStat>();
    for (const h of hourly) map.set(h.hour, h);
    return Array.from({ length: 24 }, (_, hour) => map.get(hour) ?? { hour, total: 0, count: 0 });
  }, [hourly]);

  const max = cells.reduce((m, c) => Math.max(m, c.total), 0);
  const activeCount = cells.filter(c => c.count > 0).length;
  const peak = cells.reduce((m, c) => (c.total > m.total ? c : m), { hour: -1, total: 0, count: 0 });

  if (activeCount === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          Distribusi Jam
        </h4>
        {peak.hour >= 0 && (
          <p className="text-[11px] text-muted-foreground">
            Puncak {String(peak.hour).padStart(2, '0')}.00 · {formatRupiah(peak.total)}
          </p>
        )}
      </div>
      <div className="grid grid-cols-12 gap-1">
        {cells.map(c => {
          const title = c.count > 0
            ? `${String(c.hour).padStart(2, '0')}.00 — ${formatRupiah(c.total)} (${c.count}×)`
            : `${String(c.hour).padStart(2, '0')}.00 — kosong`;
          return (
            <span
              key={c.hour}
              title={title}
              className={cn(
                'h-5 rounded-md transition-transform',
                level(c.total, max),
                c.count > 0 && 'hover:scale-105'
              )}
              aria-hidden="true"
            />
          );
        })}
      </div>
      <p className="sr-only">
        Distribusi pengeluaran per jam hari ini; jam puncak {String(Math.max(peak.hour, 0)).padStart(2, '0')}.00.
      </p>
    </div>
  );
}
