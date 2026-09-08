// Extracted from dashboard.tsx in PHASE-A-2 — "Waktu Habit Minggu Ini" card.
// Self-contained: includes the empty-state guard + ScrollReveal wrapper so
// the parent can drop in a single <TimeTrackedHabits ... /> call.
// PREMIUM UI v2 ("Rutina Aurora"): premium-card + chip-soft header +
// premium-list-item rows; mini-bar colors use design tokens
// (var(--destructive) instead of hardcoded #ef4444, primaryColor for
// on-target bars).
// ONE-CLICK (Task 4-a): whole row click → openHabitFocus(id) opens that
// habit's TimeAnalysisDialog on the tracker tab.
'use client';

import { cn } from '@/lib/utils';
import { ArrowDownRight, ArrowUpRight, BarChart3, Clock, Minus } from 'lucide-react';
import { ScrollReveal } from '@/components/habit-tracker/scroll-reveal';
import { useAppStore } from '@/store/app-store';
import { ChartInfo } from './dashboard-helpers';
import type { TimeTrackedSummary } from './dashboard-types';

export function TimeTrackedHabits({
  data,
  primaryColor,
}: {
  data: TimeTrackedSummary[];
  primaryColor: string;
}) {
  const openHabitFocus = useAppStore((s) => s.openHabitFocus);

  if (data.length === 0) return null;

  return (
    <ScrollReveal delay={200}>
      <section aria-label="Time analysis">
        <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="chip-soft chip-soft-violet h-8 w-8" aria-hidden="true">
                <Clock className="h-4 w-4" />
              </span>
              <h3 className="premium-label flex items-center gap-2">
                Waktu Habit Minggu Ini
                <ChartInfo text="Menampilkan jam penyelesaian habit yang memiliki tracking waktu. Rata-rata, on-target rate, dan tren dibanding minggu lalu." />
              </h3>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {data.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => openHabitFocus(th.id)}
                  aria-label={`Lihat analisis waktu habit ${th.name}`}
                  className="group block w-full cursor-pointer rounded-xl border border-border/70 p-3 text-left transition-colors hover:border-primary/30 hover:bg-muted/50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0" aria-hidden="true">{th.icon}</span>
                      <span className="text-sm font-medium truncate">{th.name}</span>
                      {th.targetTime && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                          target {th.targetTime}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {/* Today's time */}
                      {th.todayDone && th.todayTime && (
                        <span className={cn(
                          'text-xs font-mono font-semibold px-2 py-0.5 rounded',
                          th.targetTime && th.todayTime <= th.targetTime
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        )}>
                          {th.todayTime}
                        </span>
                      )}
                      {!th.todayDone && (
                        <span className="text-xs text-muted-foreground">Belum</span>
                      )}
                      {/* Trend */}
                      {th.trend !== null && (
                        <span className={cn(
                          'text-xs font-medium flex items-center gap-0.5',
                          th.trend < 0 ? 'text-emerald-600 dark:text-emerald-400' : th.trend > 0 ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'
                        )}>
                          {th.trend < 0 ? <ArrowDownRight className="h-3 w-3" /> : th.trend > 0 ? <ArrowUpRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                          {th.trend === 0 ? 'sama' : `${Math.abs(th.trend)}mnt`}
                        </span>
                      )}
                      {/* ONE-CLICK (4-a) affordance — subtle hint that the row
                          opens the time analysis dialog. */}
                      <BarChart3
                        className="h-3.5 w-3.5 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100 group-hover:text-primary"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                  {/* Mini bar: 7-day times */}
                  <div className="flex items-end gap-1 h-10">
                    {th.weekTimes.map((wt, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        {wt.minutes !== null ? (
                          <div
                            className="w-full rounded-sm transition-all"
                            style={{
                              height: `${Math.max(4, (wt.minutes / 1440) * 100)}%`,
                              minHeight: '4px',
                              // PREMIUM UI v2: token-based colors — primary for
                              // on-target days, var(--destructive) for over-target
                              // (previously hardcoded #ef4444).
                              backgroundColor: th.targetTime
                                ? (wt.minutes <= (parseInt(th.targetTime.split(':')[0]) * 60 + parseInt(th.targetTime.split(':')[1])) ? primaryColor : 'var(--destructive)')
                                : primaryColor,
                              opacity: wt.minutes !== null ? 1 : 0.2,
                            }}
                            title={`${wt.day}: ${wt.time}`}
                          />
                        ) : (
                          <div className="w-full rounded-sm bg-muted h-1" title={`${wt.day}: -`} />
                        )}
                        <span className="text-[11px] text-muted-foreground leading-none">{wt.day.slice(0, 2)}</span>
                      </div>
                    ))}
                  </div>
                  {/* Stats row */}
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 mt-2 text-xs text-muted-foreground">
                    <span>Rata-rata: <strong className="text-foreground">{th.weekAvg || '-'}</strong></span>
                    {th.targetTime && (
                      <span>On-target: <strong className={th.weekOnTargetRate >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>{th.weekOnTargetRate}%</strong> ({th.weekOnTarget}/{th.weekTotal})</span>
                    )}
                    {th.prevAvg && (
                      <span className="hidden sm:inline">Minggu lalu: {th.prevAvg}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
        </div>
      </section>
    </ScrollReveal>
  );
}
