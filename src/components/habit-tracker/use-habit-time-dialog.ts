'use client';

// components/habit-tracker/use-habit-time-dialog.ts — state dialog konfirmasi
// waktu (habit trackTime) + router klik habit `handleHabitCheck`.
//
// Task 71-c (split god file): DIEKSTRAKSI VERBATIM dari daily-tracker.tsx —
// urutan cabang (guard tanggal future → redirect amount → baca mirror ref →
// dialog waktu vs langsung toggle) dan deps useCallback identik.

import { useCallback, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { toast } from 'sonner';
import { jakartaNowIso, jakartaNowParts } from '@/lib/timezone';
import type { Habit } from './daily-tracker-types';

export interface HabitTimeDialogOptions {
  selectedDate: string;
  todayStr: string;
  toggleHabit: (habit: Habit, completedAt: string | null, dateOverride?: string) => Promise<void>;
  handleAmountDelta: (
    habit: Habit,
    delta: number,
    event?: React.MouseEvent | React.KeyboardEvent,
  ) => Promise<void>;
  handleSetConfettiEl: (el: HTMLElement | null) => void;
  completionMapRef: MutableRefObject<Record<string, boolean>>;
}

export interface HabitTimeDialogApi {
  timeDialogHabit: Habit | null;
  setTimeDialogHabit: Dispatch<SetStateAction<Habit | null>>;
  manualDate: string;
  setManualDate: Dispatch<SetStateAction<string>>;
  manualTime: string;
  setManualTime: Dispatch<SetStateAction<string>>;
  timeSubmitting: boolean;
  handleHabitCheck: (
    habit: Habit,
    event?: React.MouseEvent | React.KeyboardEvent,
  ) => void;
  handleTimeDialogSubmit: (useNow: boolean) => Promise<void>;
}

export function useHabitTimeDialog(opts: HabitTimeDialogOptions): HabitTimeDialogApi {
  const {
    selectedDate,
    todayStr,
    toggleHabit,
    handleAmountDelta,
    handleSetConfettiEl,
    completionMapRef,
  } = opts;

  // ---- time dialog state ----
  const [timeDialogHabit, setTimeDialogHabit] = useState<Habit | null>(null);
  const [manualDate, setManualDate] = useState('');
  const [manualTime, setManualTime] = useState('');
  const [timeSubmitting, setTimeSubmitting] = useState(false);

  // ---- handlers ----
  // handleHabitCheck: gate tanggal future + rute amount→stepper, normal
  // trackTime→dialog waktu, sisanya langsung toggle.
  const handleHabitCheck = useCallback(
    (habit: Habit, event?: React.MouseEvent | React.KeyboardEvent) => {
      // FUTURE-DATE GUARD: the tracker grid is reachable for future dates
      // (DateNav arrows + calendar day-cell 1-click via openTrackerDate).
      // Checking a habit "tomorrow" writes a future HabitLog that silently
      // inflates streaks/milestones and shows up as already-done when that
      // day arrives. The manual time dialog already blocks future dates
      // (max attr on the date input) — block the checkbox path too.
      if (selectedDate > todayStr) {
        toast.error('Tidak bisa mencatat habit untuk tanggal yang akan datang');
        return;
      }
      // GELOMBANG 1: habit amount tidak binary — klik apa pun (badan kartu
      // atau jalur lama) dialihkan ke stepper +1 (defense in depth; kartu
      // amount memang tidak merender checkbox).
      // LOW-(b) KEPUTUSAN URUTAN: cek `amount` SELALU di depan `trackTime` →
      // habit amount+trackTime tetap STEPPER (bukan dialog waktu). Alasan:
      // progres numerik amount tidak boleh tergantung dialog; completedAt
      // amount di-set server saat value mencapai target (M3). Dialog waktu
      // hanya untuk habit binary (normal/avoid) yang trackTime — konsisten
      // di kartu (tanpa checkbox) dan parent (redirect ini).
      if (habit.habitType === 'amount') {
        void handleAmountDelta(habit, 1, event);
        return;
      }
      // PERF-REACT-1: baca lewat mirror ref (bukan completionMap langsung)
      // supaya identitas handleHabitCheck stabil lintas toggle — itulah yang
      // membuat React.memo di HabitCard benar-benar melewatkan kartu lain.
      const next = !(completionMapRef.current[habit.id] ?? false);
      if (!next) {
        toggleHabit(habit, null);
        return;
      }

      // Store the triggering element for confetti positioning (used in toggleHabit
      // after successful API response — ensures confetti only fires on actual completion).
      // For checkbox clicks, event.currentTarget is the checkbox; for card clicks,
      // it's the card div. Both are valid origins for the confetti burst.
      //
      // BUG-5 fix: only OVERWRITE the ref when an event is provided. The checkbox's
      // onClick handler sets confettiElRef to the checkbox button right before
      // onCheckedChange fires (which calls handleHabitCheck with no event). The
      // previous code did `confettiElRef.current = event ? ... : null`, which
      // overwrote the checkbox ref with null — defeating the FIX-BUGS-1 fix.
      if (event && 'currentTarget' in event) {
        handleSetConfettiEl(event.currentTarget as HTMLElement);
      }

      if (habit.trackTime) {
        // BUG-17 fix: use jakartaNowParts() (TZ-explicit) instead of
        // new Date().getHours()/getMinutes() (browser-local TZ). On a non-Jakarta
        // browser the local hours would be displayed but stored as Jakarta ISO,
        // causing the time picker to show the wrong initial value.
        const now = jakartaNowParts();
        setTimeDialogHabit(habit);
        setManualDate(selectedDate);
        setManualTime(
          `${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}`,
        );
      } else {
        toggleHabit(habit, null);
      }
    },
    [toggleHabit, handleAmountDelta, handleSetConfettiEl, completionMapRef, selectedDate, todayStr],
  );

  const handleTimeDialogSubmit = useCallback(
    async (useNow: boolean) => {
      if (!timeDialogHabit) return;
      setTimeSubmitting(true);
      try {
        let completedAtISO: string | null = null;
        if (useNow) {
          // BUG-17 fix: use jakartaNowIso() (returns ISO with +07:00 offset,
          // independent of browser TZ) instead of toLocalISO(new Date()) which
          // uses the browser's local offset.
          completedAtISO = jakartaNowIso();
        } else if (manualTime) {
          // BUG-17 fix: construct the ISO with +07:00 offset directly. The user
          // enters manualTime in Jakarta wall-clock (the rest of the app uses
          // Jakarta), so we just append the offset. Previously toLocalISO() was
          // used, which interpreted the input as browser-local TZ and produced
          // a different ISO on non-Jakarta browsers.
          completedAtISO = `${manualDate}T${manualTime}:00+07:00`;
        }
        // M2-fix: tanggal manual diteruskan sebagai dateOverride sehingga log
        // masuk ke hari yang dipilih user (completedAt dan date selaras).
        // Jalur "Sekarang" memakai default selectedDate (semantik lama).
        await toggleHabit(
          timeDialogHabit,
          completedAtISO,
          useNow ? undefined : manualDate,
        );
        setTimeDialogHabit(null);
      } catch {
        toast.error('Gagal menyimpan waktu');
      } finally {
        setTimeSubmitting(false);
      }
    },
    [timeDialogHabit, toggleHabit, manualDate, manualTime],
  );

  return {
    timeDialogHabit,
    setTimeDialogHabit,
    manualDate,
    setManualDate,
    manualTime,
    setManualTime,
    timeSubmitting,
    handleHabitCheck,
    handleTimeDialogSubmit,
  };
}
