// components/habit-tracker/use-scheduled-habits.ts — memo turunan jadwal
// (Task 37) + filter tampil (Semua/Belum/Selesai) + semesta trackable.
//
// Task 71-c (split god file): DIEKSTRAKSI VERBATIM dari daily-tracker.tsx —
// deps useMemo identik.

import { useMemo } from 'react';
import { isScheduledOn, nextScheduledYmd, nextOccurrenceLabel, parseSchedule } from '@/lib/habit-schedule';
import type { Habit } from './daily-tracker-types';

export interface ScheduledHabitsApi {
  /** Task 37: habit aktif yang jadwalnya = tanggal terpilih. */
  scheduledHabits: Habit[];
  /** Info "kapan habit tersembunyi muncul lagi" (maks 3, empty-state). */
  nextOccurrences: { id: string; name: string; emoji: string; label: string }[];
  /** Habit terjadwal setelah filter tampil (Semua/Belum/Selesai). */
  filteredHabits: Habit[];
  /** Habit terjadwal tanpa yang sedang libur (semesta X/Y harian). */
  trackableHabits: Habit[];
}

export function useScheduledHabits(opts: {
  activeHabits: Habit[];
  selectedDate: string;
  completionMap: Record<string, boolean>;
  viewFilter: 'all' | 'incomplete' | 'completed';
}): ScheduledHabitsApi {
  const { activeHabits, selectedDate, completionMap, viewFilter } = opts;

  // Task 37 — Jadwal Tampil: habit hanya muncul di hari terjadwalnya.
  // `activeHabits` tetap memuat SEMUA habit aktif (semesta XP & batas
  // kandidat); grid + KPI harian (X/Y, persentase) memakai `scheduledHabits`
  // supaya "4/10" tidak dihitung dari habit yang memang tidak dijadwalkan
  // hari ini.
  const scheduledHabits = useMemo(
    () => activeHabits.filter((h) => isScheduledOn(parseSchedule(h.scheduleJson), selectedDate)),
    [activeHabits, selectedDate],
  );

  // Info "kapan habit tersembunyi muncul lagi" untuk empty-state hari tanpa
  // jadwal (dihitung dari habit aktif yang TIDAK terjadwal hari ini).
  const nextOccurrences = useMemo(() => {
    const out: { id: string; name: string; emoji: string; label: string }[] = [];
    for (const h of activeHabits) {
      const sched = parseSchedule(h.scheduleJson);
      if (sched.kind === 'daily') continue;
      if (isScheduledOn(sched, selectedDate)) continue;
      const next = nextScheduledYmd(sched, selectedDate);
      if (!next) continue;
      const lbl = nextOccurrenceLabel(sched, next);
      if (!lbl) continue;
      out.push({ id: h.id, name: h.name, emoji: h.emoji, label: lbl });
    }
    return out.slice(0, 3);
  }, [activeHabits, selectedDate]);

  const filteredHabits = useMemo(() => {
    let list = scheduledHabits;
    if (viewFilter === 'completed')
      // PHASE3-HABIT: "Selesai" filter shows habits where the user succeeded
      // today. For avoid habits, success = NOT checked (no relapse).
      list = list.filter((h) => {
        const checked = !!(completionMap[h.id] ?? false);
        const success = h.habitType === 'avoid' ? !checked : checked;
        return success;
      });
    if (viewFilter === 'incomplete')
      // PHASE1-HABIT: vacation habits don't count as "incomplete" — they're
      // paused, not missed. Exclude them so the "Belum" filter never shows
      // vacationing habits.
      // PHASE3-HABIT: "Belum" filter shows habits where the user hasn't yet
      // succeeded today. For avoid habits, "not yet succeeded" = checked
      // (relapsed today).
      list = list.filter((h) => {
        const checked = !!(completionMap[h.id] ?? false);
        const success = h.habitType === 'avoid' ? !checked : checked;
        return !success && !h.vacationMode;
      });
    return list;
  }, [scheduledHabits, completionMap, viewFilter]);

  // PHASE1-HABIT: vacation habits don't count toward today's completion stats.
  // They're excluded from both completedCount and totalCount so the daily
  // summary's X/Y and percentage reflect only the habits the user is actually
  // expected to do today. Vacation habits still appear in the grid (with a
  // 🏖️ badge) when the "Semua" filter is active.
  // Task 37: semesta trackable = habit TERJADWAL tanggal itu (habit mingguan
  // tidak dijadwalkan hari ini tidak mengecilkan/membebani X/Y harian).
  const trackableHabits = useMemo(
    () => scheduledHabits.filter((h) => !h.vacationMode),
    [scheduledHabits],
  );

  return { scheduledHabits, nextOccurrences, filteredHabits, trackableHabits };
}
