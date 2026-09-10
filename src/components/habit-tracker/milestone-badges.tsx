'use client';

// components/habit-tracker/milestone-badges.tsx — lencana streak milestone
// client-side (3/7/14/30/100/365 hari).
//
// Modular & kecil (belum dipakai komponen lain — siap dipakai tracker/
// dashboard): menerima `streak` langsung, atau daftar HabitLog (mis. hasil
// /api/habits/[id]/year-logs) yang dikonversi ke streak Jakarta via
// computeStreakFromSet.

import { Flame, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeStreakFromSet } from '@/lib/dashboard-helpers';
import { jakartaDateString } from '@/lib/timezone';
import type { HabitLog } from './daily-tracker-types';

/** Threshold lencana streak (hari). */
export const MILESTONE_THRESHOLDS = [3, 7, 14, 30, 100, 365] as const;

/** Streak hari berturut-turut dari daftar log (kunci YMD UTC-midnight). */
export function streakFromLogs(logs: HabitLog[]): number {
  const doneDays = new Set(
    logs.filter((l) => l.completed).map((l) => String(l.date).slice(0, 10)),
  );
  return computeStreakFromSet(doneDays, jakartaDateString());
}

export interface MilestoneBadgesProps {
  /** Streak hari saat ini. */
  streak: number;
  className?: string;
}

export function MilestoneBadges({ streak, className }: MilestoneBadgesProps) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      role="group"
      aria-label={`Lencana streak milestone — streak saat ini ${streak} hari`}
    >
      {MILESTONE_THRESHOLDS.map((t) => {
        const unlocked = streak >= t;
        return (
          <span
            key={t}
            title={unlocked ? `Streak ${t} hari tercapai` : `Terbuka saat streak ${t} hari`}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums',
              unlocked
                ? 'border-amber-500/35 bg-gradient-to-br from-amber-400/20 to-orange-500/20 text-amber-600 dark:text-amber-400'
                : 'border-border bg-muted/40 text-muted-foreground/70',
            )}
          >
            {unlocked ? (
              <Flame className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Lock className="h-2.5 w-2.5" aria-hidden="true" />
            )}
            {t} hari
          </span>
        );
      })}
    </div>
  );
}

/** Varian dari daftar log (year-logs) — streak dihitung client-side. */
export function MilestoneBadgesFromLogs({ logs }: { logs: HabitLog[] }) {
  return <MilestoneBadges streak={streakFromLogs(logs)} />;
}
