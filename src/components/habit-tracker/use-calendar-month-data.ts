'use client';

// components/habit-tracker/use-calendar-month-data.ts — data layer kalender
// heatmap (sub-tab "Riwayat"): query ['settings'] / ['habits'] /
// ['daily-logs-month'] / ['habit-logs-batch'] + derivasi sel kalender,
// ringkasan bulan, dan navigasi bulan (store trackerMonth).
// Dipecah dari calendar-view.tsx (Task 71-j) — query key & payload API
// identik; komentar kontrak dipertahankan verbatim.

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
} from '@/lib/date-utils';
// Task 37 — Jadwal Tampil: heatmap kalender hanya menghitung habit yang
// jadwalnya hari itu.
import { isScheduledOn, parseSchedule } from '@/lib/habit-schedule';
import { jakartaYmdOf, vacationIntervalsOf } from './daily-tracker-helpers';
import { vacationDayPredicate } from '@/lib/habit-vacation';
import { useAppStore } from '@/store/app-store';
import type { Habit, HabitLog, DailyLog } from './daily-tracker-types';
import type { AppSettings } from '@/lib/settings-types';
import { generateMonthOptions, rotateWeekdays, weekStartsOnNum } from './calendar-helpers';
import type { DayData, MonthSummary } from './calendar-types';

export function useCalendarMonthData() {
  const selectedMonth = useAppStore((s) => s.trackerMonth); // CONNECTED-APP: bulan kalender habit — TERPISAH dari bulan Keuangan
  const setSelectedMonth = useAppStore((s) => s.setTrackerMonth);
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

  // BUGHUNT-54 (3-b #1): /api/habits kini juga mengirim habit DIJEDA — kalender
  // hanya memantau habit AKTIF (log yang diambil & denominator heatmap),
  // filter client-side di sini (habit dijeda tidak "due" di hari apa pun).
  const habitIds = useMemo(
    () => habits.filter((h) => h.isActive).map((h) => h.id).join(','),
    [habits],
  );
  const { data: habitLogs = [], isError: fetchError } = useQuery<HabitLog[]>({
    queryKey: ['habit-logs-batch', selectedMonth, habitIds],
    queryFn: async () => {
      if (!habitIds) return [];
      const res = await fetch(
        `/api/habits/batch-logs?month=${selectedMonth}&ids=${habitIds}`,
      );
      // 61-g (audit 61-d P2): dulunya `return []` saat !res.ok — error
      // server tersimpan sebagai "data kosong" sukses di cache, sehingga
      // isError (fetchError) tidak pernah true dan kartu error + tombol
      // "Coba Lagi" di bawah jadi dead code. Lempar agar React Query masuk
      // error state (retry bawaan 1× lalu UI error hidup); bentuk data
      // sukses tidak berubah.
      if (!res.ok) throw new Error(`Gagal memuat log habit (HTTP ${res.status})`);
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
  // Task 60-d (audit 59-b2 HIGH): kini PER-HABIT (bukan agregat jumlah) —
  // habit 'avoid' bersemantik TERBALIK: log completed = KAMBUH (gagal),
  // hari tanpa log = hari BERSIH (sukses). Dulu agregat counts membuat hari
  // kambuh tampil hijau 100% dan hari bersih tampil "belum ada data"
  // (kebalikan dari tracker/dashboard — Task 39 #4 tertinggal di kalender).
  const habitLogMap = useMemo(() => {
    const map: Record<string, Record<string, boolean>> = {};
    habitLogs.forEach((log) => {
      const key = log.date?.slice(0, 10);
      if (!key || !log.habitId) return;
      (map[key] ||= {})[log.habitId] = !!log.completed;
    });
    return map;
  }, [habitLogs]);

  // Task 60-c: predikat hari-libur per habit (interval permanen; tanpa cap
  // openEnd — kalender menilai hari lampau, interval terbuka hanya relevan
  // untuk hari berjalan yang juga di-guard vacationMode).
  const vacPredByHabit = useMemo(() => {
    const m = new Map<string, (ymd: string) => boolean>();
    for (const h of habits) {
      m.set(h.id, vacationDayPredicate(vacationIntervalsOf(h)));
    }
    return m;
  }, [habits]);

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
    // Task 60-c: habit yang sedang LIBUR pada hari itu juga tidak due —
    // dulu hari-hari libur mengecat heatmap merah 0% padahal habitnya
    // memang sedang diistirahatkan (interval permanen + mode aktif).
    const dueHabitsOnDay = (dayStr: string): Habit[] =>
      habits.filter((h) => {
        if (h.isArchived) return false;
        // BUGHUNT-54 (3-b #1): habit dijeda tidak dihitung "due" di kalender
        // (jangan menggelembungkan denominator heatmap saat habit dijeda).
        if (!h.isActive) return false;
        // Task 39 (#3): habit lulus (graduatedAt) tidak lagi "due" — tanpa
        // ini heatmap kalender menurun permanen setelah wisuda (3/4 padahal
        // semua habit berjalan selesai 3/3). Tracker & dashboard sudah
        // memfilter; kalender tertinggal.
        if (h.graduatedAt) return false;
        // Task 39 (#9): konversi Jakarta (bukan slice UTC) — startDate
        // adalah momen nyata; kejadian 00:00–06:59 Jakarta salah hari di UTC.
        const start = h.startDate ? jakartaYmdOf(h.startDate) : null;
        if (start && start > dayStr) return false;
        if (h.vacationMode || vacPredByHabit.get(h.id)?.(dayStr)) return false;
        return isScheduledOn(parseSchedule(h.scheduleJson), dayStr);
      });

    return days.map((d) => {
      const dayStr = format(d, 'yyyy-MM-dd');
      const dayLogs = habitLogMap[dayStr];
      const dLog = dailyLogMap[dayStr];
      const inMonth = isSameMonth(d, monthDate);
      const isFuture = isBefore(today, startOfDay(d)) && !isToday(d);

      // Task 60-d: sukses per-habit dengan semantik avoid INVERS — avoid
      // sukses = TIDAK kambuh; normal/amount sukses = log completed. Konsisten
      // dengan tracker (isSuccess), dashboard (activeToday), dan kalender dot.
      const dueHabits = inMonth && !isFuture ? dueHabitsOnDay(dayStr) : [];
      const totalHabitsOnDay = dueHabits.length;
      const completedCount = dueHabits.filter((h) => {
        const done = !!dayLogs?.[h.id];
        return h.habitType === 'avoid' ? !done : done;
      }).length;

      let completionRate: number | null = null;
      if (!inMonth || isFuture) {
        completionRate = null;
      } else if (totalHabitsOnDay > 0) {
        // Task 39 (#3 lanjutan): clamp 100 — log habit yang wisuda di hari
        // terakhirnya bisa membuat numerator > denominator (habit keluar
        // semesta due, lognya masih terhitung).
        completionRate = Math.min(100, Math.round((completedCount / totalHabitsOnDay) * 100));
      } else if (dayLogs && Object.values(dayLogs).some(Boolean)) {
        // Tidak ada habit due, tapi ada log completed (mis. habit yang lalu
        // diwisuda/dijeda setelah mencatat hari itu) → hari tetap hijau penuh.
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
        completedHabits: completedCount,
      };
    });
  }, [monthDate, habits, habitLogMap, dailyLogMap, weekStartsOn, vacPredByHabit]);

  // ── Ringkasan bulan ───────────────────────────────────────────────────
  const monthSummary = useMemo<MonthSummary>(() => {
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

  const retryFetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['habits'] });
    queryClient.invalidateQueries({ queryKey: ['daily-logs-month'] });
    queryClient.invalidateQueries({ queryKey: ['habit-logs-batch'] });
  }, [queryClient]);

  return {
    selectedMonth,
    setSelectedMonth,
    monthOptions,
    monthLabel,
    weekdays: WEEKDAYS,
    loading,
    fetchError,
    calendarDays,
    monthSummary,
    goToPrevMonth,
    goToNextMonth,
    retryFetch,
  };
}
