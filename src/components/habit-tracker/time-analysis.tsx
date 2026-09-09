'use client';

// components/habit-tracker/time-analysis.tsx — dialog analisis waktu habit.
//
// Data: GET /api/habits/[id] (meta habit) + GET /api/habits/[id]/
// time-analysis?period=… (kontrak API). Guard:
//  - habit non-trackTime → premium-empty "Habit ini tidak mencatat waktu".
//  - anti stale keepPreviousData (pola worklog 6-c): hasil digate pada
//    habitId yang cocok di payload — saat dialog pindah habit, skeleton/
//    loading frame bekerja kembali, bukan menyajikan data habit lama.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock,
  RefreshCw,
  TimerOff,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Habit } from './daily-tracker-types';
import { dateFromYMD } from '@/lib/timezone';
import { eeeIdFormatter, mmmDdIdFormatter } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

export type TimeAnalysisPeriod = 'thisWeek' | 'lastWeek' | 'thisMonth' | 'thisYear';

const PERIOD_OPTIONS: { value: TimeAnalysisPeriod; label: string }[] = [
  { value: 'thisWeek', label: 'Minggu Ini' },
  { value: 'lastWeek', label: 'Minggu Lalu' },
  { value: 'thisMonth', label: 'Bulan Ini' },
  { value: 'thisYear', label: 'Tahun' },
];

interface TimeAnalysisStats {
  totalMinutes: number;
  avgMinutes: number;
  count: number;
  vsPrevious: number;
}

interface TimeAnalysisByDay {
  date: string; // 'yyyy-MM-dd'
  minutes: number;
  count: number;
}

interface TimeAnalysisData {
  habit: { id: string; name: string; emoji: string; trackTime: boolean };
  stats: TimeAnalysisStats;
  byDay: TimeAnalysisByDay[];
}

interface TimeAnalysisDialogProps {
  habitId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatMinutes(m: number): string {
  const mm = Math.max(0, Math.round(m));
  if (mm < 60) return `${mm} mnt`;
  const h = Math.floor(mm / 60);
  const r = mm % 60;
  return r > 0 ? `${h}j ${r}m` : `${h} jam`;
}

function formatPct(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const r = Math.round(v);
  return `${r > 0 ? '+' : ''}${r}%`;
}

export default function TimeAnalysisDialog({
  habitId,
  open,
  onOpenChange,
}: TimeAnalysisDialogProps) {
  const [period, setPeriod] = useState<TimeAnalysisPeriod>('thisWeek');
  const metaEnabled = !!habitId && open;

  // ── Meta habit (gate id — anti stale saat habit berganti) ──
  const {
    data: rawMeta,
    isLoading: metaLoading,
    isError: metaError,
    refetch: refetchMeta,
  } = useQuery<Habit>({
    queryKey: ['habit-meta', habitId],
    queryFn: async () => {
      const res = await fetch(`/api/habits/${habitId}`);
      if (!res.ok) throw new Error('Gagal memuat data habit');
      return res.json();
    },
    enabled: metaEnabled,
    staleTime: 30_000,
    retry: 1,
  });
  const habitMeta = rawMeta && habitId && rawMeta.id === habitId ? rawMeta : null;
  const trackTime = habitMeta?.trackTime === true;

  // ── Analisis waktu (hanya bila habit mencatat waktu) ──
  const {
    data: rawData,
    isLoading: analysisLoading,
    isError: analysisError,
    refetch: refetchAnalysis,
  } = useQuery<TimeAnalysisData>({
    queryKey: ['time-analysis', habitId, period],
    queryFn: async () => {
      const res = await fetch(
        `/api/habits/${habitId}/time-analysis?period=${period}`,
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? 'Gagal memuat analisis waktu');
      }
      return res.json();
    },
    enabled: metaEnabled && trackTime,
    staleTime: 30_000,
    retry: 1,
  });
  // Gate id payload — data habit lama tidak lolos saat habit berganti.
  const data = rawData && habitId && rawData.habit?.id === habitId ? rawData : null;

  const byDay = data?.byDay ?? [];
  const chartData = byDay.map((d) => {
    const day = dateFromYMD(d.date);
    const label =
      byDay.length <= 8 ? eeeIdFormatter(day) : mmmDdIdFormatter(day);
    return { label, minutes: Math.max(0, Math.round(d.minutes)) };
  });
  const bestDay = byDay.reduce<TimeAnalysisByDay | null>(
    (best, d) => (!best || d.minutes > best.minutes ? d : best),
    null,
  );
  const hasData = byDay.some((d) => d.minutes > 0);
  const vs = data?.stats.vsPrevious ?? 0;
  const vsUp = Number.isFinite(vs) && vs > 0;

  const minutesTotal = data?.stats.totalMinutes ?? 0;
  const avg = data?.stats.avgMinutes ?? 0;
  const count = data?.stats.count ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span aria-hidden="true">{habitMeta?.emoji ?? '📊'}</span>
            <span className="truncate">
              {habitMeta?.name ?? 'Analisis Waktu'}
            </span>
          </DialogTitle>
          <DialogDescription>
            Analisis waktu pelaksanaan habit per periode.
          </DialogDescription>
        </DialogHeader>

        {/* Filter periode */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
          <span className="premium-label">Periode</span>
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as TimeAnalysisPeriod)}
          >
            <SelectTrigger className="w-[168px] h-8 text-xs" aria-label="Pilih periode analisis">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── State: memuat meta ── */}
        {metaEnabled && (metaLoading || (!habitMeta && !metaError)) && (
          <div className="space-y-3 pt-2" aria-busy="true" aria-label="Memuat analisis">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-44 rounded-2xl" />
          </div>
        )}

        {/* ── State: meta gagal ── */}
        {metaError && (
          <div className="premium-card premium-empty rounded-2xl mt-2">
            <div className="premium-empty-orb" aria-hidden="true">
              <RefreshCw className="h-7 w-7 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Gagal memuat data habit
            </p>
            <Button
              size="sm"
              className="btn-primary-gradient anim-press"
              onClick={() => void refetchMeta()}
            >
              <RefreshCw className="h-4 w-4" />
              Coba Lagi
            </Button>
          </div>
        )}

        {/* ── State: habit tidak mencatat waktu ── */}
        {habitMeta && !trackTime && (
          <div className="premium-card premium-empty rounded-2xl mt-2">
            <div className="premium-empty-orb" aria-hidden="true">
              <TimerOff className="h-7 w-7 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Habit ini tidak mencatat waktu
            </p>
            <p className="text-xs text-muted-foreground/70 -mt-0.5">
              Aktifkan "catat waktu" pada habit untuk melihat analisis durasi.
            </p>
          </div>
        )}

        {/* ── State: hasil ── */}
        {habitMeta && trackTime && (
          <div className="space-y-3 pt-2">
            {(analysisLoading || !data) && !analysisError && (
              <div className="space-y-3" aria-busy="true" aria-label="Memuat analisis">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-xl" />
                  ))}
                </div>
                <Skeleton className="h-44 rounded-2xl" />
              </div>
            )}

            {analysisError && (
              <div className="premium-card premium-empty rounded-2xl">
                <div className="premium-empty-orb" aria-hidden="true">
                  <RefreshCw className="h-7 w-7 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Gagal memuat analisis waktu
                </p>
                <Button
                  size="sm"
                  className="btn-primary-gradient anim-press"
                  onClick={() => void refetchAnalysis()}
                >
                  <RefreshCw className="h-4 w-4" />
                  Coba Lagi
                </Button>
              </div>
            )}

            {data && (
              <>
                {/* 5 stat card chip-soft */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="chip-soft chip-soft-teal flex-col items-start gap-1 h-auto py-2.5 px-3">
                    <span className="premium-label flex items-center gap-1.5">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      Total Menit
                    </span>
                    <span className="premium-stat text-base">
                      {formatMinutes(minutesTotal)}
                    </span>
                  </div>
                  <div className="chip-soft chip-soft-violet flex-col items-start gap-1 h-auto py-2.5 px-3">
                    <span className="premium-label flex items-center gap-1.5">
                      <TrendingUp className="h-3 w-3" aria-hidden="true" />
                      Rata-rata
                    </span>
                    <span className="premium-stat text-base">
                      {formatMinutes(avg)}
                    </span>
                  </div>
                  <div className="chip-soft chip-soft-amber flex-col items-start gap-1 h-auto py-2.5 px-3">
                    <span className="premium-label flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      Jumlah Sesi
                    </span>
                    <span className="premium-stat text-base">{count}×</span>
                  </div>
                  <div
                    className={cn(
                      'chip-soft flex-col items-start gap-1 h-auto py-2.5 px-3',
                      vsUp ? 'chip-soft-teal' : 'chip-soft-rose',
                    )}
                  >
                    <span className="premium-label">vs Periode Lalu</span>
                    <span className="premium-stat text-base">
                      {formatPct(vs)}
                    </span>
                  </div>
                  <div className="chip-soft chip-soft-amber flex-col items-start gap-1 h-auto py-2.5 px-3">
                    <span className="premium-label flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3" aria-hidden="true" />
                      Hari Teraktif
                    </span>
                    <span className="premium-stat text-base">
                      {bestDay && bestDay.minutes > 0
                        ? mmmDdIdFormatter(dateFromYMD(bestDay.date))
                        : '—'}
                    </span>
                  </div>
                </div>

                {/* Chart batang per hari */}
                <div className="premium-card rounded-2xl p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="chip-soft chip-soft-teal h-7 w-7" aria-hidden="true">
                      <BarChart3 className="h-3.5 w-3.5" />
                    </span>
                    <h4 className="premium-label">Waktu per Hari</h4>
                  </div>
                  {hasData ? (
                    <div className="h-44 sm:h-52 w-full" aria-label="Grafik waktu per hari">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={chartData}
                          margin={{ top: 8, right: 4, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="var(--border)"
                          />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                            axisLine={false}
                            tickLine={false}
                            width={44}
                          />
                          <Tooltip
                            cursor={{ fill: 'var(--muted)', opacity: 0.35 }}
                            contentStyle={{
                              borderRadius: '0.75rem',
                              border: '1px solid var(--border)',
                              background: 'var(--popover)',
                              color: 'var(--popover-foreground)',
                              fontSize: '12px',
                            }}
                            formatter={(value) => [
                              `${value} menit`,
                              'Waktu tercatat',
                            ]}
                          />
                          <Bar
                            dataKey="minutes"
                            radius={[6, 6, 0, 0]}
                            fill="var(--primary)"
                            maxBarSize={26}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Belum ada waktu tercatat di periode ini.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
