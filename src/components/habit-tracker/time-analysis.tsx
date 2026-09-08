'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  Trophy,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
// PHASE3-HABIT — yearly heatmap (per-habit 365-day grid).
import { YearlyHeatmap } from '@/components/habit-tracker/yearly-heatmap';

// ── Types ──────────────────────────────────────────────────────────────────

interface DayData {
  date: string;
  label: string;
  time: string | null;
  minutesFromMidnight: number | null;
  diffFromTarget: number | null;
}

interface AnalysisData {
  habit: {
    id: string;
    name: string;
    icon: string;
    trackTime: boolean;
    targetTime: string | null;
  };
  filter: string;
  data: DayData[];
  stats: {
    average: string | null;
    best: string | null;
    worst: string | null;
    // BUG-29 fix: nullable when the habit has no targetTime (the API now
    // returns null instead of 0 in that case).
    onTargetCount: number | null;
    totalCount: number;
    onTargetRate: number | null;
    vsPrevious: number | null;
  };
}

// PHASE3-HABIT — added 'thisYear' for the yearly heatmap view. The yearly
// view bypasses the time-analysis API (which is trackTime-only) and instead
// renders the YearlyHeatmap component, which works for ALL habits.
type FilterType = 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'last30days' | 'thisYear';

interface TimeAnalysisDialogProps {
  habitId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FILTER_LABELS: Record<FilterType, string> = {
  thisWeek: 'Minggu Ini',
  lastWeek: 'Minggu Lalu',
  thisMonth: 'Bulan Ini',
  lastMonth: 'Bulan Lalu',
  last30days: '30 Hari Terakhir',
  thisYear: 'Tahun',
};

// ── Custom Tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  if (val == null) return null;
  const h = Math.floor(val / 60);
  const m = val % 60;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
      <p className="font-medium text-muted-foreground mb-1">{label}</p>
      <p className="font-semibold">
        <Clock className="inline h-3 w-3 mr-1" />
        {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}
      </p>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TimeAnalysisDialog({
  habitId,
  open,
  onOpenChange,
}: TimeAnalysisDialogProps) {
  const [filter, setFilter] = useState<FilterType>('thisWeek');
  // Task 4-c (auto-detect): set to true once the user picks a period from
  // the dropdown THIS dialog session — after that the auto-detected default
  // never overrides their explicit choice.
  const [filterLocked, setFilterLocked] = useState(false);
  // FIX-COLOR-P3: added destructiveColor so "late" bar fill follows the user's
  // theme (was hardcoded #ef4444).
  const primaryColor = useThemeColor('primary');
  const destructiveColor = useThemeColor('destructive');

  // PHASE3-HABIT + Task 4-c (auto-detect): fetch the habit metadata on EVERY
  // dialog open (previously only in yearly mode). Two reasons:
  //  1) auto-detect the default period — 'thisWeek' for trackTime habits,
  //     'thisYear' for the rest (the time-analysis API 400-errors with
  //     "This habit does not track time" for non-trackTime habits, while the
  //     yearly heatmap works for ALL habits);
  //  2) show the habit icon/name in the title before the analysis data
  //     arrives. The dialog is openable from ANYWHERE via
  //     openHabitFocus(habitId) (store primitive, 4-foundation), so it must
  //     never depend on the tracker's local state.
  const isYearlyView = filter === 'thisYear';
  const {
    data: habitMeta,
    isLoading: metaLoading,
    isError: metaIsError,
  } = useQuery<{
    id: string;
    name: string;
    icon: string;
    habitType: 'normal' | 'avoid' | 'amount';
    startDate: string;
    trackTime: boolean;
  }>({
    queryKey: ['habit-meta', habitId],
    queryFn: async () => {
      if (!habitId) return null as never;
      const res = await fetch(`/api/habits/${habitId}`);
      if (!res.ok) throw new Error('Failed to fetch habit');
      const json = await res.json();
      return {
        id: json.id,
        name: json.name,
        icon: json.icon,
        habitType: (json.habitType ?? 'normal') as 'normal' | 'avoid' | 'amount',
        startDate: json.startDate,
        trackTime: !!json.trackTime,
      };
    },
    enabled: open && !!habitId,
    staleTime: 60_000,
  });

  // Task 4-c (auto-detect): stable-callback + ref indirection (same intent
  // as daily-tracker.tsx ONE-CLICK-1, adapted for react-hooks/refs — the
  // callbacks below have empty dep arrays, so a single useRef(fn) at mount
  // is enough; NO render-phase ref writes):
  //  - applyAutoFilter: swap in the habit-appropriate default period once
  //    the meta arrives (unless the user already picked one).
  //  - resetFilterSession: unlock the auto-detect when a NEW dialog session
  //    starts (dialog reopened, or a different habit focused).
  const applyAutoFilter = useCallback((trackTime: boolean) => {
    setFilter(trackTime ? 'thisWeek' : 'thisYear');
  }, []);
  const applyAutoFilterRef = useRef(applyAutoFilter);

  const resetFilterSession = useCallback(() => {
    setFilterLocked(false);
  }, []);
  const resetFilterSessionRef = useRef(resetFilterSession);

  const lastSessionRef = useRef<string | null>(null);
  useEffect(() => {
    const sessionKey = open && habitId ? habitId : null;
    if (sessionKey !== lastSessionRef.current) {
      lastSessionRef.current = sessionKey;
      resetFilterSessionRef.current();
    }
    if (sessionKey && habitMeta && !filterLocked) {
      applyAutoFilterRef.current(habitMeta.trackTime);
    }
  }, [open, habitId, habitMeta, filterLocked]);

  const { data: data, isLoading: loading, error: queryError, refetch } = useQuery<AnalysisData>({
    queryKey: ['time-analysis', habitId, filter],
    queryFn: async () => {
      const res = await fetch(`/api/habits/${habitId}/time-analysis?filter=${filter}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load analysis');
      }
      return res.json();
    },
    // PHASE3-HABIT + Task 4-c: skip the time-analysis query when in yearly
    // view, AND until we KNOW the habit tracks time (habitMeta.trackTime ===
    // true). The API 400-errors for non-trackTime habits; gating on the meta
    // means the red error card can never flash before the auto-detect lands.
    enabled: open && !!habitId && !isYearlyView && habitMeta?.trackTime === true,
    staleTime: 30_000,
  });
  const error = queryError instanceof Error ? queryError.message : null;

  // Meta fetch failed → surface it like a query error (the dialog would
  // otherwise sit silently with nothing to show).
  const effectiveError =
    error ?? (metaIsError ? 'Gagal memuat data habit' : null);

  // While the meta is still resolving we don't know which view applies yet —
  // show the loading skeleton instead of a possibly-wrong default view.
  const metaPending = open && !!habitId && habitMeta === undefined && !metaIsError;

  // Prepare chart data — only days with time data
  const chartData = (data?.data || [])
    .filter((d) => d.minutesFromMidnight !== null)
    .map((d) => ({
      label: d.label,
      date: d.date,
      time: d.minutesFromMidnight!,
      timeStr: d.time!,
      diff: d.diffFromTarget,
    }));

  const targetMinutes = data?.habit.targetTime
    ? (() => {
        const [h, m] = data.habit.targetTime.split(':').map(Number);
        return h * 60 + m;
      })()
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{data?.habit.icon || habitMeta?.icon || '⏱️'}</span>
            Analisis Waktu — {data?.habit.name || habitMeta?.name || '...'}
          </DialogTitle>
        </DialogHeader>

        {/* Filter — Task 4-c: picking a period locks it (auto-detect stops
            overriding the user's choice for this session). */}
        <div className="flex items-center gap-2">
          <Select
            value={filter}
            onValueChange={(v) => {
              setFilterLocked(true);
              setFilter(v as FilterType);
            }}
          >
            <SelectTrigger className="w-[180px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(FILTER_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isYearlyView && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={loading}
              className="h-8"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          )}
        </div>

        {/* PHASE3-HABIT — Yearly heatmap view (works for ALL habits). */}
        {isYearlyView && !effectiveError && habitId && habitMeta && (
          <YearlyHeatmap
            habitId={habitId}
            habitType={habitMeta.habitType}
            startDate={habitMeta.startDate}
          />
        )}
        {isYearlyView && !habitMeta && (
          <Skeleton className="h-40 w-full rounded-lg" />
        )}

        {!isYearlyView && effectiveError && (
          <div className="premium-card rounded-2xl p-4 flex items-start gap-2.5">
            <span className="chip-soft chip-soft-rose h-8 w-8 shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <p className="text-sm text-destructive dark:text-destructive/80 pt-1.5">
              {effectiveError}
            </p>
          </div>
        )}

        {!isYearlyView && !effectiveError && (loading || metaPending) && !data && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-lg" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
          </div>
        )}

        {!isYearlyView && data && !effectiveError && (
          <div className="space-y-4">
            {/* Stats Grid — PREMIUM REDESIGN (Task 4-c): bare div +
                premium-card (NOT shadcn Card, see worklog 2-c), chip-soft
                icon chip + premium-label + premium-stat, following the
                daily-tracker KPI card pattern. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Average */}
              <div className="premium-card premium-card-sheen rounded-xl p-3.5">
                <div className="flex items-center gap-2">
                  <span className="chip-soft chip-soft-teal h-8 w-8 shrink-0">
                    <Clock className="h-4 w-4" />
                  </span>
                  <span className="premium-label truncate">Rata-rata</span>
                </div>
                <p className="premium-stat text-xl mt-3 tabular-nums text-foreground">
                  {data.stats.average || '—'}
                </p>
              </div>

              {/* Best */}
              <div className="premium-card premium-card-sheen rounded-xl p-3.5">
                <div className="flex items-center gap-2">
                  <span className="chip-soft chip-soft-amber h-8 w-8 shrink-0">
                    <Trophy className="h-4 w-4" />
                  </span>
                  <span className="premium-label truncate">Terbaik</span>
                </div>
                <p className="premium-stat text-xl mt-3 tabular-nums text-foreground">
                  {data.stats.best || '—'}
                </p>
              </div>

              {/* Worst */}
              <div className="premium-card premium-card-sheen rounded-xl p-3.5">
                <div className="flex items-center gap-2">
                  <span className="chip-soft chip-soft-rose h-8 w-8 shrink-0">
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                  <span className="premium-label truncate">Terlambat</span>
                </div>
                <p className="premium-stat text-xl mt-3 tabular-nums text-foreground">
                  {data.stats.worst || '—'}
                </p>
              </div>
            </div>

            {/* Target score + comparison */}
            <div className="grid grid-cols-2 gap-3">
              <div className="premium-card premium-card-sheen rounded-xl p-3.5">
                <div className="flex items-center gap-2">
                  <span className="chip-soft chip-soft-violet h-8 w-8 shrink-0">
                    <Target className="h-4 w-4" />
                  </span>
                  <span className="premium-label truncate">
                    {targetMinutes !== null ? 'Tepat Target' : 'Total Tercatat'}
                  </span>
                </div>
                {targetMinutes !== null ? (
                  <>
                    <p className="premium-stat text-xl mt-3 tabular-nums text-foreground">
                      {data.stats.onTargetCount ?? 0}/{data.stats.totalCount}
                      <span className="text-sm font-normal text-muted-foreground ml-1">
                        ({data.stats.onTargetRate ?? 0}%)
                      </span>
                    </p>
                    <p className="text-[11px] mt-1 text-muted-foreground">
                      Target {data.habit.targetTime}
                    </p>
                  </>
                ) : (
                  <p className="premium-stat text-xl mt-3 tabular-nums text-foreground">
                    {data.stats.totalCount}
                  </p>
                )}
              </div>

              <div className="premium-card premium-card-sheen rounded-xl p-3.5">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'h-8 w-8 shrink-0',
                      (data.stats.vsPrevious ?? 0) <= 0
                        ? 'chip-soft chip-soft-teal'
                        : 'chip-soft chip-soft-rose'
                    )}
                  >
                    {(data.stats.vsPrevious ?? 0) <= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                  </span>
                  <span className="premium-label truncate">vs Sebelumnya</span>
                </div>
                {data.stats.vsPrevious !== null ? (
                  <>
                    <p
                      className={cn(
                        'premium-stat text-xl mt-3 tabular-nums',
                        data.stats.vsPrevious <= 0
                          ? 'text-success dark:text-success/80'
                          : 'text-destructive'
                      )}
                    >
                      {data.stats.vsPrevious > 0 ? '+' : ''}
                      {data.stats.vsPrevious} menit
                    </p>
                    <p className="text-[11px] mt-1 text-muted-foreground">
                      Periode sebelumnya
                    </p>
                  </>
                ) : (
                  <p className="premium-stat text-xl mt-3 tabular-nums text-muted-foreground">
                    —
                  </p>
                )}
              </div>
            </div>

            {/* Bar Chart */}
            {chartData.length > 0 ? (
              <div className="premium-card premium-card-sheen rounded-2xl py-3">
                <div className="px-4 pb-2">
                  <p className="premium-label">Per Hari</p>
                </div>
                <div className="px-2">
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          domain={[0, 1440]}
                          tickFormatter={(v: number) => {
                            const h = Math.floor(v / 60);
                            const m = v % 60;
                            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                          }}
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          width={45}
                        />
                        <RechartsTooltip
                          content={<ChartTooltip />}
                        />
                        {targetMinutes !== null && (
                          <ReferenceLine
                            y={targetMinutes}
                            stroke={primaryColor}
                            strokeDasharray="6 3"
                            strokeWidth={2}
                            label={{
                              value: `Target ${data.habit.targetTime}`,
                              position: 'insideTopRight',
                              fontSize: 11,
                              fill: primaryColor,
                            }}
                          />
                        )}
                        <Bar
                          dataKey="time"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        >
                          {chartData.map((entry, idx) => {
                            let fill = primaryColor; // default = primary
                            if (targetMinutes !== null) {
                              if (entry.time > targetMinutes) {
                                // FIX-COLOR-P3: was hardcoded '#ef4444' — now
                                // uses destructiveColor so the "late" fill
                                // follows the user's theme.
                                fill = destructiveColor; // destructive = late
                              } else if (entry.time <= targetMinutes) {
                                fill = primaryColor; // primary = on target
                              }
                            }
                            return <Cell key={idx} fill={fill} fillOpacity={0.85} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
                    {targetMinutes !== null && (
                      <>
                        {/* BUG-22 fix: legend swatches must match the actual
                            bar fills. The bar uses `primaryColor` for on-target
                            and `destructiveColor` (from useThemeColor) for late,
                            but the legend previously used `bg-emerald-500/85`
                            for on-target (mismatch when primary is not green).
                            FIX-COLOR-P3: late fill is now `destructiveColor`
                            (was hardcoded `#ef4444`); legend uses
                            `bg-destructive/85` so both adapt to the theme. */}
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-sm bg-primary inline-block" />
                          Tepat waktu
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-sm bg-destructive/85 inline-block" />
                          Terlambat
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-4 h-0 border-t-2 border-dashed border-primary inline-block" />
                          Target
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* PREMIUM REDESIGN (Task 4-c): premium-empty + orb instead of
                 the bare 📊 emoji card. */
              <div className="premium-card premium-empty rounded-2xl">
                <div className="premium-empty-orb" aria-hidden="true">
                  <BarChart3 className="h-8 w-8 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Belum ada data untuk periode ini
                </p>
                <p className="text-xs text-muted-foreground/70 -mt-0.5">
                  Centang habit dengan track waktu untuk mulai mengumpulkan data.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Task 4-c (auto-detect fallback): the user explicitly picked a
            non-yearly period for a habit that does not track time (the API
            400-errors there). Show a soft premium-empty hint instead of the
            old red error card. The pre-auto-detect transient frame is
            covered by the metaPending skeleton above, so this branch only
            renders for an explicit, filterLocked choice. */}
        {!isYearlyView && !data && !effectiveError && !loading && !metaPending && habitMeta && !habitMeta.trackTime && filterLocked && (
          <div className="premium-card premium-empty rounded-2xl">
            <div className="premium-empty-orb" aria-hidden="true">
              <Clock className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Habit ini tidak mencatat waktu
            </p>
            <p className="text-xs text-muted-foreground/70 -mt-0.5">
              Pilih periode{' '}
              <span className="font-semibold text-foreground">Tahun</span> untuk
              melihat riwayat lengkap habit ini.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
