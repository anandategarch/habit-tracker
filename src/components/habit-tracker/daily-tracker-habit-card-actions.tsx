'use client';

// components/habit-tracker/daily-tracker-habit-card-actions.tsx — tombol
// ikon di sisi kanan baris nama habit: Analisis waktu (VERIFY-48 — hanya
// habit trackTime) dan Riwayat 7 hari (flip kartu).
// Dipecah dari daily-tracker-habit-card.tsx (Task 71-j) — JSX/aria identik.

import { BarChart3, History } from 'lucide-react';
import type { Habit } from './daily-tracker-types';

interface HabitCardActionsProps {
  habit: Habit;
  onOpenAnalysis?: (habitId: string) => void;
  /** Toggle wajah belakang (riwayat 7 hari). */
  onToggleHistory: () => void;
}

export function HabitCardActions({
  habit,
  onOpenAnalysis,
  onToggleHistory,
}: HabitCardActionsProps) {
  return (
    <>
      {/* VERIFY-48 (48-a #2): tombol analisis hanya untuk habit
          trackTime (pola today-habits) — untuk habit lain dialognya
          buntu "tidak mencatat waktu" tanpa aksi lanjutan. */}
      {habit.trackTime && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenAnalysis?.(habit.id);
          }}
          aria-label={`Analisis waktu: ${habit.name}`}
          title="Analisis waktu"
          className="h-10 w-10 rounded-full grid place-items-center text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <BarChart3 className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleHistory();
        }}
        aria-label={`Riwayat 7 hari: ${habit.name}`}
        title="Riwayat 7 hari"
        className="h-10 w-10 rounded-full grid place-items-center text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <History className="h-3.5 w-3.5" />
      </button>
    </>
  );
}
