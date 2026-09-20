'use client';

// components/habit-tracker/use-daily-stats.ts — KPI harian tab Tracker:
// "Selesai X/Y" + persentase (semantik avoid PHASE3-HABIT), XP Hari Ini
// (Task 60-e semesta penuh + avoid tanpa XP), XP total, dan streak terbaik.
//
// Task 71-c (split god file): DIEKSTRAKSI dari daily-tracker.tsx — deps
// memo/callback identik. monthLogsCache kini dikirim sebagai NILAI (bukan
// ref) dari body komponen — baca ref.current di dalam callback useMemo
// memicu react-hooks/refs (aturan compiler yang tak bisa di-disable);
// semantik identik: nilai dibaca tiap render di komponen, memo tetap hanya
// menghitung ulang saat dep reaktifnya berubah (pola yang sama dengan
// prop monthLogsCache HabitGridSection).

import { useCallback, useMemo } from 'react';
import { xpForHabit } from '@/lib/dashboard-helpers';
import { parseSchedule } from '@/lib/habit-schedule';
import { computeStreak, vacationIntervalsOf } from './daily-tracker-helpers';
import type { Habit, HabitLog } from './daily-tracker-types';

export interface DailyStatsApi {
  completedCount: number;
  totalCount: number;
  completionPct: number;
  todayXP: number;
  totalXp: number;
  bestStreak: number;
}

export function useDailyStats(opts: {
  habits: Habit[];
  activeHabits: Habit[];
  trackableHabits: Habit[];
  selectedDate: string;
  completionMap: Record<string, boolean>;
  /** Nilai cache log bulan selectedDate — dibaca di body komponen pemanggil. */
  monthLogsCache: Record<string, HabitLog[]> | undefined;
}): DailyStatsApi {
  const { habits, activeHabits, trackableHabits, selectedDate, completionMap, monthLogsCache } = opts;

  // PHASE3-HABIT — for "avoid" habits, "success today" means NO relapse
  // (i.e. completionMap[h.id] is false). For "normal" + "amount" habits,
  // success = completionMap[h.id] is true. This derived flag drives the
  // daily summary's completedCount / completionPct / todayXP / bestStreak
  // so an avoid habit that wasn't checked today counts as a success.
  const isSuccess = useCallback(
    (h: Habit) => {
      const checked = !!(completionMap[h.id] ?? false);
      if (h.habitType === 'avoid') return !checked;
      return checked;
    },
    [completionMap],
  );
  const completedCount = trackableHabits.filter((h) => isSuccess(h)).length;
  const totalCount = trackableHabits.length;
  const completionPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const todayXP = useMemo(() => {
    // Task 60-e (audit 59-b2 MED — semesta & avoid):
    // (1) Semesta = SEMUA habit non-arsip (aktif + dijesa + lulus), persis
    //     xpHabits /api/dashboard — dulu memakai activeHabits sehingga "XP
    //     Hari Ini" TURUN tepat setelah menekan "Luluskan!"/menjeda habit
    //     yang barusan diselesaikan hari itu (lognya tetap ada tapi keluar
    //     dari semesta tracker). completionMap kini juga membawa habit
    //     lulus/dijesa (use-habit-completions Task 60-e).
    // (2) Log kambuh habit 'avoid' TIDAK dibayar XP — konsisten dengan
    //     kartu habit ("avoid tidak berhak XP", tanpa chip +XP) & toast
    //     kambuh; /api/dashboard todayXp memakai aturan yang sama.
    // "Selesai X/Y" & persentase tetap memakai isSuccess (avoid sukses =
    // TIDAK kambuh) lewat trackableHabits.
    return habits.reduce((sum, h) => {
      if (h.habitType !== 'avoid' && completionMap[h.id]) return sum + xpForHabit(h);
      return sum;
    }, 0);
  }, [habits, completionMap]);

  // GELOMBANG 1: XP TOTAL all-time — Level TIDAK lagi reset harian.
  // Sumber: completedLogCount per habit dari /api/habits × bobot difficulty
  // (lib) — agregat yang sama dengan kpi.totalXp /api/dashboard.
  const totalXp = useMemo(
    () => habits.reduce((sum, h) => sum + (h.completedLogCount ?? 0) * xpForHabit(h), 0),
    [habits],
  );

  // Best current streak across all active habits
  const bestStreak = useMemo(() => {
    // Cache bulan sengaja tidak masuk deps: completionMap (dep memo) adalah
    // pemicu re-render — identitas memo stabil (pola asli daily-tracker,
    // Task 38; perilaku diawetkan saat ekstraksi Task 71-c).
    const cache = monthLogsCache;
    if (!cache) return 0;
    let best = 0;
    for (const h of activeHabits) {
      const logs = cache[h.id] || [];
      // PHASE1-HABIT: pass vacationMode so vacationing habits' streaks don't
      // break during the pause.
      // PHASE3-HABIT: pass invert + startDate for "avoid" habits so the
      // streak counts consecutive days WITHOUT a relapse.
      // Task 37: pass schedule so non-scheduled days don't break the chain.
      // Task 60-c: pass vacation intervals (hari libur netral permanen).
      const s = computeStreak(logs, selectedDate, {
        onVacation: !!h.vacationMode,
        vacation: vacationIntervalsOf(h),
        invert: h.habitType === 'avoid',
        startDate: h.startDate,
        schedule: parseSchedule(h.scheduleJson),
      });
      if (s > best) best = s;
    }
    return best;
  }, [activeHabits, selectedDate, completionMap, monthLogsCache]);

  return { completedCount, totalCount, completionPct, todayXP, totalXp, bestStreak };
}
