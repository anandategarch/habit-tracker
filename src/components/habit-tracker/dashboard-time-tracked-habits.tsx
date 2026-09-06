// Extracted from dashboard.tsx in PHASE-A-2 — "Waktu Habit Minggu Ini" card.
// Self-contained: includes the empty-state guard + ScrollReveal wrapper so
// the parent can drop in a single <TimeTrackedHabits ... /> call.
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ArrowDownRight, ArrowUpRight, Clock, Minus } from 'lucide-react';
import { ScrollReveal } from '@/components/habit-tracker/scroll-reveal';
import { ChartInfo } from './dashboard-helpers';
import type { TimeTrackedSummary } from './dashboard-types';

export function TimeTrackedHabits({
  data,
  primaryColor,
}: {
  data: TimeTrackedSummary[];
  primaryColor: string;
}) {
  if (data.length === 0) return null;

  return (
    <ScrollReveal delay={200}>
      <section aria-label="Time analysis">
        <Card className="p-4">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold flex items-center gap-2">
                Waktu Habit Minggu Ini
                <ChartInfo text="Menampilkan jam penyelesaian habit yang memiliki tracking waktu. Rata-rata, on-target rate, dan tren dibanding minggu lalu." />
              </h3>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {data.map((th) => (
                <div
                  key={th.id}
                  className="rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{th.icon}</span>
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
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
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
                              backgroundColor: th.targetTime
                                ? (wt.minutes <= (parseInt(th.targetTime.split(':')[0]) * 60 + parseInt(th.targetTime.split(':')[1])) ? primaryColor : '#ef4444')
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
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </ScrollReveal>
  );
}
