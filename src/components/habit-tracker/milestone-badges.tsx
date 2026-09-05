'use client';

// ─────────────────────────────────────────────────────────────────────────────
// PHASE3-HABIT — Streak Milestone Badges
// ─────────────────────────────────────────────────────────────────────────────
//
// Small badge row showing achieved streak milestones (10/30/100/365 days).
// Achieved milestones are colored; unachieved are grayed out.
//
// The milestone "10 days" uses 🔟 (keycap 10), 30 uses 🏅 (sports medal),
// 100 uses 💯 (keycap 100), 365 uses 🏆 (trophy). This matches the spec.
//
// The `streak` prop is the CURRENT streak (passed from the parent habit card).
// We compare against it to determine which milestones are achieved.
//
// Optimization: we don't fetch the all-time longest streak from the API on
// every render — that would be expensive (the habit card grid renders many
// cards). Instead we use the current streak as a proxy. The parent passes
// the current streak; if a user previously hit 100 days but currently has
// only 5, only the 10-day milestone (if current >= 10) would show as
// achieved. This is acceptable: the badges are meant to celebrate the
// *current* streak, not historical best. (The comment on
// computeLongestStreak describes how to fetch the all-time best if needed.)
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { computeLongestStreak } from './daily-tracker-helpers';
import type { HabitLog } from './daily-tracker-types';

interface MilestoneBadgesProps {
  habitId: string;
  /** Current streak (used as a fallback if longest-streak fetch fails). */
  streak: number;
  habitType: 'normal' | 'avoid' | 'amount';
  /** Habit's creation date (ISO string). Bounds the avoid-habit streak. */
  startDate: string;
  className?: string;
}

interface Milestone {
  threshold: number;
  emoji: string;
  label: string;
  achievedClass: string;
  unachievedClass: string;
}

const MILESTONES: Milestone[] = [
  {
    threshold: 10,
    emoji: '🔟',
    label: '10 hari',
    achievedClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 ring-emerald-500/40',
    unachievedClass: 'bg-muted/60 text-muted-foreground/50 ring-transparent',
  },
  {
    threshold: 30,
    emoji: '🏅',
    label: '30 hari',
    achievedClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 ring-sky-500/40',
    unachievedClass: 'bg-muted/60 text-muted-foreground/50 ring-transparent',
  },
  {
    threshold: 100,
    emoji: '💯',
    label: '100 hari',
    achievedClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ring-amber-500/40',
    unachievedClass: 'bg-muted/60 text-muted-foreground/50 ring-transparent',
  },
  {
    threshold: 365,
    emoji: '🏆',
    label: '365 hari',
    achievedClass: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300 ring-fuchsia-500/40',
    unachievedClass: 'bg-muted/60 text-muted-foreground/50 ring-transparent',
  },
];

export function MilestoneBadges({
  habitId,
  streak,
  habitType,
  startDate,
  className,
}: MilestoneBadgesProps) {
  // Fetch the habit's full-year logs to compute the all-time longest streak.
  // We use the current year — for habits older than a year, this is an
  // approximation (we'd miss milestones achieved in previous years). To keep
  // the request cheap we only fetch the current year. The query is enabled
  // lazily (only when the card is flipped — the parent renders the back
  // face on demand). Since the card back is always mounted (just hidden via
  // CSS backface-visibility), the query fires on mount. staleTime 5 min
  // keeps refetches cheap.
  const currentYear = new Date().getFullYear().toString();
  const { data: yearLogs } = useQuery<HabitLog[]>({
    queryKey: ['habit-year-logs', habitId, currentYear],
    queryFn: async () => {
      const res = await fetch(`/api/habits/${habitId}/logs?year=${currentYear}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Compute longest streak from the year logs (with avoid-habit inversion).
  // Falls back to the current `streak` prop if logs aren't loaded yet.
  const longest = yearLogs
    ? computeLongestStreak(yearLogs, {
        invert: habitType === 'avoid',
        startDate,
      })
    : streak;

  // Use the max of (current streak, longest-ever) so the badges reflect
  // both in-progress and historical achievements.
  const effectiveStreak = Math.max(streak, longest);

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-0.5">
        Milestone
      </span>
      {MILESTONES.map((m) => {
        const achieved = effectiveStreak >= m.threshold;
        return (
          <span
            key={m.threshold}
            title={
              achieved
                ? `${m.label} tercapai! 🎉`
                : `${m.label} — ${Math.max(0, m.threshold - effectiveStreak)} hari lagi`
            }
            className={cn(
              'inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full ring-1 transition-all',
              achieved ? m.achievedClass : m.unachievedClass,
            )}
          >
            <span className={cn('text-xs', !achieved && 'opacity-50 grayscale')}>
              {m.emoji}
            </span>
            <span className="tabular-nums hidden sm:inline">{m.threshold}</span>
          </span>
        );
      })}
    </div>
  );
}
