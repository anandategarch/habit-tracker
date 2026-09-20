'use client';

// components/habit-tracker/calendar-legend.tsx — legenda heatmap + penanda
// "Hari Ini" & mood tercatat. Dipecah dari calendar-view.tsx (Task 71-j).

import { MOOD_EMOJIS } from '@/lib/mood';
import { HEATMAP_LEGEND } from './calendar-helpers';

export function CalendarLegend() {
  return (
    <section className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5">
      <h3 className="premium-label mb-3">Legenda Heatmap</h3>
      <div className="flex flex-wrap items-center gap-3">
        {HEATMAP_LEGEND.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div
              className={`h-6 w-6 rounded ${item.color} border border-border/50`}
              aria-hidden="true"
            />
            <span className="text-xs text-muted-foreground">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div
            className="h-6 w-6 rounded ring-2 ring-primary ring-offset-1 bg-primary/10"
            aria-hidden="true"
          />
          <span className="text-xs text-muted-foreground">Hari Ini</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm" aria-hidden="true">
            {MOOD_EMOJIS[3]}
          </span>
          <span className="text-xs text-muted-foreground">
            Mood tercatat
          </span>
        </div>
      </div>
    </section>
  );
}
