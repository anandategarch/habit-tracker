// ---------------------------------------------------------------------------
// HabitCard — FlipCard front/back for a single habit in the daily grid.
// Extracted from daily-tracker.tsx during SPLIT-PHASE3.
//
// This component is intentionally "dumb": all side-effecting callbacks
// (toggle habit, set confetti origin, open time-analysis dialog) are passed
// in as props from the parent orchestrator. The parent owns:
//   - completionMap, togglingIds, recentlyCompleted, completedAtMap
//   - confettiElRef (for confetti origin)
//   - setAnalysisHabitId (for time-analysis dialog)
//   - monthLogsCacheRef (whose current-month array is passed as `monthLogs`)
// ---------------------------------------------------------------------------

'use client';

import { Check, Clock, RotateCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FlipCard } from '@/components/habit-tracker/flip-card';
import { StreakFlame } from '@/components/habit-tracker/streak-flame';
import { cn } from '@/lib/utils';
import { getBadgeClass } from '@/lib/label-colors';
import { ProgressRing } from './daily-tracker-progress-ring';
import {
  getCategoryStyle,
  computeStreak,
  getLast7DaysStatus,
  timeDiffMinutes,
} from './daily-tracker-helpers';
import type { Habit, HabitLog } from './daily-tracker-types';

export interface HabitCardProps {
  habit: Habit;
  idx: number;
  isDone: boolean;
  isToggling: boolean;
  justCompleted: boolean;
  doneTime: string | null;
  /** Current month's cached logs for this habit (undefined = no cache yet). */
  monthLogs: HabitLog[] | undefined;
  selectedDate: string;
  todayStr: string;
  /** Color key from the category map (e.g. 'emerald', 'slate'). */
  categoryColor: string;
  /** Theme primary color (hex) for the ProgressRing "done" state. */
  primaryColor: string;
  onToggleHabit: (
    habit: Habit,
    event?: React.MouseEvent | React.KeyboardEvent,
  ) => void;
  /** Sets the confetti origin element on the parent's ref. */
  onSetConfettiEl: (el: HTMLElement | null) => void;
  /** Opens the time-analysis dialog for this habit. */
  onOpenAnalysis: (habitId: string) => void;
}

export function HabitCard({
  habit,
  idx,
  isDone,
  isToggling,
  justCompleted,
  doneTime,
  monthLogs,
  selectedDate,
  todayStr,
  categoryColor,
  primaryColor,
  onToggleHabit,
  onSetConfettiEl,
  onOpenAnalysis,
}: HabitCardProps) {
  const catStyle = getCategoryStyle(habit.category);
  const pct = isDone ? 100 : 0;
  // BUG-18 fix: return 0 when no cache (was _count.logs which is the total
  // log count, not a streak — completely unrelated and could show e.g. "47"
  // instead of the actual streak).
  const streak = monthLogs ? computeStreak(monthLogs, selectedDate) : 0;
  const isLate =
    !!doneTime && !!habit.targetTime && doneTime > habit.targetTime;

  // ANIM-3 / Feature 6: derive last-7-days status + total logs for the
  // FlipCard back face. Reuses the same month cache that computeStreak uses
  // (so the front streak and back mini-calendar stay in sync). Days outside
  // the cached month are treated as not-done — acceptable for a quick stats
  // view.
  const last7Days = getLast7DaysStatus(monthLogs, todayStr);
  const totalLogs = habit._count?.logs ?? 0;

  return (
    <FlipCard
      key={habit.id}
      className={cn(
        'anim-stagger',
        !justCompleted && 'anim-lift',
        justCompleted && 'habit-card-pop anim-check-pop',
      )}
      style={{ animationDelay: `${idx * 40}ms` }}
      front={
        <Card
          className={cn(
            'group cursor-pointer select-none p-5 gap-0 h-full transition-all hover:-translate-y-1 hover:shadow-md active:translate-y-0 active:scale-[0.99]',
            isDone && 'habit-card-completed',
          )}
        >
          {/* Checkbox top-right (stopPropagation: clicking it
              toggles the habit without flipping the card). */}
          <div className="absolute top-4 right-4 z-10">
            <Checkbox
              checked={isDone}
              onCheckedChange={() => onToggleHabit(habit)}
              disabled={isToggling}
              onClick={(e) => {
                e.stopPropagation();
                // Set confetti origin to the checkbox button itself,
                // since onCheckedChange doesn't receive a DOM event.
                onSetConfettiEl(e.currentTarget as HTMLElement);
              }}
              className={cn(
                'h-5 w-5 rounded-md transition-all duration-200',
                isDone &&
                  'data-[state=checked]:bg-primary data-[state=checked]:border-primary',
                justCompleted && 'animate-[ringPop_0.4s_ease]',
              )}
            />
          </div>

          {/* ANIM-3: Flip hint icon — top-left, pointer-events-none
              so taps pass through to the FlipCard flip handler. */}
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <RotateCw className="h-3.5 w-3.5 text-muted-foreground/40" />
          </div>

          {/* Icon + Category tint */}
          <div
            className={cn(
              'w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-3 transition-transform duration-300 group-hover:scale-110',
              catStyle.tint,
            )}
          >
            {habit.icon}
          </div>

          {/* Title */}
          <h4
            className={cn(
              'text-sm font-bold truncate pr-8 transition-all duration-200',
              isDone && 'line-through text-muted-foreground',
            )}
          >
            {habit.name}
          </h4>

          {/* Time + Category badge */}
          <div className="flex items-center gap-1.5 mt-1.5 mb-4 flex-wrap">
            {habit.targetTime && (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground tabular-nums">
                <Clock className="h-3 w-3" />
                {habit.targetTime}
              </span>
            )}
            {doneTime && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenAnalysis(habit.id);
                }}
                className={cn(
                  'inline-flex items-center gap-0.5 text-[11px] tabular-nums rounded px-1 py-0.5 hover:bg-accent transition-colors',
                  isLate
                    ? 'text-destructive dark:text-destructive/80'
                    : 'text-primary',
                )}
                title={
                  habit.targetTime
                    ? `Target: ${habit.targetTime}`
                    : 'Click for time analysis'
                }
              >
                <Check className="h-3 w-3" />
                {doneTime}
                {isLate &&
                  ` +${timeDiffMinutes(doneTime, habit.targetTime!)}m`}
              </button>
            )}
            <span
              className={cn(
                'inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded-full',
                getBadgeClass(categoryColor),
              )}
            >
              {habit.category}
            </span>
          </div>

          {/* Circular Progress + Streak */}
          <div className="flex items-center justify-between">
            <ProgressRing
              progress={pct}
              color={catStyle.hex}
              done={isDone}
              primaryColor={primaryColor}
            />
            <div className="text-right">
              {isDone ? (
                <span className="text-[11px] font-semibold text-primary flex items-center gap-1 justify-end">
                  <Check className="h-3 w-3" /> Done
                </span>
              ) : (
                <span className="text-[11px] font-medium text-muted-foreground">
                  Not started
                </span>
              )}
              <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-0.5 justify-end tabular-nums">
                <StreakFlame streak={streak} size="sm" />
                {streak} {streak === 1 ? 'day' : 'days'}
              </p>
            </div>
          </div>
        </Card>
      }
      back={
        <Card
          className={cn(
            'p-5 gap-0 h-full flex flex-col overflow-hidden',
            isDone && 'habit-card-completed',
          )}
        >
          {/* Header: icon + name + flip hint */}
          <div className="flex items-center gap-2 mb-3 min-w-0">
            <span className="text-lg shrink-0">{habit.icon}</span>
            <h4 className="text-sm font-bold truncate flex-1">
              {habit.name}
            </h4>
            <RotateCw className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          </div>

          {/* Last 7 days mini calendar */}
          <div className="mb-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
              Last 7 days
            </p>
            <div className="flex items-center gap-1">
              {last7Days.map((day, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex-1 h-7 rounded-md flex items-center justify-center text-[10px] font-semibold tabular-nums',
                    day.done
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground/60',
                  )}
                >
                  {day.dateNum}
                </div>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2 mt-auto">
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Total logs
              </p>
              <p className="text-sm font-bold tabular-nums">
                {totalLogs}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Streak
              </p>
              <p className="text-sm font-bold tabular-nums flex items-center gap-1">
                <StreakFlame streak={streak} size="sm" />
                {streak}d
              </p>
            </div>
          </div>

          {/* Notes preview */}
          {habit.notes ? (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                Notes
              </p>
              <p className="text-xs text-muted-foreground line-clamp-3">
                {habit.notes}
              </p>
            </div>
          ) : (
            <p className="mt-3 pt-3 border-t border-border text-[10px] text-muted-foreground/60 italic">
              Tap to flip back
            </p>
          )}
        </Card>
      }
    />
  );
}
