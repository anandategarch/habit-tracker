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

import { memo } from 'react';
import { Check, Clock, RotateCw, Ban, BarChart3 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { FlipCard } from '@/components/habit-tracker/flip-card';
import { StreakFlame } from '@/components/habit-tracker/streak-flame';
import { cn } from '@/lib/utils';
import { getBadgeClass } from '@/lib/label-colors';
import { ProgressRing } from './daily-tracker-progress-ring';
import { MilestoneBadges } from './milestone-badges';
import { ShareButton } from './share-card';
import {
  getCategoryStyle,
  computeStreak,
  computeStrengthScore,
  getStrengthTier,
  getLast7DaysStatus,
  timeDiffMinutes,
} from './daily-tracker-helpers';
import type { Habit, HabitLog } from './daily-tracker-types';

export interface HabitCardProps {
  habit: Habit;
  idx: number;
  /** Raw checkbox state — for avoid habits, true = RELAPSE (not success). */
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

// PERF-REACT-1 fix: wrapped with React.memo so the card only re-renders when
// its own props change. Combined with the stable useCallback handlers in the
// parent (daily-tracker.tsx), this means:
//   - Typing in the Daily Notes textarea → no HabitCard re-renders
//     (notes state changes, but no HabitCard prop changes)
//   - Toggling one habit → only that habit's card re-renders
//     (its isDone prop changes; sibling cards' props are unchanged)
// Previously every keystroke re-rendered every card in the grid because the
// parent re-rendered and the inline-arrow props (onSetConfettiEl,
// onOpenAnalysis) were fresh identities every render.
export const HabitCard = memo(function HabitCard({
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
  // PHASE3-HABIT: for avoid habits, "isDone" (raw checkbox state) means a
  // RELAPSE happened today. Success = NOT relapsed. The card visualization
  // is inverted: green when success (no relapse), red when relapsed.
  const isAvoid = habit.habitType === 'avoid';
  const isRelapsed = isAvoid && isDone;
  const isSuccess = isAvoid ? !isDone : isDone;
  const pct = isSuccess ? 100 : 0;
  // BUG-18 fix: return 0 when no cache (was _count.logs which is the total
  // log count, not a streak — completely unrelated and could show e.g. "47"
  // instead of the actual streak).
  // PHASE1-HABIT: pass vacationMode so the streak doesn't break during a
  // vacation pause (today is treated as auto-completed).
  // PHASE3-HABIT: pass invert + startDate for "avoid" habits so the streak
  // counts consecutive days WITHOUT a relapse.
  const onVacation = !!habit.vacationMode;
  const streak = monthLogs
    ? computeStreak(monthLogs, selectedDate, {
        onVacation,
        invert: isAvoid,
        startDate: habit.startDate,
      })
    : 0;
  // PHASE1-HABIT: strength score (0-100) over the last 30 days. Additional
  // to the streak — does NOT replace it. Vacation habits get +1 day credit
  // so the score doesn't tank during a deliberate pause.
  // PHASE3-HABIT: pass habitType so the score inverts for avoid habits
  // (clean days / total days).
  const strength = monthLogs
    ? computeStrengthScore(monthLogs, habit, 30, selectedDate)
    : 0;
  const strengthTier = getStrengthTier(strength);
  const isLate =
    !!doneTime && !!habit.targetTime && doneTime > habit.targetTime;

  // ANIM-3 / Feature 6: derive last-7-days status + total logs for the
  // FlipCard back face. Reuses the same month cache that computeStreak uses
  // (so the front streak and back mini-calendar stay in sync). Days outside
  // the cached month are treated as not-done — acceptable for a quick stats
  // view.
  // PHASE3-HABIT: for avoid habits, "done" = clean (no relapse log).
  const last7Days = getLast7DaysStatus(monthLogs, todayStr, { invert: isAvoid });
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
            // PHASE3-HABIT: avoid habits show red when relapsed (checked),
            // green when successful (unchecked). Normal/amount habits stay
            // green when completed.
            isRelapsed
              ? 'habit-card-relapsed'
              : isSuccess && 'habit-card-completed',
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
                // For avoid habits, a checked checkbox is red (relapse).
                // For normal/amount habits, a checked checkbox is primary.
                isDone && !isAvoid &&
                  'data-[state=checked]:bg-primary data-[state=checked]:border-primary',
                isDone && isAvoid &&
                  'data-[state=checked]:bg-destructive data-[state=checked]:border-destructive',
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
                    : 'Klik untuk analisis waktu'
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
            {/* PHASE1-HABIT: vacation badge */}
            {habit.vacationMode && (
              <span
                className="inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                title={
                  habit.vacationEnd
                    ? `Liburan sampai ${habit.vacationEnd.split('T')[0]}`
                    : 'Liburan (tanpa batas)'
                }
              >
                🏖️ Liburan
              </span>
            )}
            {/* PHASE3-HABIT: avoid-type badge */}
            {isAvoid && (
              <span
                className="inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                title="Habit tipe 'Hindari' — centang = kambuh"
              >
                <Ban className="h-3 w-3" />
                Hindari
              </span>
            )}
          </div>

          {/* Circular Progress + Streak */}
          <div className="flex items-center justify-between">
            <ProgressRing
              progress={pct}
              color={isRelapsed ? '#ef4444' : catStyle.hex}
              done={isSuccess}
              primaryColor={isAvoid ? '#ef4444' : primaryColor}
            />
            <div className="text-right">
              {isSuccess ? (
                <span
                  className={cn(
                    'text-[11px] font-semibold flex items-center gap-1 justify-end',
                    isAvoid
                      ? 'text-success dark:text-success/80'
                      : 'text-primary',
                  )}
                >
                  <Check className="h-3 w-3" />
                  {isAvoid ? 'Bersih' : 'Selesai'}
                </span>
              ) : isRelapsed ? (
                <span className="text-[11px] font-semibold text-destructive flex items-center gap-1 justify-end">
                  <Ban className="h-3 w-3" /> Kambuh
                </span>
              ) : habit.vacationMode ? (
                <span className="text-[11px] font-medium text-sky-600 dark:text-sky-400 flex items-center gap-1 justify-end">
                  🏖️ Liburan
                </span>
              ) : (
                <span className="text-[11px] font-medium text-muted-foreground">
                  {isAvoid ? 'Bersih hari ini' : 'Belum dimulai'}
                </span>
              )}
              <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-0.5 justify-end tabular-nums">
                <StreakFlame streak={streak} size="sm" strength={strength} />
                {streak} {streak === 1 ? 'hari' : 'hari'}
              </p>
              {/* PHASE1-HABIT: strength bar (0-100%) */}
              <div className="flex items-center gap-1 mt-1 justify-end">
                <div className="h-1 w-12 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      strengthTier.barClass,
                    )}
                    style={{ width: `${strength}%` }}
                  />
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium tabular-nums',
                    strengthTier.colorClass,
                  )}
                  title={`Kekuatan: ${strength}% (${strengthTier.label})`}
                >
                  {strength}%
                </span>
              </div>
            </div>
          </div>
        </Card>
      }
      back={
        <Card
          className={cn(
            'p-5 gap-0 h-full flex flex-col overflow-hidden',
            // PHASE3-HABIT: avoid habits show red on the back when relapsed.
            isRelapsed
              ? 'habit-card-relapsed'
              : isSuccess && 'habit-card-completed',
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
              7 hari terakhir
            </p>
            <div className="flex items-center gap-1">
              {last7Days.map((day, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex-1 h-7 rounded-md flex items-center justify-center text-[10px] font-semibold tabular-nums',
                    day.done
                      ? isAvoid
                        ? 'bg-success text-success-foreground'
                        : 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground/60',
                  )}
                >
                  {day.dateNum}
                </div>
              ))}
            </div>
          </div>

          {/* PHASE3-HABIT: Milestone Badges (10/30/100/365 days).
              Shows achieved milestones in color, unachieved in gray.
              Uses the habit's all-time longest streak. */}
          <MilestoneBadges
            habitId={habit.id}
            streak={streak}
            habitType={habit.habitType}
            startDate={habit.startDate}
          />

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mt-auto">
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Total log
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
                <StreakFlame streak={streak} size="sm" strength={strength} />
                {streak}d
              </p>
            </div>
            {/* PHASE1-HABIT: strength score */}
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Kekuatan
              </p>
              <p
                className={cn(
                  'text-sm font-bold tabular-nums',
                  strengthTier.colorClass,
                )}
                title={`${strengthTier.label} — ${strength}% dalam 30 hari`}
              >
                {strength}%
              </p>
            </div>
          </div>

          {/* PHASE3-HABIT: Share button + Analysis button — share generates a
              PNG image of the habit's progress; analysis opens the
              time-analysis dialog (which now includes the "Tahun" yearly
              heatmap view, available for ALL habits including non-trackTime). */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onOpenAnalysis(habit.id);
              }}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Analisis
            </Button>
            <ShareButton
              habit={habit}
              streak={streak}
              strength={strength}
              strengthTier={strengthTier}
              last7Days={last7Days}
            />
          </div>

          {/* Notes preview */}
          {habit.notes ? (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                Catatan
              </p>
              <p className="text-xs text-muted-foreground line-clamp-3">
                {habit.notes}
              </p>
            </div>
          ) : (
            <p className="mt-3 pt-3 border-t border-border text-[10px] text-muted-foreground/60 italic">
              Ketuk untuk membalik
            </p>
          )}
        </Card>
      }
    />
  );
});
