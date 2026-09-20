'use client';

// components/habit-tracker/daily-tracker-habit-card-graduation.tsx — seksi
// "Target Lulus" (Task 36): garis finis habit yang bisa DISELESAIKAN —
// progres menuju wisuda, lalu tombol Lulus (confetti dari elemen tombol).
// Habit tipe "senang memulai, susah menyelesaikan" butuh finis yang nyata.
// Dipecah dari daily-tracker-habit-card.tsx (Task 71-j) — identik; render
// null bila habit tidak punya target lulus (seperti guard && lama).

import { GraduationCap } from 'lucide-react';
import type { Habit } from './daily-tracker-types';

interface HabitCardGraduationProps {
  habit: Habit;
  isAvoid: boolean;
  isToggling: boolean;
  /** Mode atur urutan: tombol lulus dimatikan. */
  dragMode: boolean;
  /** Task 36 — wisudakan habit (tombol muncul saat progres target tercapai). */
  onGraduate?: (habit: Habit, el: HTMLElement | null) => void;
}

export function HabitCardGraduation({
  habit,
  isAvoid,
  isToggling,
  dragMode,
  onGraduate,
}: HabitCardGraduationProps) {
  // ── Task 36: Target Lulus — progres menuju garis finis habit. Habit lulus
  // sudah tidak dirender tracker (difilter parent), jadi di sini hanya dua
  // keadaan: masih mengejar target, atau SIAP diwisuda.
  const hasGraduationTarget = !isAvoid && !!habit.targetDays && !habit.graduatedAt;
  const gradTarget = Math.max(1, habit.targetDays ?? 1);
  const gradDone = habit.completedLogCount ?? 0;
  const gradPct = Math.min(100, Math.round((gradDone / gradTarget) * 100));
  const readyToGraduate = hasGraduationTarget && gradDone >= gradTarget;

  if (!hasGraduationTarget) return null;

  return readyToGraduate ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (dragMode) return;
        onGraduate?.(habit, e.currentTarget);
      }}
      disabled={isToggling || dragMode}
      aria-label={`Luluskan habit ${habit.name} — target ${gradTarget} hari tercapai`}
      className="w-full h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white font-semibold text-xs sm:text-sm grid place-items-center gap-1.5 grid-flow-col shadow-[0_6px_18px_-6px_rgba(245,158,11,0.55)] hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 anim-micro-pulse"
    >
      <GraduationCap className="h-4.5 w-4.5" aria-hidden="true" />
      Target {gradTarget} hari tercapai — Luluskan!
    </button>
  ) : (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground tabular-nums inline-flex items-center gap-1">
          <GraduationCap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          {gradDone}/{gradTarget} hari menuju lulus
        </p>
        <span className="text-[10px] font-semibold text-muted-foreground/80 tabular-nums">
          {gradPct}%
        </span>
      </div>
      <div
        className="h-1.5 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={gradDone}
        aria-valuemin={0}
        aria-valuemax={gradTarget}
        aria-label={`Progres lulus ${habit.name}`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
          style={{ width: `${gradPct}%` }}
        />
      </div>
    </div>
  );
}
