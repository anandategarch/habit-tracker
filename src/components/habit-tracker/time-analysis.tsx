'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  Trophy,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
    onTargetCount: number;
    totalCount: number;
    onTargetRate: number;
    vsPrevious: number | null;
  };
}

type FilterType = 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'last30days';

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
    enabled: open && !!habitId,
    staleTime: 30_000,
  });
  const error = queryError instanceof Error ? queryError.message : null;

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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{data?.habit.icon || '⏱️'}</span>
            Analisis Waktu — {data?.habit.name || '...'}
          </DialogTitle>
        </DialogHeader>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={loading}
            className="h-8"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>

        {error && (
          <Card className="border-red-200 dark:border-red-900">
            <CardContent className="py-4">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </CardContent>
          </Card>
        )}

        {loading && !data && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-lg" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
          </div>
        )}

        {data && !error && (
          <div className="space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Average */}
              <Card className="py-3">
                <CardContent className="flex items-center gap-2.5 py-0">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 shrink-0">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold tabular-nums text-foreground">
                      {data.stats.average || '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Rata-rata</p>
                  </div>
                </CardContent>
              </Card>

              {/* Best */}
              <Card className="py-3">
                <CardContent className="flex items-center gap-2.5 py-0">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 shrink-0">
                    <Trophy className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {data.stats.best || '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Terbaik</p>
                  </div>
                </CardContent>
              </Card>

              {/* Worst */}
              <Card className="py-3">
                <CardContent className="flex items-center gap-2.5 py-0">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/40 shrink-0">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold tabular-nums text-red-500">
                      {data.stats.worst || '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Terlambat</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Target score + comparison */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="py-3">
                <CardContent className="flex items-center gap-2.5 py-0">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 shrink-0">
                    <Target className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    {targetMinutes !== null ? (
                      <>
                        <p className="text-lg font-bold tabular-nums">
                          {data.stats.onTargetCount}/{data.stats.totalCount}
                          <span className="text-sm font-normal text-muted-foreground ml-1">
                            ({data.stats.onTargetRate}%)
                          </span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Tepat target ({data.habit.targetTime})
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-bold tabular-nums">
                          {data.stats.totalCount}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Total tercatat
                        </p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="py-3">
                <CardContent className="flex items-center gap-2.5 py-0">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full shrink-0"
                    style={{
                      backgroundColor: (data.stats.vsPrevious ?? 0) <= 0
                        ? 'var(--color-emerald-100, #dcfce7)'
                        : 'var(--color-red-100, #fee2e2)',
                    }}
                  >
                    {(data.stats.vsPrevious ?? 0) <= 0 ? (
                      <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    {data.stats.vsPrevious !== null ? (
                      <>
                        <p
                          className={cn(
                            'text-lg font-bold tabular-nums',
                            data.stats.vsPrevious <= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-500',
                          )}
                        >
                          {data.stats.vsPrevious > 0 ? '+' : ''}
                          {data.stats.vsPrevious} menit
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          vs periode sebelumnya
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-bold tabular-nums text-muted-foreground">—</p>
                        <p className="text-[10px] text-muted-foreground">
                          Belum ada perbandingan
                        </p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bar Chart */}
            {chartData.length > 0 ? (
              <Card className="py-3">
                <CardHeader className="pb-2 pt-0 px-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {filter.startsWith('thisWeek') || filter.startsWith('lastWeek')
                      ? 'Per Hari'
                      : filter === 'thisMonth' || filter === 'lastMonth'
                        ? 'Per Hari'
                        : 'Per Hari'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-2">
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
                          tick={{ fontSize: 10 }}
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
                            stroke="#22c55e"
                            strokeDasharray="6 3"
                            strokeWidth={2}
                            label={{
                              value: `Target ${data.habit.targetTime}`,
                              position: 'insideTopRight',
                              fontSize: 10,
                              fill: '#22c55e',
                            }}
                          />
                        )}
                        <Bar
                          dataKey="time"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        >
                          {chartData.map((entry, idx) => {
                            let fill = '#22c55e'; // default green
                            if (targetMinutes !== null) {
                              if (entry.time > targetMinutes) {
                                fill = '#ef4444'; // red = late
                              } else if (entry.time <= targetMinutes) {
                                fill = '#22c55e'; // green = on target
                              }
                            }
                            return <Cell key={idx} fill={fill} fillOpacity={0.85} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-muted-foreground">
                    {targetMinutes !== null && (
                      <>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-sm bg-emerald-500/85 inline-block" />
                          Tepat waktu
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-sm bg-red-500/85 inline-block" />
                          Terlambat
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-1 h-0 border-t-2 border-dashed border-emerald-500 inline-block w-4" />
                          Target
                        </span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="py-10">
                <CardContent className="flex flex-col items-center gap-2">
                  <span className="text-3xl">📊</span>
                  <p className="text-sm text-muted-foreground">
                    Belum ada data waktu untuk periode ini.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Centang habit dengan track waktu untuk mulai mengumpulkan data.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}