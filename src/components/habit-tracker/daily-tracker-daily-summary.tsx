// ---------------------------------------------------------------------------
// DailySummary — 4 KPI cards row (Completed / XP Today / Streak / Level XP)
// Extracted from daily-tracker.tsx during SPLIT-PHASE3.
// ---------------------------------------------------------------------------

'use client';

import { Check, Zap, Flame, Star } from 'lucide-react';
import { CountUpNumber } from '@/components/habit-tracker/count-up';
import { FlashNumber } from '@/components/habit-tracker/flash-number';
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
            <span className="text-sm font-medium text-muted-foreground">
              /{totalCount}
            </span>
          </span>
        }
        sub={
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1 flex-1 rounded-full bg-muted overflow-hidden">
              <span
                className="block h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </span>
            <span className="text-primary font-medium">
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
            <span className="text-sm font-medium text-muted-foreground"> XP</span>
          </span>
        }
        sub={<span className="text-orange-600 dark:text-orange-400">kumpulkan lebih banyak untuk naik level</span>}
      />
      <KpiCard
        icon={Flame}
        label="Streak"
        accent="rose"
        staggerIndex={2}
        value={
          <span>
            <CountUpNumber value={bestStreak} />
            <span className="text-sm font-medium text-muted-foreground ml-1.5">
              {bestStreak === 1 ? ' hari' : ' hari'}
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
            <span className="text-sm font-medium text-muted-foreground ml-1">XP</span>
          </span>
        }
        sub={<span className="text-warning dark:text-warning/80">Lv {Math.floor(todayXP / 100) + 1} · {todayXP % 100}/100</span>}
      />
    </section>
  );
}
