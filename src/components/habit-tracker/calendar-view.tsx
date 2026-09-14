'use client';

// components/habit-tracker/calendar-view.tsx — kalender heatmap (sub-tab
// "Riwayat" pada Tracker).
//
// FIX REBUILD:
//  - Tipe Habit/HabitLog/DailyLog diimpor dari daily-tracker-types (bentuk
//    serialisasi API sebenarnya: emoji/isArchived/sortOrder — field
//    icon/color/status/endDate lama tidak ada di API).
//  - MOOD_EMOJIS dari lib/mood (single source, sinkron dgn check-in card).
//  - batch-logs mengikuti kontrak API: ?month=…&ids=… → { logs: HabitLog[] }
//    (flat); grouping dilakukan client-side, dengan toleransi bentuk lama.
//  - TZ: lib/date-utils memakai komponen UTC — SEMUA tanggal grid dibangun
//    Date.UTC (monthDate, opsi bulan) supaya startOfMonth/format tidak
//    meleset sebulan/hari di browser non-UTC.
//  - Day cell klik → openTrackerDate(dayStr) (navigasi 1-klik).
//  - Label bulan Indonesia "MMMM yyyy" via format id.

import { useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isToday,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isBefore,
  startOfDay,
  eeeeIdFormatter,
  mmmDdIdFormatter,
} from '@/lib/date-utils';
// Task 37 — Jadwal Tampil: heatmap kalender hanya menghitung habit yang
// jadwalnya hari itu.
import { isScheduledOn, parseSchedule } from '@/lib/habit-schedule';
import { jakartaYmdOf } from './daily-tracker-helpers';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
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
  ChevronLeft,
  ChevronRight,
  Flame,
  Droplets,
  RefreshCw,
  CalendarDays,
  CalendarCheck,
  TrendingUp,
} from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { MOOD_EMOJIS } from '@/lib/mood';
import type { Habit, HabitLog, DailyLog } from './daily-tracker-types';
import type { AppSettings } from '@/lib/settings-types';

// ── Types ──────────────────────────────────────────────────────────────────
interface DayData {
  date: Date; // UTC-midnight (konvensi date-utils)
  dayStr: string; // yyyy-MM-dd
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  completionRate: number | null; // null = tidak ada data
  mood: number | null;
  totalHabits: number;
  completedHabits: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
// Urutan weekday mengikuti weekStart pengguna (AppSettings.weekStart: 0 =
// Minggu, 1 = Senin — default Senin).
const WEEKDAYS_BASE = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function weekStartsOnNum(weekStart: number | string | null | undefined): 0 | 1 {
  if (weekStart === 0 || weekStart === 'sunday') return 0;
  return 1; // Senin (default UI Pengaturan)
}

function rotateWeekdays(weekStartsOn: 0 | 1): string[] {
  return [...WEEKDAYS_BASE.slice(weekStartsOn), ...WEEKDAYS_BASE.slice(0, weekStartsOn)];
}

// Heatmap Aurora teal berjenjang. 0% = tint destructive (hari terlacak tapi
// kosong = status, bukan level panas); sel tinggi butuh teks putih (AA).
function getHeatmapColor(rate: number | null): string {
  if (rate === null) return 'bg-muted/60';
  if (rate === 0) return 'bg-destructive/25 dark:bg-destructive/15';
  if (rate < 50) return 'bg-teal-200/70 dark:bg-teal-900/50';
  if (rate < 75) return 'bg-teal-400/80 dark:bg-teal-700/60';
  return 'bg-teal-600 dark:bg-teal-500';
}

function getHeatmapTextColor(rate: number | null): string {
  if (rate === null) return 'text-muted-foreground';
  if (rate === 0) return 'text-destructive dark:text-destructive/80';
  if (rate >= 75) return 'text-white';
  return 'text-foreground';
}

function getDayNumTextColor(day: DayData): string {
  if (day.completionRate !== null && day.completionRate >= 75) return 'text-white font-bold';
  if (day.isToday) return 'text-primary font-bold';
  if (!day.isCurrentMonth) return 'text-muted-foreground';
  return 'text-foreground';
}

function getHeatmapHover(rate: number | null): string {
  if (rate === null || rate === 0) return 'hover:bg-accent/60';
  return 'hover:brightness-105 hover:ring-1 hover:ring-ring/60';
}

// Label aria Indonesia, mis. "Rabu 15 Januari 2025, 3 dari 5 habit selesai".
function buildDayAriaLabel(day: DayData): string {
  const d = day.date;
  const dateLabel = `${eeeeIdFormatter(d)} ${d.getUTCDate()} ${format(d, 'MMMM')} ${format(d, 'yyyy')}`;
  if (!day.isCurrentMonth) return dateLabel;
  if (day.completionRate === null) return `${dateLabel}, belum ada data`;
  if (day.totalHabits > 0) {
    return `${dateLabel}, ${day.completedHabits} dari ${day.totalHabits} habit selesai`;
  }
  return `${dateLabel}, semua catatan selesai`;
}

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

function generateMonthOptions(): { value: string; label: string }[] {
  // Basis bulan = komponen lokal browser (grid kalender memang lokal); label
  // dibangun dari Date.UTC supaya format() tidak meleset di TZ non-UTC.
  const now = new Date();
  const y0 = now.getFullYear();
  const m0 = now.getMonth();
  const options: { value: string; label: string }[] = [];
  for (let i = -12; i <= 3; i++) {
    const total = m0 + i;
    const y = y0 + Math.floor(total / 12);
    const m = ((total % 12) + 12) % 12;
    const d = new Date(Date.UTC(y, m, 1));
    options.push({
      value: `${y}-${pad2(m + 1)}`,
      label: format(d, 'MMMM yyyy'),
    });
  }
  return options;
}

// Heatmap legend — mirror threshold getHeatmapColor.
const HEATMAP_LEGEND: { label: string; color: string }[] = [
  { label: 'Tidak ada data', color: 'bg-muted/60' },
  { label: '0%', color: 'bg-destructive/25 dark:bg-destructive/15' },
  { label: '1–49%', color: 'bg-teal-200/70 dark:bg-teal-900/50' },
  { label: '50–74%', color: 'bg-teal-400/80 dark:bg-teal-700/60' },
  { label: '75–100%', color: 'bg-teal-600 dark:bg-teal-500' },
];

// ── Component ──────────────────────────────────────────────────────────────
export default function CalendarView() {
  const selectedMonth = useAppStore((s) => s.selectedMonth);
  const setSelectedMonth = useAppStore((s) => s.setSelectedMonth);
  // Day-cell tap → tracker grid dengan tanggal terpilih (1-klik).
  const openTrackerDate = useAppStore((s) => s.openTrackerDate);
  const queryClient = useQueryClient();

  // ── AppSettings (weekStart) — share cache ['settings'] dengan Settings ──
  const { data: settings = null } = useQuery<AppSettings | null>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
  });
  const weekStartsOn = weekStartsOnNum(settings?.weekStart);
  const WEEKDAYS = useMemo(() => rotateWeekdays(weekStartsOn), [weekStartsOn]);

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  // ── Bulan berjalan — Date.UTC (konvensi komponen UTC lib/date-utils) ──
  const monthDate = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1));
  }, [selectedMonth]);

  const monthLabel = useMemo(() => format(monthDate, 'MMMM yyyy'), [monthDate]);

  // ── Fetch data ────────────────────────────────────────────────────────
  const { data: habits = [], isLoading: habitsLoading } = useQuery<Habit[]>({
    queryKey: ['habits'],
    queryFn: async () => {
      const res = await fetch('/api/habits');
      if (!res.ok) return [];
      const json = (await res.json()) as { habits?: Habit[] };
      return json.habits ?? [];
    },
    staleTime: 30_000,
  });

  const { data: dailyLogs = [] } = useQuery<DailyLog[]>({
    queryKey: ['daily-logs-month', selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/daily-logs?month=${selectedMonth}`);
      if (!res.ok) return [];
      const json = (await res.json()) as { logs?: DailyLog[] };
      return json.logs ?? [];
    },
    staleTime: 30_000,
  });

  const habitIds = useMemo(() => habits.map((h) => h.id).join(','), [habits]);
  const { data: habitLogs = [], isError: fetchError } = useQuery<HabitLog[]>({
    queryKey: ['habit-logs-batch', selectedMonth, habitIds],
    queryFn: async () => {
      if (!habitIds) return [];
      const res = await fetch(
        `/api/habits/batch-logs?month=${selectedMonth}&ids=${habitIds}`,
      );
      if (!res.ok) return [];
      const json = (await res.json()) as unknown;
      // Kontrak: { logs: HabitLog[] } (flat). Toleransi bentuk grouped lama.
      if (Array.isArray(json)) return json as HabitLog[];
      if (json && typeof json === 'object' && Array.isArray((json as { logs?: HabitLog[] }).logs)) {
        return (json as { logs: HabitLog[] }).logs;
      }
      return Object.values(json as Record<string, HabitLog[]>).flat();
    },
    enabled: habits.length > 0,
    staleTime: 30_000,
  });

  const loading = habitsLoading;

  // ── Lookup daily-log per YMD ──────────────────────────────────────────
  const dailyLogMap = useMemo(() => {
    const map: Record<string, DailyLog> = {};
    dailyLogs.forEach((d) => {
      const key = d.date?.slice(0, 10);
      if (key) map[key] = d;
    });
    return map;
  }, [dailyLogs]);

  // ── Lookup log habit per YMD ──────────────────────────────────────────
  const habitLogMap = useMemo(() => {
    const map: Record<string, { completed: number; total: number }> = {};
    habitLogs.forEach((log) => {
      const key = log.date?.slice(0, 10);
      if (!key) return;
      if (!map[key]) map[key] = { completed: 0, total: 0 };
      map[key].total++;
      if (log.completed) map[key].completed++;
    });
    return map;
  }, [habitLogs]);

  // ── Sel kalender ──────────────────────────────────────────────────────
  const calendarDays = useMemo<DayData[]>(() => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn });
    const days = eachDayOfInterval(calStart, calEnd);

    const today = new Date();
    // Habit aktif pada hari tsb: tidak diarsipkan & sudah mulai (perbandingan
    // YMD string — TZ-safe, tanpa parse lokal).
    // Task 37: hanya habit yang JADWALNYA hari itu (habit mingguan tidak
    // dihitung "due" di hari kosongnya — heatmap % jadi jujur).
    const activeHabitCountOnDay = (dayStr: string): number =>
      habits.filter((h) => {
        if (h.isArchived) return false;
        // Task 39 (#3): habit lulus (graduatedAt) tidak lagi "due" — tanpa
        // ini heatmap kalender menurun permanen setelah wisuda (3/4 padahal
        // semua habit berjalan selesai 3/3). Tracker & dashboard sudah
        // memfilter; kalender tertinggal.
        if (h.graduatedAt) return false;
        // Task 39 (#9): konversi Jakarta (bukan slice UTC) — startDate
        // adalah momen nyata; kejadian 00:00–06:59 Jakarta salah hari di UTC.
        const start = h.startDate ? jakartaYmdOf(h.startDate) : null;
        if (start && start > dayStr) return false;
        return isScheduledOn(parseSchedule(h.scheduleJson), dayStr);
      }).length;

    return days.map((d) => {
      const dayStr = format(d, 'yyyy-MM-dd');
      const hLogs = habitLogMap[dayStr];
      const dLog = dailyLogMap[dayStr];
      const inMonth = isSameMonth(d, monthDate);
      const isFuture = isBefore(today, startOfDay(d)) && !isToday(d);

      const totalHabitsOnDay = inMonth && !isFuture ? activeHabitCountOnDay(dayStr) : 0;

      let completionRate: number | null = null;
      if (!inMonth || isFuture) {
        completionRate = null;
      } else if (hLogs && hLogs.total > 0 && totalHabitsOnDay > 0) {
        // Task 39 (#3 lanjutan): clamp 100 — log habit yang wisuda di hari
        // terakhirnya bisa membuat numerator > denominator (habit keluar
        // semesta due, lognya masih terhitung).
        completionRate = Math.min(100, Math.round((hLogs.completed / totalHabitsOnDay) * 100));
      } else if (hLogs && hLogs.total > 0 && totalHabitsOnDay === 0) {
        completionRate = 100;
      } else {
        completionRate = null;
      }

      return {
        date: d,
        dayStr,
        dayNum: d.getUTCDate(),
        isCurrentMonth: inMonth,
        isToday: isToday(d),
        completionRate,
        mood: dLog?.mood ?? null,
        totalHabits: totalHabitsOnDay,
        completedHabits: hLogs?.completed ?? 0,
      };
    });
  }, [monthDate, habits, habitLogMap, dailyLogMap, weekStartsOn]);

  // ── Ringkasan bulan ───────────────────────────────────────────────────
  const monthSummary = useMemo(() => {
    const activeDays = calendarDays.filter(
      (d) => d.isCurrentMonth && d.completionRate !== null,
    );
    if (activeDays.length === 0) return { avg: 0, best: null, worst: null, entries: 0 };

    const rates = activeDays.map((d) => (d.completionRate as number) || 0);
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    const bestIdx = rates.indexOf(Math.max(...rates));
    const worstIdx = rates.indexOf(Math.min(...rates));

    return {
      avg,
      best: activeDays[bestIdx],
      worst: activeDays[worstIdx],
      entries: activeDays.length,
    };
  }, [calendarDays]);

  // ── Navigasi ──────────────────────────────────────────────────────────
  const goToPrevMonth = useCallback(() => {
    const prev = subMonths(monthDate, 1);
    setSelectedMonth(format(prev, 'yyyy-MM'));
  }, [monthDate, setSelectedMonth]);

  const goToNextMonth = useCallback(() => {
    const next = addMonths(monthDate, 1);
    setSelectedMonth(format(next, 'yyyy-MM'));
  }, [monthDate, setSelectedMonth]);

  const handleDayClick = useCallback(
    (dayStr: string) => openTrackerDate(dayStr),
    [openTrackerDate],
  );

  const retryFetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['habits'] });
    queryClient.invalidateQueries({ queryKey: ['daily-logs-month'] });
    queryClient.invalidateQueries({ queryKey: ['habit-logs-batch'] });
  }, [queryClient]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header + navigasi bulan ── */}
      <PageHeader
        title="Kalender"
        subtitle="Visualisasikan penyelesaian habit kamu dalam heatmap bulanan."
        icon={CalendarDays}
        eyebrow="Riwayat"
      >
        <Button
          variant="outline"
          size="icon"
          onClick={goToPrevMonth}
          aria-label="Bulan sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[168px]" aria-label="Pilih bulan">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          onClick={goToNextMonth}
          aria-label="Bulan berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </PageHeader>

      {fetchError && (
        <div className="premium-card premium-empty rounded-2xl">
          <div className="premium-empty-orb" aria-hidden="true">
            <CalendarDays className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">
            Gagal memuat data kalender
          </p>
          <p className="text-xs text-muted-foreground/70 -mt-0.5">
            Coba muat ulang habit dan log kamu.
          </p>
          <Button
            size="sm"
            className="btn-primary-gradient anim-press"
            onClick={retryFetch}
          >
            <RefreshCw className="h-4 w-4" />
            Coba Lagi
          </Button>
        </div>
      )}

      {!fetchError &&
        (loading ? (
          <div
            className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5"
            aria-busy="true"
            aria-label="Memuat kalender"
          >
            <div className="grid grid-cols-7 gap-1.5 mb-3">
              {WEEKDAYS.map((d) => (
                <Skeleton key={d} className="h-4 rounded-md" />
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5 max-h-[420px] overflow-hidden">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-[60px] sm:h-[68px] rounded-lg"
                  style={{ animationDelay: `${(i % 7) * 70}ms` }}
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* ── Grid kalender (div premium-card, bukan Card shadcn) ── */}
            <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 premium-fade-up">
              {/* Header weekday */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {WEEKDAYS.map((d) => (
                  <div
                    key={d}
                    className="text-center text-xs font-semibold text-muted-foreground py-2"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells — setiap hari tombol nyata → openTrackerDate */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => (
                  <button
                    key={day.dayStr}
                    type="button"
                    onClick={() => handleDayClick(day.dayStr)}
                    aria-label={buildDayAriaLabel(day)}
                    className={`
                      relative min-h-[72px] sm:min-h-[88px] md:min-h-[100px] rounded-lg p-1.5 sm:p-2 text-left
                      transition-all duration-150 cursor-pointer active:scale-95
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60
                      ${getHeatmapColor(day.completionRate)}
                      ${getHeatmapHover(day.completionRate)}
                      ${!day.isCurrentMonth ? 'opacity-35' : ''}
                      ${day.isToday ? 'ring-2 ring-primary ring-offset-2 ring-offset-background anim-glow-breathe' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs sm:text-sm font-medium ${getDayNumTextColor(day)}`}
                      >
                        {day.dayNum}
                      </span>
                      {/* Mood marker dari daily-logs */}
                      {day.isCurrentMonth && day.mood !== null && (
                        <span className="text-[10px] leading-none" aria-hidden="true">
                          {MOOD_EMOJIS[Math.round(day.mood)] ?? '🙂'}
                        </span>
                      )}
                    </div>

                    {day.isCurrentMonth && day.completionRate !== null && (
                      <div className="mt-1 flex flex-col items-center gap-0.5">
                        <span
                          className={`text-xs font-bold ${getHeatmapTextColor(day.completionRate)}`}
                        >
                          {day.completionRate}%
                        </span>
                        <div className="w-full bg-foreground/10 rounded-full h-1 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-foreground/60 transition-all duration-300"
                            style={{
                              width: `${Math.max(day.completionRate, 0)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {day.isCurrentMonth &&
                      day.completionRate === null &&
                      !isBefore(new Date(), startOfDay(day.date)) && (
                        <div className="mt-1 text-center">
                          <span className="text-xs text-muted-foreground">—</span>
                        </div>
                      )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Legenda + ringkasan bulan ── */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Legenda */}
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

              {/* Ringkasan bulan */}
              <section className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="chip-soft chip-soft-amber h-8 w-8">
                    <Flame className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">
                    Ringkasan {monthLabel}
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="premium-card p-3.5 sm:p-4">
                    <div className="flex items-center gap-2">
                      <span className="chip-soft chip-soft-teal h-8 w-8 shrink-0">
                        <TrendingUp className="h-4 w-4" />
                      </span>
                      <span className="premium-label truncate">Rata-rata</span>
                    </div>
                    <p className="premium-stat text-2xl mt-3 text-foreground">
                      {monthSummary.avg.toFixed(1)}%
                    </p>
                    <p className="text-[11px] mt-1 text-muted-foreground">
                      Penyelesaian per hari aktif
                    </p>
                  </div>

                  <div className="premium-card p-3.5 sm:p-4">
                    <div className="flex items-center gap-2">
                      <span className="chip-soft chip-soft-violet h-8 w-8 shrink-0">
                        <CalendarCheck className="h-4 w-4" />
                      </span>
                      <span className="premium-label truncate">Hari Dilacak</span>
                    </div>
                    <p className="premium-stat text-2xl mt-3 text-foreground">
                      {monthSummary.entries}
                    </p>
                    <p className="text-[11px] mt-1 text-muted-foreground">
                      Hari dengan data bulan ini
                    </p>
                  </div>

                  {monthSummary.best && (
                    <div className="premium-card p-3.5 sm:p-4">
                      <div className="flex items-center gap-2">
                        <span className="chip-soft chip-soft-amber h-8 w-8 shrink-0">
                          <Flame className="h-4 w-4" />
                        </span>
                        <span className="premium-label truncate">Hari Terbaik</span>
                      </div>
                      <p className="premium-stat text-2xl mt-3 text-foreground">
                        {mmmDdIdFormatter(monthSummary.best.date)}
                      </p>
                      <p className="mt-1.5">
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 text-primary hover:bg-primary/10 text-[10px]"
                        >
                          {monthSummary.best.completionRate}% selesai
                        </Badge>
                      </p>
                    </div>
                  )}

                  {monthSummary.worst && (
                    <div className="premium-card p-3.5 sm:p-4">
                      <div className="flex items-center gap-2">
                        <span className="chip-soft chip-soft-rose h-8 w-8 shrink-0">
                          <Droplets className="h-4 w-4" />
                        </span>
                        <span className="premium-label truncate">Hari Terburuk</span>
                      </div>
                      <p className="premium-stat text-2xl mt-3 text-foreground">
                        {mmmDdIdFormatter(monthSummary.worst.date)}
                      </p>
                      <p className="mt-1.5">
                        <Badge
                          variant="secondary"
                          className="bg-destructive/10 text-destructive hover:bg-destructive/10 text-[10px]"
                        >
                          {monthSummary.worst.completionRate}% selesai
                        </Badge>
                      </p>
                    </div>
                  )}
                </div>

                {monthSummary.entries === 0 && (
                  <div className="mt-4 text-center text-sm text-muted-foreground py-4">
                    Belum ada hari yang dilacak bulan ini. Mulai selesaikan habit!
                  </div>
                )}
              </section>
            </div>
          </>
        ))}
    </div>
  );
}
