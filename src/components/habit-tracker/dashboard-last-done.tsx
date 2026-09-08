// Extracted from dashboard.tsx in PHASE-A-2 — "Terakhir Dilakukan" card.
// Self-contained: includes the empty-state guard so the parent can drop in
// a single <LastDoneSummary data={...} /> call.
// PREMIUM UI v2 ("Rutina Aurora"): premium-card + chip-soft header +
// premium-list-item rows with soft tinted status chips (no harsh
// 100-level backgrounds; semantic red/amber/emerald stay as /10 tints).
// ONE-CLICK (Task 4-a): row click jumps to the tracker (today) so overdue
// habits can be completed right away; the BarChart3 icon-button calls
// openHabitFocus(id) → tracker tab + TimeAnalysisDialog for that habit.
'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, BarChart3, History } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { jakartaDateString } from '@/lib/jakarta-date';
import { ChartInfo } from './dashboard-helpers';
import type { LastDoneSummary } from './dashboard-types';

export function LastDoneSummaryCard({
  data,
}: {
  data: LastDoneSummary[];
}) {
  const openHabitFocus = useAppStore((s) => s.openHabitFocus);
  const openTrackerDate = useAppStore((s) => s.openTrackerDate);
  // Jakarta "today" — landing date for row clicks (go complete it now).
  const todayStr = jakartaDateString();

  if (data.length === 0) return null;

  return (
    <section aria-label="Last done habits">
      <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="chip-soft chip-soft-teal h-8 w-8" aria-hidden="true">
              <History className="h-4 w-4" />
            </span>
            <h3 className="premium-label flex items-center gap-2">
              Terakhir Dilakukan
              <ChartInfo text="Menampilkan habit yang di-track kapan terakhir kali dikerjakan. Diurutkan dari yang paling lama / paling urgent." />
            </h3>
            <Badge variant="secondary" className="ml-auto text-xs">
              {data.filter(l => l.overdue).length} overdue
            </Badge>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {data.map((item) => (
              <div
                key={item.id}
                className="group/row flex items-stretch gap-1.5"
              >
                {/* ONE-CLICK (4-a): row main click → tracker grid (today) —
                    especially useful for overdue habits. Overdue rows keep a
                    soft rose tint (child-wash pattern, not a bg-* on the
                    premium surface). */}
                <button
                  type="button"
                  onClick={() => openTrackerDate(todayStr)}
                  aria-label={`Buka tracker hari ini untuk habit ${item.name}`}
                  className={cn(
                    'relative flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-xl border p-3 text-left transition-colors active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                    item.overdue
                      ? 'border-rose-500/25 hover:border-rose-500/40 hover:bg-rose-500/5 dark:border-rose-400/20'
                      : 'border-border/70 hover:border-primary/30 hover:bg-muted/50'
                  )}
                >
                  {item.overdue && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent"
                    />
                  )}
                  <div className="relative flex items-center gap-2.5 min-w-0">
                    <span className="text-base shrink-0" aria-hidden="true">{item.icon}</span>
                    <div className="min-w-0">
                      <span className="text-sm font-medium truncate block">{item.name}</span>
                      {item.interval && (
                        <span className="text-xs text-muted-foreground">setiap {item.interval}</span>
                      )}
                    </div>
                  </div>
                  <div className="relative flex items-center gap-2 shrink-0 ml-2">
                    {item.completedAt && (
                      <span className="hidden sm:inline text-xs text-muted-foreground font-mono">{item.completedAt}</span>
                    )}
                    {item.daysAgo !== null ? (
                      <span className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-full',
                        item.overdue
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : item.daysAgo === 0
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : item.daysAgo <= 2
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-muted text-muted-foreground'
                      )}>
                        {item.daysAgo === 0 ? 'Hari ini' : `${item.daysAgo} hari lalu`}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Belum pernah</span>
                    )}
                    {item.overdue && (
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" aria-hidden="true" />
                    )}
                  </div>
                </button>
                {/* ONE-CLICK (4-a): icon-button → openHabitFocus(id) opens this
                    habit's TimeAnalysisDialog. Always visible (subtle) on
                    mobile, fades in on row hover on desktop. */}
                <button
                  type="button"
                  onClick={() => openHabitFocus(item.id)}
                  aria-label={`Lihat analisis waktu habit ${item.name}`}
                  className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center self-center rounded-xl text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus-visible:opacity-100"
                >
                  <BarChart3 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
      </div>
    </section>
  );
}
