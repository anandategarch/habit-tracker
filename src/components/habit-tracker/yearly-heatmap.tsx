'use client';

// ─────────────────────────────────────────────────────────────────────────────
// PHASE3-HABIT — Yearly Heatmap (GitHub-style 365-day grid)
// ─────────────────────────────────────────────────────────────────────────────
//
// Renders a single habit's last 365 days as a GitHub-contribution-style grid:
// 53 columns (weeks) × 7 rows (days of week). Each cell is a small square
// colored:
//   - green (primary) = completed
//   - red (destructive) = relapse (for "avoid" habits where checked = relapse)
//   - gray (muted)     = missed (habit existed but not done)
//   - white            = future or before habit startDate
//
// Tap a cell to see the date + completed/not in a popover-like tooltip below
// the grid. Month labels run across the top; day-of-week labels (S S R K J S M)
// run down the left side.
//
// Uses CSS grid (53 cols × 7 rows) — no recharts. Fetches logs from
// /api/habits/[id]/logs?year=YYYY (full-year endpoint added in PHASE3-HABIT).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subDays, addDays } from '@/lib/date-utils';
import { jakartaDateKey } from '@/lib/timezone';
import type { HabitLog } from './daily-tracker-types';

interface YearlyHeatmapProps {
  habitId: string;
  habitType: 'normal' | 'avoid' | 'amount';
  /** Habit's creation date (ISO string). Cells before this date are "future". */
  startDate: string;
}

// Day-of-week labels for the left axis (Mon-Sun, week starts Monday).
// Indonesian single-letter: S(minggu) S(senin) R(rabu) K(amis) J(umat) S(sabtu) M(inggu)
// We display only Mon/Wed/Fri to avoid clutter (GitHub-style).
const DOW_LABELS_MON = ['', 'S', '', 'R', '', 'J', '']; // index 0=Sun..6=Sat (we reorder to Mon-first below)
const MONTH_LABELS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

interface Cell {
  date: Date;
  dateStr: string;
  inYear: boolean;
  /** 'completed' | 'missed' | 'relapse' | 'future' */
  state: 'completed' | 'missed' | 'relapse' | 'future';
  /** True if this cell is today (for outline emphasis). */
  isToday: boolean;
}

/**
 * Build the 53×7 grid (Mon-first) for a given year. The first column starts
 * on the Monday on or before Jan 1 of the year. The last column ends on the
 * Sunday on or after Dec 31.
 *
 * Returns an array of 53 columns, each an array of 7 cells (Mon→Sun).
 *
 * BUG-PHASE3 BUG-1: for "avoid" habits, an in-range day with no relapse log
 * is a CLEAN day (success), not a "missed" day. The previous logic fell
 * through to 'missed' for any day without a relapse log, rendering avoid
 * heatmaps as a wall of gray with sparse red relapse dots — the opposite
 * of the intended "mostly green wall of clean days with red relapse dots".
 * The fix: when `isAvoid` is true, in-range non-relapse days are 'completed'
 * (green = "Bersih"), never 'missed'. The 'missed' state is meaningless for
 * avoid habits (there is no "didn't do it" — only "did the bad thing" or
 * "didn't do the bad thing").
 */
function buildYearGrid(
  year: number,
  completedDays: Set<string>,
  relapseDays: Set<string>,
  habitStartDate: string | null,
  todayStr: string,
  isAvoid: boolean,
): Cell[][] {
  const yearStart = new Date(year, 0, 1);
  // Find the Monday on or before Jan 1.
  const jan1Dow = yearStart.getDay(); // 0=Sun..6=Sat
  // Convert to Mon-first index: Mon=0, Tue=1, ..., Sun=6
  const monFirstDow = (jan1Dow + 6) % 7;
  const gridStart = subDays(yearStart, monFirstDow);

  // Find the Sunday on or after Dec 31.
  const yearEnd = new Date(year, 11, 31);
  const dec31Dow = yearEnd.getDay();
  const sunFirstDowFromEnd = (6 - dec31Dow); // days to add to reach Sunday
  const gridEnd = addDays(yearEnd, sunFirstDowFromEnd);

  const startDateYMD = habitStartDate ? habitStartDate.slice(0, 10) : null;

  // Walk from gridStart to gridEnd, building columns of 7 days each.
  const columns: Cell[][] = [];
  let cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const column: Cell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(cursor);
      const dateStr = format(date, 'yyyy-MM-dd');
      const inYear = date.getFullYear() === year;
      const isToday = dateStr === todayStr;

      let state: Cell['state'] = 'missed';
      if (!inYear) {
        // Outside the year window — show as "future" (white).
        state = 'future';
      } else if (startDateYMD && dateStr < startDateYMD) {
        // Before the habit existed — show as "future" (white).
        state = 'future';
      } else if (dateStr > todayStr) {
        // Future date — show as "future" (white).
        state = 'future';
      } else if (relapseDays.has(dateStr)) {
        state = 'relapse';
      } else if (isAvoid) {
        // BUG-PHASE3 BUG-1 fix: avoid habits have no "missed" state — any
        // in-range day without a relapse log is a clean day (green).
        state = 'completed';
      } else if (completedDays.has(dateStr)) {
        state = 'completed';
      } else {
        state = 'missed';
      }

      column.push({ date, dateStr, inYear, state, isToday });
      cursor = addDays(cursor, 1);
    }
    columns.push(column);
  }
  return columns;
}

export function YearlyHeatmap({ habitId, habitType, startDate }: YearlyHeatmapProps) {
  const [selected, setSelected] = useState<Cell | null>(null);
  const todayStr = useMemo(() => jakartaDateKey(new Date()), []);
  // Show the current year by default. Could add year navigation later.
  const year = new Date().getFullYear();

  const { data: rawLogs, isLoading } = useQuery<HabitLog[]>({
    queryKey: ['habit-year-logs', habitId, year.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/habits/${habitId}/logs?year=${year}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  // keepPreviousData is a GLOBAL QueryClient default — after a habit switch
  // (dialog stays mounted, habitId prop changes) the query briefly serves
  // the PREVIOUS habit's logs under the new key, painting habit A's heatmap
  // pattern for habit B. Each log carries habitId, so gate on it: a payload
  // containing another habit's logs is treated as "not loaded yet" (the
  // isLoading skeleton then covers the fetch window). An empty array is
  // date-key ambiguous but harmless (empty renders the same either way).
  const logs =
    rawLogs && rawLogs.some((l) => l.habitId !== habitId) ? undefined : rawLogs;

  const isAvoid = habitType === 'avoid';
  // For avoid habits, completed=true = relapse. For normal/amount,
  // completed=true = success.
  const completedDays = useMemo(() => {
    const set = new Set<string>();
    if (!logs) return set;
    for (const l of logs) {
      if (l.completed && !isAvoid) set.add(jakartaDateKey(new Date(l.date)));
    }
    return set;
  }, [logs, isAvoid]);

  const relapseDays = useMemo(() => {
    const set = new Set<string>();
    if (!logs) return set;
    for (const l of logs) {
      if (l.completed && isAvoid) set.add(jakartaDateKey(new Date(l.date)));
    }
    return set;
  }, [logs, isAvoid]);

  const grid = useMemo(
    () => buildYearGrid(year, completedDays, relapseDays, startDate, todayStr, isAvoid),
    [year, completedDays, relapseDays, startDate, todayStr, isAvoid],
  );

  // Compute summary stats.
  const summary = useMemo(() => {
    let completed = 0;
    let missed = 0;
    let relapse = 0;
    let totalActiveDays = 0;
    for (const col of grid) {
      for (const cell of col) {
        if (!cell.inYear || cell.state === 'future') continue;
        totalActiveDays++;
        if (cell.state === 'completed') completed++;
        else if (cell.state === 'relapse') relapse++;
        else if (cell.state === 'missed') missed++;
      }
    }
    return { completed, missed, relapse, totalActiveDays };
  }, [grid]);

  if (isLoading) {
    return (
      <Card className="py-3">
        <CardHeader className="pb-2 pt-0 px-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Tahun Ini
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <Skeleton className="h-32 w-full rounded-md" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="py-3">
      <CardHeader className="pb-2 pt-0 px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
          <span>Tahun Ini ({year})</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {isAvoid ? 'Bersih' : 'Selesai'}: <span className="text-success font-semibold">{summary.completed}</span>
            {isAvoid && (
              <>
                {' · '}
                Kambuh: <span className="text-destructive font-semibold">{summary.relapse}</span>
              </>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {/* Heatmap grid: 53 cols × 7 rows. */}
        <div className="overflow-x-auto pb-2 -mx-1 px-1">
          <div className="inline-flex flex-col gap-1 min-w-max">
            {/* Month labels row */}
            <div className="flex gap-[3px] pl-6 mb-0.5 text-[10px] text-muted-foreground tabular-nums">
              {MONTH_LABELS_ID.map((m, i) => (
                <span key={i} className="w-3">{m}</span>
              ))}
            </div>
            <div className="flex gap-[3px]">
              {/* Day-of-week labels column */}
              <div className="flex flex-col gap-[3px] mr-1 text-[10px] text-muted-foreground/70 w-4">
                {DOW_LABELS_MON.map((d, i) => (
                  <span key={i} className="h-3 leading-3">{d}</span>
                ))}
              </div>
              {/* Grid columns */}
              {grid.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-[3px]">
                  {col.map((cell, ri) => (
                    <button
                      key={ri}
                      type="button"
                      onClick={() => setSelected(cell)}
                      title={`${cell.dateStr} · ${
                        cell.state === 'completed'
                          ? 'Selesai'
                          : cell.state === 'relapse'
                            ? 'Kambuh'
                            : cell.state === 'missed'
                              ? 'Belum'
                              : '—'
                      }`}
                      className={cn(
                        'h-3 w-3 rounded-[2px] transition-all hover:ring-1 hover:ring-foreground/30',
                        cell.state === 'completed' && 'bg-primary',
                        cell.state === 'relapse' && 'bg-destructive',
                        cell.state === 'missed' && 'bg-muted-foreground/15 dark:bg-muted-foreground/20',
                        cell.state === 'future' && 'bg-transparent border border-border/40',
                        cell.isToday && 'ring-1 ring-foreground/60',
                        selected?.dateStr === cell.dateStr && 'ring-2 ring-foreground',
                      )}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-primary inline-block" />
              {isAvoid ? 'Bersih' : 'Selesai'}
            </span>
            {isAvoid && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-destructive inline-block" />
                Kambuh
              </span>
            )}
            {/* BUG-PHASE3 BUG-1: avoid habits have no "missed" state (any
                in-range day without a relapse log is clean). Hide the Belum
                swatch for avoid habits to avoid a misleading legend entry. */}
            {!isAvoid && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-muted-foreground/20 inline-block" />
                Belum
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-transparent border border-border/40 inline-block" />
              {/* Same YMD-slice convention as buildYearGrid's startDateYMD —
                  parseISO+format would re-read the browser's local TZ and
                  could flip this label one day early/late on non-Jakarta
                  browsers. */}
              {todayStr > startDate.slice(0, 10) ? 'Akan datang' : 'Sebelum mulai'}
            </span>
          </div>
        </div>

        {/* Selected day detail */}
        {selected && (
          <div className="mt-3 p-3 rounded-lg border bg-muted/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">
                  {format(selected.date, 'EEEE, d MMM yyyy', { locale: 'id' })}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {selected.state === 'completed' && (isAvoid ? '✓ Bersih — tidak ada kambuh' : '✓ Selesai')}
                  {selected.state === 'relapse' && '✗ Kambuh'}
                  {selected.state === 'missed' && '○ Belum dikerjakan'}
                  {selected.state === 'future' && '· Akan datang / sebelum mulai'}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
