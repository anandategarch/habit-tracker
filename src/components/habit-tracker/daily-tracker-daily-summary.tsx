// ---------------------------------------------------------------------------
// DailySummary — 4 KPI cards row (Completed / XP Today / Streak / Level XP)
// Extracted from daily-tracker.tsx during SPLIT-PHASE3.
//
// PREMIUM REDESIGN (Rutina Aurora / Task 2-b, light polish): accent chips
// harmonized with the new KpiCard chip colors (teal / amber / rose / violet),
// the progress mini-bar now uses `.premium-progress-fill` (gradient), and the
// streak KPI gets an animated flame icon (`anim-flame-pulse`) so the streak
// feels alive instead of a static "1 hari". All numbers/props unchanged.
// ---------------------------------------------------------------------------

'use client';

import { Check, Zap, Flame, Star } from 'lucide-react';
import { CountUpNumber } from '@/components/habit-tracker/count-up';
import { FlashNumber } from '@/components/habit-tracker/flash-number';
import { cn } from '@/lib/utils';
import { KpiCard } from './daily-tracker-kpi-card';

export function DailySummary({
  completedCount,
  totalCount,
  completionPct,
  todayXP,
  bestStreak,
}: {
  completedCount: number;
  totalCount: number;
  completionPct: number;
  todayXP: number;
  bestStreak: number;
}) {
  // Streak flame (VLM critique #3): pulses while a streak is active so the
  // KPI reads as a living chain, not a placeholder number.
  const StreakFlameIcon = ({ className }: { className?: string }) => (
    <Flame className={cn(className, bestStreak > 0 && 'anim-flame-pulse')} />
  );

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        icon={Check}
        label="Selesai"
        accent="green"
        staggerIndex={0}
        value={
          <span>
            <FlashNumber value={completedCount} />
            <span className="text-sm font-semibold text-muted-foreground">
              /{totalCount}
            </span>
          </span>
        }
        sub={
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
              <span
                className="premium-progress-fill block h-full rounded-full transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </span>
            <span className="text-primary font-semibold tabular-nums">
              {completionPct}%
            </span>
          </span>
        }
      />
      <KpiCard
        icon={Zap}
        label="XP Hari Ini"
        accent="orange"
        staggerIndex={1}
        value={
          <span>
            <CountUpNumber value={todayXP} />
            <span className="text-sm font-semibold text-muted-foreground"> XP</span>
          </span>
        }
        sub={<span className="text-amber-600 dark:text-amber-400">kumpulkan lebih banyak untuk naik level</span>}
      />
      <KpiCard
        icon={StreakFlameIcon}
        label="Streak"
        accent="rose"
        staggerIndex={2}
        value={
          <span>
            <CountUpNumber value={bestStreak} />
            <span className="text-sm font-semibold text-muted-foreground ml-1.5">
              hari
            </span>
          </span>
        }
        sub={
          <span className="text-rose-600 dark:text-rose-400">
            {bestStreak >= 7 ? 'Terasa panas! 🔥' : bestStreak > 0 ? 'Teruskan!' : 'Mulai hari ini'}
          </span>
        }
      />
      <KpiCard
        icon={Star}
        label="XP"
        accent="amber"
        staggerIndex={3}
        value={
          <span>
            <FlashNumber value={todayXP} />
            <span className="text-sm font-semibold text-muted-foreground ml-1">XP</span>
          </span>
        }
        sub={<span className="text-violet-600 dark:text-violet-400">Lv {Math.floor(todayXP / 100) + 1} · {todayXP % 100}/100</span>}
      />
    </section>
  );
}
