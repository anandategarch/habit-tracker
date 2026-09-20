'use client';

// components/habit-tracker/daily-tracker-habit-card-meta-badges.tsx — baris
// meta di bawah nama habit: chip kategori, chip Hari Aman (🛡, Task 36),
// chip Libur, chip jadwal (Task 37), dan jam selesai.
// Dipecah dari daily-tracker-habit-card.tsx (Task 71-j) — JSX/aria identik.

import { CalendarDays, Clock3, Shield } from 'lucide-react';
import { scheduleLabel, type HabitSchedule } from '@/lib/habit-schedule';
import type { Habit } from './daily-tracker-types';
import type { StreakDetail } from './daily-tracker-helpers';

interface HabitCardMetaBadgesProps {
  habit: Habit;
  isAvoid: boolean;
  isScheduledDaily: boolean;
  schedule: HabitSchedule;
  doneTime: string | null;
  streakInfo: StreakDetail;
}

export function HabitCardMetaBadges({
  habit,
  isAvoid,
  isScheduledDaily,
  schedule,
  doneTime,
  streakInfo,
}: HabitCardMetaBadgesProps) {
  return (
    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
      <span className="inline-flex items-center rounded-full border border-border/70 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {habit.category}
      </span>
      {/* Task 36 — chip Hari Aman: sisa kuota bolong yang diampuni */}
      {/* bulan ini (2/bulan). Tooltip menjelaskan aturannya. */}
      {!isAvoid && (
        <span
          title={`Hari Aman: 2 hari kosong per bulan tidak memutus streak — sisa bulan ini ${streakInfo.shieldsLeftThisMonth}.`}
          className="inline-flex items-center gap-0.5 rounded-full bg-teal-500/10 dark:bg-teal-400/10 text-teal-700 dark:text-teal-300 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider tabular-nums"
        >
          <Shield className="h-2.5 w-2.5" aria-hidden="true" />
          {streakInfo.shieldsLeftThisMonth}
        </span>
      )}
      {habit.vacationMode && (
        <span className="inline-flex items-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider">
          🏖 Libur
        </span>
      )}
      {/* Task 37 — chip jadwal: hari/tanggal tempat habit tampil. */}
      {!isScheduledDaily && (
        <span
          title={`Jadwal: ${scheduleLabel(schedule)}`}
          className="inline-flex items-center gap-0.5 rounded-full bg-teal-500/10 dark:bg-teal-400/10 text-teal-700 dark:text-teal-300 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider max-w-[7.5rem]"
        >
          <CalendarDays className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
          <span className="truncate normal-case">{scheduleLabel(schedule)}</span>
        </span>
      )}
      {doneTime && (
        <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5 tabular-nums">
          <Clock3 className="h-3 w-3" aria-hidden="true" />
          Selesai {doneTime}
        </span>
      )}
    </div>
  );
}
