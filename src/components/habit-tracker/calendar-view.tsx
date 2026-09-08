'use client';

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
  id as idLocale,
} from '@/lib/date-utils';
// PERF-FIX (FIX-TIER3 / Fix 15): replaced `date-fns` with native Intl-based
// utility module. Output is identical for all patterns and helpers used
// here (yyyy-MM, MMMM yyyy, yyyy-MM-dd, MMM d + startOfMonth/endOfMonth/
// startOfWeek/endOfWeek/eachDayOfInterval/isToday/isSameMonth/isBefore/
// startOfDay/addMonths/subMonths) — verified via test script in worklog
// FIX-TIER3 entry.
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

// ── Settings type ──────────────────────────────────────────────────────────
// Minimal shape of AppSettings — only the fields we consume. We re-use the
// shared ['settings'] query cache so we stay in sync with the Settings page.
interface AppSettings {
  weekStart?: 'monday' | 'sunday' | 'saturday' | string | null;
}

// ── Types ──────────────────────────────────────────────────────────────────
interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  status?: string;
  // BUG-9 fix: include startDate/endDate so we can count habits that were
  // actually active on a given historical day (instead of dividing by the
  // CURRENT total habit count, which distorts past days).
  startDate?: string;
  endDate?: string | null;
}

interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  completed: boolean;
  value: number;
}

interface DailyLog {
  id: string;
  date: string;
  mood: number;
  energy: number;
  sleep: number;
  notes?: string;
}

interface DayData {
  date: Date;
  dayStr: string; // yyyy-MM-dd
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  completionRate: number | null; // null = no data
  mood: number | null;
  totalHabits: number;
  completedHabits: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
// Default weekday order is Sun..Sat. When the user has chosen Monday or
// Saturday as their week start, we rotate the header array to match.
// (BUGHUNT-OTHER-1 BUG-H3: previously hardcoded `weekStartsOn: 0` (Sunday)
//  and ignored the user's `weekStart` setting entirely.)
const WEEKDAYS_BASE = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function weekStartsOnNum(weekStart?: string | null): 0 | 1 | 6 {
  if (weekStart === 'saturday') return 6;
  if (weekStart === 'sunday') return 0;
  // Default to Monday (matches the Settings UI default).
  return 1;
}

function rotateWeekdays(weekStartsOn: 0 | 1 | 6): string[] {
  const idx = weekStartsOn === 6 ? 6 : weekStartsOn; // 0 or 1 or 6
  return [...WEEKDAYS_BASE.slice(idx), ...WEEKDAYS_BASE.slice(0, idx)];
}

// PREMIUM REDESIGN (Rutina Aurora / Task 4-c): legacy gray/orange/lime
// heatmap → Aurora teal-emerald scale. 0% keeps a soft destructive tint —
// a tracked-but-missed day is a *status*, not a heat level. High cells
// (bg-teal-600/500) need white text for AA contrast; see the text helpers.
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

// Day-number color follows the same rules (white on high-heat cells so it
// stays readable on teal-600; today keeps its primary-bold affordance).
function getDayNumTextColor(day: DayData): string {
  if (day.completionRate !== null && day.completionRate >= 75) return 'text-white font-bold';
  if (day.isToday) return 'text-primary font-bold';
  if (!day.isCurrentMonth) return 'text-muted-foreground';
  return 'text-foreground';
}

// Task 4-c hover affordance: neutral/destructive cells tint with accent on
// hover (spec: `hover:bg-accent/60`); heat-colored cells keep their fill —
// the accent tint would wash out the white % text — so they brighten + get
// a hairline ring instead. Both paths get active:scale-95 press feedback.
function getHeatmapHover(rate: number | null): string {
  if (rate === null || rate === 0) return 'hover:bg-accent/60';
  return 'hover:brightness-105 hover:ring-1 hover:ring-ring/60';
}

// Mood emoji for days whose daily-log has mood data (1–5 scale, same map
// as the dashboard's MoodEmoji). Renders inside the day cell so the legend
// row "😊 Mood tercatat" is no longer a dead promise.
const MOOD_EMOJIS: Record<number, string> = {
  1: '😢',
  2: '😔',
  3: '😐',
  4: '🙂',
  5: '😊',
};

// Task 4-c: Indonesian aria-label for the day buttons, e.g.
// "Rabu 15 Januari 2025, 3 dari 5 habit selesai".
function buildDayAriaLabel(day: DayData): string {
  const dateLabel = `${format(day.date, 'EEEE', {
    locale: idLocale,
  })} ${format(day.date, 'd MMMM yyyy', { locale: idLocale })}`;
  if (!day.isCurrentMonth) return dateLabel;
  if (day.completionRate === null) return `${dateLabel}, belum ada data`;
  if (day.totalHabits > 0) {
    return `${dateLabel}, ${day.completedHabits} dari ${day.totalHabits} habit selesai`;
  }
  // Edge case: logs exist but no habit was considered active that day
  // (completionRate is 100 by convention — see BUG-9 note above).
  return `${dateLabel}, semua catatan selesai`;
}

function generateMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  // Show last 12 months and next 3 months
  for (let i = -12; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push({
      value: format(d, 'yyyy-MM'),
      label: format(d, 'MMMM yyyy', { locale: idLocale }),
    });
  }
  return options;
}

// Heatmap legend — mirrors getHeatmapColor thresholds exactly.
const HEATMAP_LEGEND: { label: string; color: string }[] = [
  { label: 'Tidak ada data', color: 'bg-muted/60' },
  { label: '0%', color: 'bg-destructive/25 dark:bg-destructive/15' },
  { label: '1–49%', color: 'bg-teal-200/70 dark:bg-teal-900/50' },
  { label: '50–74%', color: 'bg-teal-400/80 dark:bg-teal-700/60' },
  { label: '75–100%', color: 'bg-teal-600 dark:bg-teal-500' },
];

// ── Component ──────────────────────────────────────────────────────────────
export default function CalendarView() {
  const selectedMonth = useAppStore(s => s.selectedMonth);
  const setSelectedMonth = useAppStore(s => s.setSelectedMonth);
  // Task 4-c (calendar 1-click): store primitive from 4-foundation — jumps
  // to the tracker grid with the tapped date preselected. dayStr is
  // 'yyyy-MM-dd', exactly matching the store's selectedDate semantics.
  const openTrackerDate = useAppStore(s => s.openTrackerDate);
  const queryClient = useQueryClient();

  // ── Fetch AppSettings to read `weekStart` (BUG-H3 fix) ────────────────
  // Shares the ['settings'] cache with the Settings page so changes apply
  // immediately after a save + invalidation.
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

  // ── Parse current month ────────────────────────────────────────────────
  const monthDate = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return new Date(y, m - 1, 1);
  }, [selectedMonth]);

  const monthLabel = useMemo(
    () => format(monthDate, 'MMMM yyyy', { locale: idLocale }),
    [monthDate]
  );

  // ── Fetch data (TanStack Query) ───────────────────────────────────────
  const { data: habits = [], isLoading: habitsLoading } = useQuery<Habit[]>({
    queryKey: ['habits'],
    queryFn: async () => {
      const res = await fetch('/api/habits');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data: dailyLogs = [] } = useQuery<DailyLog[]>({
    queryKey: ['daily-logs-month', selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/daily-logs?month=${selectedMonth}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  const habitIds = habits.map(h => h.id).join(',');
  const { data: habitLogs = [], isError: fetchError } = useQuery<HabitLog[]>({
    queryKey: ['habit-logs-batch', selectedMonth, habitIds],
    queryFn: async () => {
      if (!habitIds) return [];
      const res = await fetch(`/api/habits/batch-logs?month=${selectedMonth}&habitIds=${habitIds}`);
      if (!res.ok) return [];
      const groupedLogs: Record<string, HabitLog[]> = await res.json();
      return Object.values(groupedLogs).flat();
    },
    enabled: habits.length > 0,
    staleTime: 30_000,
  });

  const loading = habitsLoading;

  // ── Build daily log lookup ─────────────────────────────────────────────
  const dailyLogMap = useMemo(() => {
    const map: Record<string, DailyLog> = {};
    dailyLogs.forEach((d) => {
      const key = d.date?.slice(0, 10);
      if (key) map[key] = d;
    });
    return map;
  }, [dailyLogs]);

  // ── Build habit log lookup: dateStr -> { completed: number, total: number }
  const habitLogMap = useMemo(() => {
    const map: Record<
      string,
      { completed: number; total: number; habits: HabitLog[] }
    > = {};
    habitLogs.forEach((log) => {
      const key = log.date?.slice(0, 10);
      if (!key) return;
      if (!map[key]) map[key] = { completed: 0, total: 0, habits: [] };
      map[key].habits.push(log);
      map[key].total++;
      if (log.completed) map[key].completed++;
    });
    return map;
  }, [habitLogs]);

  // ── Build calendar days ────────────────────────────────────────────────
  const calendarDays = useMemo<DayData[]>(() => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    // BUGHUNT-OTHER-1 BUG-H3: respect user's `weekStart` setting instead
    // of hardcoding Sunday.
    const calStart = startOfWeek(monthStart, { weekStartsOn });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn });
    const days = eachDayOfInterval({ start: calStart, end: calEnd });

    const today = new Date();
    // BUG-9 fix: count habits active on a SPECIFIC day (startDate <= day AND
    // (endDate is null OR endDate >= day) AND status !== 'archived') instead
    // of using the CURRENT total. Previously a user with 10 current habits
    // looking at a day last month when they only had 3 habits would see
    // completion rates divided by 10, drastically understating past days.
    const activeHabitCountOnDay = (day: Date): number => {
      const dayStart = startOfDay(day);
      const ts = dayStart.getTime();
      return habits.filter((h) => {
        if (h.status === 'archived') return false;
        // Parse startDate/endDate as local-midnight Date objects. They arrive
        // as ISO strings from the API; Date-only strings ("yyyy-MM-dd") parse
        // as UTC midnight, so we slice to 10 chars and use new Date(y,m,d) to
        // avoid TZ-induced off-by-one.
        if (h.startDate) {
          const sd = h.startDate.slice(0, 10);
          const [sy, sm, sd2] = sd.split('-').map(Number);
          if (new Date(sy, sm - 1, sd2).getTime() > ts) return false;
        }
        if (h.endDate) {
          const ed = h.endDate.slice(0, 10);
          const [ey, em, ed2] = ed.split('-').map(Number);
          if (new Date(ey, em - 1, ed2).getTime() < ts) return false;
        }
        return true;
      }).length;
    };

    return days.map((d) => {
      const dayStr = format(d, 'yyyy-MM-dd');
      const hLogs = habitLogMap[dayStr];
      const dLog = dailyLogMap[dayStr];
      const inMonth = isSameMonth(d, monthDate);
      const isFuture = isBefore(today, startOfDay(d)) && !isToday(d);

      // BUG-9 + BUG-26 fix:
      //  - Use per-day active habit count (not current total) → past days
      //    aren't divided by an anachronistic habit count.
      //  - No logs for the day → neutral (null), not 0% red. Showing 0% red
      //    for a day before the user started tracking was misleading.
      const totalHabitsOnDay = inMonth && !isFuture ? activeHabitCountOnDay(d) : 0;

      let completionRate: number | null = null;
      if (!inMonth) {
        completionRate = null;
      } else if (isFuture) {
        completionRate = null;
      } else if (hLogs && hLogs.total > 0 && totalHabitsOnDay > 0) {
        // Has logs + habits were active that day: compute real rate.
        completionRate = Math.round((hLogs.completed / totalHabitsOnDay) * 100);
      } else if (hLogs && hLogs.total > 0 && totalHabitsOnDay === 0) {
        // Edge case: logs exist but no habits are considered active that day
        // (e.g. all habits were archived). Treat as 100% — the user did log
        // something. Neutral (null) would also be defensible; 100% matches
        // the spirit of "completed everything that was expected".
        completionRate = 100;
      } else {
        // No logs at all → neutral, not 0% red (BUG-26).
        completionRate = null;
      }

      return {
        date: d,
        dayStr,
        dayNum: d.getDate(),
        isCurrentMonth: inMonth,
        isToday: isToday(d),
        completionRate,
        mood: dLog?.mood ?? null,
        totalHabits: totalHabitsOnDay,
        completedHabits: hLogs?.completed ?? 0,
      };
    });
  }, [monthDate, habits, habitLogMap, dailyLogMap, weekStartsOn]);

  // ── Month summary ──────────────────────────────────────────────────────
  const monthSummary = useMemo(() => {
    const activeDays = calendarDays.filter(
      (d) =>
        d.isCurrentMonth &&
        d.completionRate !== null
    );
    if (activeDays.length === 0)
      return { avg: 0, best: null, worst: null, entries: 0 };

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

  // ── Navigation handlers ────────────────────────────────────────────────
  const goToPrevMonth = useCallback(() => {
    const prev = subMonths(monthDate, 1);
    setSelectedMonth(format(prev, 'yyyy-MM'));
  }, [monthDate, setSelectedMonth]);

  const goToNextMonth = useCallback(() => {
    const next = addMonths(monthDate, 1);
    setSelectedMonth(format(next, 'yyyy-MM'));
  }, [monthDate, setSelectedMonth]);

  // Task 4-c: day-cell tap → openTrackerDate (tracker grid + preselected
  // date). zustand setters are stable, so the callback identity is stable.
  const handleDayClick = useCallback(
    (dayStr: string) => openTrackerDate(dayStr),
    [openTrackerDate]
  );

  const retryFetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['habits'] });
    queryClient.invalidateQueries({ queryKey: ['daily-logs-month'] });
    queryClient.invalidateQueries({ queryKey: ['habit-logs-batch'] });
  }, [queryClient]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header with month navigation ──────────────────────────────── */}
      <PageHeader
        title="Kalender"
        description="Visualisasikan penyelesaian habit kamu dalam heatmap bulanan."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Select
              value={selectedMonth}
              onValueChange={setSelectedMonth}
            >
              <SelectTrigger className="w-[180px]">
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

            <Button variant="outline" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

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

      {!fetchError && (loading ? (
        // Task 4-c: light skeleton that mimics the calendar grid (weekday
        // header bars + a 7-col grid of rounded squares, capped at 420px)
        // instead of one giant blank block.
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
          {/* ── Calendar Card ──────────────────────────────────────────── */}
          {/* PREMIUM REDESIGN (Task 4-c): bare div + premium-card (NOT shadcn
              Card — see worklog 2-c anti-pattern note). */}
          <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 premium-fade-up">
              {/* Weekday headers */}
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

              {/* Day cells — Task 4-c: every day is a real button.
                  Click → openTrackerDate(dayStr) → tracker grid with that
                  date preselected (the app's highest-value 1-click link).
                  Cells are ~49px wide on a 400px viewport (≥40px touch
                  target); the grid stretches them full-width on desktop. */}
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
                      {/* Mood marker (Task 4-c): real data from the daily-log
                          lookup — makes the "Mood tercatat" legend honest. */}
                      {day.isCurrentMonth && day.mood !== null && (
                        <span
                          className="text-[10px] leading-none"
                          aria-hidden="true"
                        >
                          {MOOD_EMOJIS[day.mood] ?? '😐'}
                        </span>
                      )}
                    </div>

                    {day.isCurrentMonth && day.completionRate !== null && (
                      <div className="mt-1 flex flex-col items-center gap-0.5">
                        <span
                          className={`text-xs sm:text-xs font-bold ${getHeatmapTextColor(
                            day.completionRate
                          )}`}
                        >
                          {day.completionRate}%
                        </span>
                        {/* Progress bar kept (Task 4-c); track/fill now use
                            foreground tokens so they stay visible on every
                            heat level in light AND dark mode. */}
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

                    {day.isCurrentMonth && day.completionRate === null && !isBefore(new Date(), startOfDay(day.date)) && (
                      <div className="mt-1 text-center">
                        <span className="text-xs text-muted-foreground">—</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
          </div>

          {/* ── Heatmap Legend + Month Summary ─────────────────────────── */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Heatmap Legend */}
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
                {/* Task 4-c: no longer a dead promise — day cells now render
                    a small mood emoji when the daily-log has mood data. */}
                <div className="flex items-center gap-2">
                  <span className="text-sm" aria-hidden="true">😊</span>
                  <span className="text-xs text-muted-foreground">Mood tercatat</span>
                </div>
              </div>
            </section>

            {/* Month Summary */}
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
                {/* Stat tiles follow the daily-tracker KPI pattern:
                    chip-soft icon + premium-label + premium-stat. */}
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
                      {format(monthSummary.best.date, 'd MMM', { locale: idLocale })}
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
                      {format(monthSummary.worst.date, 'd MMM', { locale: idLocale })}
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