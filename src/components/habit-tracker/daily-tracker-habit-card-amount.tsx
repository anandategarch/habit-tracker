'use client';

// components/habit-tracker/daily-tracker-habit-card-amount.tsx — seksi habit
// amount (GELOMBANG 1): label "X/target {unit} menuju target", stepper −/+
// (prop onAmountDelta; parent meng-clamp 0..target), dan bar progres.
// Dipecah dari daily-tracker-habit-card.tsx (Task 71-j) — JSX/aria identik.

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Habit } from './daily-tracker-types';

interface HabitCardAmountProps {
  habit: Habit;
  /** Nilai amount hari ini SUDAH di-clamp parent ke 0..target. */
  value: number;
  target: number;
  amountPct: number;
  isToggling: boolean;
  /** Mode atur urutan: interaksi stepper dimatikan. */
  dragMode: boolean;
  onAmountDelta?: (habit: Habit, delta: number, event?: React.MouseEvent) => void;
}

export function HabitCardAmount({
  habit,
  value,
  target,
  amountPct,
  isToggling,
  dragMode,
  onAmountDelta,
}: HabitCardAmountProps) {
  const amountLabel = value >= target
    ? `Target tercapai · ${value}/${target}${habit.unit ? ` ${habit.unit}` : ''}`
    : `${value}/${target}${habit.unit ? ` ${habit.unit}` : ''} menuju target`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            'text-xs tabular-nums',
            value >= target
              ? 'font-semibold text-emerald-600 dark:text-emerald-400'
              : 'text-muted-foreground',
          )}
        >
          {amountLabel}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (dragMode) return;
              onAmountDelta?.(habit, -1, e);
            }}
            aria-label={`Kurangi: ${habit.name}`}
            disabled={value <= 0 || isToggling || dragMode}
            className="h-10 w-10 rounded-full border border-border/70 grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted active:scale-90 transition-all disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (dragMode) return;
              onAmountDelta?.(habit, 1, e);
            }}
            aria-label={`Tambah: ${habit.name}`}
            disabled={isToggling || dragMode}
            className="h-10 w-10 rounded-full btn-primary-gradient grid place-items-center text-primary-foreground active:scale-90 transition-all disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div
        className="h-1.5 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-label={`Progres ${habit.name}`}
      >
        <div
          className="h-full rounded-full premium-progress-fill"
          style={{ width: `${Math.min(100, amountPct)}%` }}
        />
      </div>
    </div>
  );
}
