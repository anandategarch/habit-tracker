'use client';

import { useState, useEffect, useMemo, useCallback, useTransition } from 'react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  getDay,
  isToday,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isBefore,
  startOfDay,
} from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ChevronLeft, ChevronRight, CalendarDays, Flame, Droplets, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/store/app-store';

// ── Types ──────────────────────────────────────────────────────────────────
interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
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
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MOOD_EMOJIS: Record<number, string> = {
  1: '😢',
  2: '😟',
  3: '😐',
  4: '🙂',
  5: '😊',
};

function getHeatmapColor(rate: number | null): string {
  if (rate === null) return 'bg-gray-100 dark:bg-gray-800/50';
  if (rate === 0) return 'bg-red-200 dark:bg-red-900/40';
  if (rate < 25) return 'bg-orange-200 dark:bg-orange-900/40';
  if (rate < 50) return 'bg-yellow-200 dark:bg-yellow-900/40';
  if (rate < 75) return 'bg-lime-200 dark:bg-lime-900/40';
  return 'bg-green-300 dark:bg-green-800/50';
}

function getHeatmapTextColor(rate: number | null): string {
  if (rate === null) return 'text-gray-400 dark:text-gray-500';
  if (rate === 0) return 'text-red-700 dark:text-red-300';
  if (rate < 50) return 'text-yellow-800 dark:text-yellow-200';
  return 'text-green-800 dark:text-green-200';
}

function generateMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  // Show last 12 months and next 3 months
  for (let i = -12; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push({
      value: format(d, 'yyyy-MM'),
      label: format(d, 'MMMM yyyy'),
    });
  }
  return options;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function CalendarView() {
  const { selectedMonth, setSelectedMonth } = useAppStore();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [loading, startLoadingTransition] = useTransition();
  const [fetchError, setFetchError] = useState(false);

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  // ── Parse current month ────────────────────────────────────────────────
  const monthDate = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return new Date(y, m - 1, 1);
  }, [selectedMonth]);

  const monthLabel = useMemo(
    () => format(monthDate, 'MMMM yyyy'),
    [monthDate]
  );

  // ── Fetch data ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const monthStr = selectedMonth; // yyyy-MM

    startLoadingTransition(async () => {
      try {
        const [habitsRes, dailyRes] = await Promise.all([
          fetch('/api/habits'),
          fetch(`/api/daily-logs?month=${monthStr}`),
        ]);
        const habitsData = habitsRes.ok ? await habitsRes.json() : [];
        const dailyData = dailyRes.ok ? await dailyRes.json() : [];

        if (cancelled) return;
        setHabits(habitsData);
        setDailyLogs(dailyData);
        setFetchError(false);

        // Fetch logs for each habit
        if (habitsData.length > 0) {
          const allLogs = await Promise.all(
            habitsData.map((h: Habit) =>
              fetch(`/api/habits/${h.id}/logs?month=${monthStr}`)
                .then((r) => (r.ok ? r.json() : []))
                .catch(() => [])
            )
          );
          if (!cancelled) {
            setHabitLogs(allLogs.flat());
          }
        } else {
          setHabitLogs([]);
        }
      } catch {
        // network error
        if (!cancelled) setFetchError(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedMonth]);

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
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: calStart, end: calEnd });

    const today = new Date();
    const totalHabits = habits.filter((h) => h.status !== 'archived').length;

    return days.map((d) => {
      const dayStr = format(d, 'yyyy-MM-dd');
      const hLogs = habitLogMap[dayStr];
      const dLog = dailyLogMap[dayStr];
      const inMonth = isSameMonth(d, monthDate);
      const isFuture = isBefore(today, startOfDay(d)) && !isToday(d);

      let completionRate: number | null = null;
      if (!inMonth) {
        completionRate = null;
      } else if (isFuture) {
        completionRate = null;
      } else if (hLogs && totalHabits > 0) {
        completionRate =
          hLogs.total > 0
            ? Math.round((hLogs.completed / totalHabits) * 100)
            : 0;
      } else if (inMonth && totalHabits > 0 && !isFuture) {
        completionRate = 0;
      }

      return {
        date: d,
        dayStr,
        dayNum: d.getDate(),
        isCurrentMonth: inMonth,
        isToday: isToday(d),
        completionRate,
        mood: dLog?.mood ?? null,
        totalHabits,
        completedHabits: hLogs?.completed ?? 0,
      };
    });
  }, [monthDate, habits, habitLogMap, dailyLogMap]);

  // ── Month summary ──────────────────────────────────────────────────────
  const monthSummary = useMemo(() => {
    const activeDays = calendarDays.filter(
      (d) =>
        d.isCurrentMonth &&
        d.completionRate !== null
    );
    if (activeDays.length === 0)
      return { avg: 0, best: null, worst: null, entries: 0 };

    const rates = activeDays.map((d) => d.completionRate as number);
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

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header with month navigation ──────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Calendar View
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Visualize your habit completion in a monthly heatmap.
          </p>
        </div>

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
      </div>

      {fetchError && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm text-muted-foreground">Gagal memuat data kalender</p>
          <Button variant="outline" size="sm" onClick={() => setFetchError(false)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Coba Lagi
          </Button>
        </div>
      )}

      {!fetchError && (loading ? (
        <Skeleton className="h-[600px] w-full rounded-xl" />
      ) : (
        <>
          {/* ── Calendar Card ──────────────────────────────────────────── */}
          <Card>
            <CardContent className="p-4 md:p-6">
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

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => (
                  <div
                    key={idx}
                    className={`
                      relative min-h-[72px] sm:min-h-[88px] md:min-h-[100px] rounded-lg p-1.5 sm:p-2
                      transition-all duration-150
                      ${getHeatmapColor(day.completionRate)}
                      ${!day.isCurrentMonth ? 'opacity-35' : ''}
                      ${day.isToday ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
                      hover:ring-1 hover:ring-primary/50 cursor-default
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs sm:text-sm font-medium ${
                          day.isToday
                            ? 'text-primary font-bold'
                            : !day.isCurrentMonth
                            ? 'text-muted-foreground'
                            : 'text-foreground'
                        }`}
                      >
                        {day.dayNum}
                      </span>
                      {day.mood && day.isCurrentMonth && (
                        <span className="text-xs" title={`Mood: ${day.mood}/5`}>
                          {MOOD_EMOJIS[day.mood] || ''}
                        </span>
                      )}
                    </div>

                    {day.isCurrentMonth && day.completionRate !== null && (
                      <div className="mt-1 flex flex-col items-center gap-0.5">
                        <span
                          className={`text-[10px] sm:text-xs font-bold ${getHeatmapTextColor(
                            day.completionRate
                          )}`}
                        >
                          {day.completionRate}%
                        </span>
                        <div className="w-full bg-black/10 rounded-full h-1 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{
                              width: `${Math.max(day.completionRate, 0)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {day.isCurrentMonth && day.completionRate === null && !isBefore(new Date(), startOfDay(day.date)) && (
                      <div className="mt-1 text-center">
                        <span className="text-[10px] text-muted-foreground">—</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Heatmap Legend + Month Summary ─────────────────────────── */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Heatmap Legend */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Heatmap Legend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-3">
                  {[
                    { label: 'No data', color: 'bg-gray-100 dark:bg-gray-800/50' },
                    { label: '0%', color: 'bg-red-200 dark:bg-red-900/40' },
                    { label: '25%', color: 'bg-orange-200 dark:bg-orange-900/40' },
                    { label: '50%', color: 'bg-yellow-200 dark:bg-yellow-900/40' },
                    { label: '75%', color: 'bg-lime-200 dark:bg-lime-900/40' },
                    { label: '100%', color: 'bg-green-300 dark:bg-green-800/50' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <div
                        className={`h-6 w-6 rounded ${item.color} border border-border/50`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded ring-2 ring-primary ring-offset-1 bg-primary/10" />
                    <span className="text-xs text-muted-foreground">Today</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">😊</span>
                    <span className="text-xs text-muted-foreground">Mood logged</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Month Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" />
                  {monthLabel} Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 p-3 rounded-lg bg-primary/10">
                    <p className="text-xs text-muted-foreground">
                      Average Completion
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      {monthSummary.avg.toFixed(1)}%
                    </p>
                  </div>

                  <div className="space-y-1 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                    <p className="text-xs text-muted-foreground">
                      Days Tracked
                    </p>
                    <p className="text-2xl font-bold">
                      {monthSummary.entries}
                    </p>
                  </div>

                  {monthSummary.best && (
                    <div className="space-y-1 p-3 rounded-lg bg-primary/10">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Flame className="h-3 w-3 text-primary" /> Best Day
                      </p>
                      <p className="text-lg font-bold text-primary">
                        {format(monthSummary.best.date, 'MMM d')}
                      </p>
                      <Badge
                        variant="secondary"
                        className="bg-primary/10 text-primary hover:bg-primary/10 text-xs"
                      >
                        {monthSummary.best.completionRate}%
                      </Badge>
                    </div>
                  )}

                  {monthSummary.worst && (
                    <div className="space-y-1 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Droplets className="h-3 w-3 text-orange-500" /> Worst
                        Day
                      </p>
                      <p className="text-lg font-bold text-orange-700 dark:text-orange-300">
                        {format(monthSummary.worst.date, 'MMM d')}
                      </p>
                      <Badge
                        variant="secondary"
                        className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-xs"
                      >
                        {monthSummary.worst.completionRate}%
                      </Badge>
                    </div>
                  )}
                </div>

                {monthSummary.entries === 0 && (
                  <div className="mt-4 text-center text-sm text-muted-foreground py-4">
                    No tracked days this month yet. Start completing habits!
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ))}
    </div>
  );
}