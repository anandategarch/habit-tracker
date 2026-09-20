'use client';

// components/habit-tracker/daily-tracker-habit-card-toggle.tsx — checkbox
// biner habit normal/avoid (habit amount TIDAK punya checkbox): lingkaran
// gradien teal→emerald / rose→red, ripple TASK 45 saat baru selesai, dan
// chip "+XP" melayang (Task 44).
// Dipecah dari daily-tracker-habit-card.tsx (Task 71-j) — handler haptic,
// confetti-origin, dan a11y role="checkbox" identik.

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { xpForHabit } from '@/lib/dashboard-helpers';
import type { Habit } from './daily-tracker-types';

interface HabitCardToggleProps {
  habit: Habit;
  isDone: boolean;
  isAvoid: boolean;
  isToggling: boolean;
  justCompleted: boolean;
  /** Mode atur urutan: interaksi toggle dimatikan. */
  dragMode: boolean;
  onToggleHabit?: (
    habit: Habit,
    event?: React.MouseEvent | React.KeyboardEvent,
  ) => void;
  onSetConfettiEl?: (el: HTMLElement | null) => void;
}

export function HabitCardToggle({
  habit,
  isDone,
  isAvoid,
  isToggling,
  justCompleted,
  dragMode,
  onToggleHabit,
  onSetConfettiEl,
}: HabitCardToggleProps) {
  const handleCheckboxClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (dragMode) return;
    // TASK 45 — haptic ringan (bila didukung perangkat): completion harus
    // terasa FISIK, <300ms, tanpa menunggu network. Guard feature-detect.
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(12);
    }
    // Set elemen asal confetti DULU (pola BUG-5) lalu toggle tanpa event —
    // parent memakai ref yang baru saja diset.
    onSetConfettiEl?.(e.currentTarget);
    onToggleHabit?.(habit);
  };

  const checkboxLabel = isAvoid
    ? `${habit.name} — tandai kambuh`
    : isDone
      ? `Batalkan selesai: ${habit.name}`
      : `Tandai selesai: ${habit.name}`;

  return (
    <span
      className={cn(
        'relative inline-grid place-items-center',
        justCompleted && 'anim-nav-icon-pop',
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={isDone}
        aria-label={checkboxLabel}
        disabled={isToggling || dragMode}
        onClick={handleCheckboxClick}
        className={cn(
          'relative grid h-11 w-11 shrink-0 place-items-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
          isToggling && 'animate-pulse',
        )}
      >
        {/* TASK 45 — ripple satu-tembakan: ring memancar dari
            tombol saat baru selesai (0.6s, reduced-motion aware).
            Pelengkap confetti + chip XP → completion terasa
            instant + satisfying tanpa animasi panjang. */}
        {justCompleted && isDone && (
          <span key={`ripple-${habit.id}`} aria-hidden="true" className="rt-check-ripple" />
        )}
        <span
          className={cn(
            'grid h-7 w-7 place-items-center rounded-full border-2 transition-all duration-200',
            isDone
              ? isAvoid
                ? 'border-transparent bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-[0_0_14px_-2px_rgba(244,63,94,0.65)]'
                : 'border-transparent bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-[0_0_16px_-2px_rgba(16,185,129,0.75)]'
              : cn(
                  'border-muted-foreground/40 bg-transparent',
                  isAvoid
                    ? 'hover:border-rose-500/70'
                    : 'hover:border-teal-500/70',
                ),
          )}
        >
          {isDone && <Check className="h-4 w-4" strokeWidth={3.5} />}
        </span>
      </button>
      {/* Task 44 — reward XP terlihat: muncul HANYA untuk habit
          normal yang baru saja diselesaikan (avoid = kambuh,
          tidak berhak XP; amount = tanpa checkbox). Animasi
          0.75s naik-lalu-pudar (anim-xp-rise, reduced-motion
          aware). aria-hidden: informasi XP sudah dibawa toast. */}
      {justCompleted && !isAvoid && isDone && (
        <span
          key={`xp-${habit.id}`}
          aria-hidden="true"
          className="anim-xp-rise pointer-events-none absolute -top-1 right-0 whitespace-nowrap text-[11px] font-bold text-emerald-600 dark:text-emerald-400"
        >
          +{xpForHabit(habit)} XP
        </span>
      )}
    </span>
  );
}
