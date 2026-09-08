// ---------------------------------------------------------------------------
// GoalCard — single goal row in the Goals list.
// Extracted from goals.tsx during PHASE-A-3.
//
// This component is intentionally "dumb": all side-effecting callbacks
// (open edit form, complete, cancel, delete, toggle milestone, toggle
// expand) are passed in as props from the parent orchestrator. The parent
// owns:
//   - the goals query + mutation flow (handleSave / handleDelete /
//     toggleMilestone w/ BUG-M16 fix / handleCompleteGoal /
//     handleCancelGoal w/ BUG-L7 fix)
//   - the expandedId state (passed in as `expanded`)
//   - the priorityMap (from useHabitOptions)
//
// Wrapped with React.memo so toggling expand on one goal does not re-render
// the others.
// ---------------------------------------------------------------------------

'use client';

import { memo } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, differenceInCalendarDays, id as idLocale } from '@/lib/date-utils';
// PERF-FIX (FIX-TIER3 / Fix 15): replaced `date-fns` with native Intl-based
// utility module. Output is identical for the patterns and helpers used
// here ('d MMM yyyy' + differenceInCalendarDays) — verified via test
// script in worklog FIX-TIER3 entry.
import { getBadgeClass } from '@/lib/label-colors';
import { jakartaDateString } from '@/lib/jakarta-date';
import { parseMilestones, STATUS_STYLES, STATUS_LABELS, PRIORITY_LABELS } from './goals-helpers';
import type { Goal } from './goals-types';

export interface GoalCardProps {
  goal: Goal;
  /** Whether this card's milestones section is expanded. */
  expanded: boolean;
  /** Priority options map from useHabitOptions — only the `color` field is read. */
  priorityMap: Record<string, { color: string } | undefined>;
  onEdit: (goal: Goal) => void;
  onComplete: (goal: Goal) => void;
  onCancel: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  /**
   * Toggle a milestone's done state. The parent's implementation calls
   * `toggleMilestone(goal.id, index, goal.milestones, goal.status)` which
   * preserves the BUG-M16 fix (does not regress 'paused' status).
   */
  onToggleMilestone: (goal: Goal, milestoneIndex: number) => void;
  onToggleExpand: (goalId: string) => void;
}

export const GoalCard = memo(function GoalCard({
  goal,
  expanded,
  priorityMap,
  onEdit,
  onComplete,
  onCancel,
  onDelete,
  onToggleMilestone,
  onToggleExpand,
}: GoalCardProps) {
  const isExpanded = expanded;
  const milestones = parseMilestones(goal.milestones);
  const isCompleted = goal.status === 'completed';
  const isCancelled = goal.status === 'cancelled';
  // BUGFIX 6-a (BUG-M3 follow-up): the deadline is a UTC-midnight ISO
  // string. `new Date('yyyy-MM-dd')` ALSO parses as UTC midnight, so the
  // old `format(new Date(goal.deadline.slice(0, 10)), …)` rendered it in
  // the browser's LOCAL timezone — one day early for any browser west of
  // UTC (the original BUG-M3 fix didn't actually take effect). Build a
  // genuine LOCAL midnight Date from the YMD parts instead.
  const deadlineYMD = goal.deadline ? goal.deadline.slice(0, 10) : null;
  const deadlineDate = deadlineYMD
    ? (() => {
        const [y, m, d] = deadlineYMD.split('-').map(Number);
        return new Date(y, m - 1, d);
      })()
    : null;
  // BUGHUNT-OTHER-1 BUG-M4: `isPast(parseISO(deadline))` returns true the
  // moment "now" exceeds the UTC midnight of the deadline. For Jakarta
  // users, the deadline's UTC midnight = 07:00 WIB on the deadline day,
  // so goals would be marked overdue at 07:00 WIB on the deadline day
  // itself (a full day early). Instead, compare YMD strings: the goal is
  // overdue only when today's Jakarta date is strictly after the deadline
  // date. The deadline is stored as UTC midnight, so its YMD portion is
  // the user-meaningful calendar date.
  const isOverdue = (() => {
    if (!deadlineYMD || isCompleted || isCancelled) return false;
    return deadlineYMD < jakartaDateString();
  })();
  // Deadline within 7 days (not overdue yet) — subtle urgency pulse.
  // BUGFIX 6-a: measured against the Jakarta "today" (same source as
  // isOverdue) instead of the browser-local clock so the two checks can't
  // disagree around midnight or on non-Jakarta browsers.
  const isUrgent = !isOverdue && deadlineDate && (() => {
    const [ty, tm, td] = jakartaDateString().split('-').map(Number);
    const days = differenceInCalendarDays(deadlineDate, new Date(ty, tm - 1, td));
    return days >= 0 && days <= 7;
  })();

  return (
    <div
      className={cn(
        // PREMIUM-UI ("Rutina Aurora"): layered card + hover lift + top sheen.
        // Dipakai <div> polong (bukan komponen Card) karena class default Card
        // `card-shadow-premium` (unlayered, urutan sumber di globals.css lebih
        // akhir dari .premium-card) akan menimpa multi-layer shadow premium.
        'premium-card premium-card-hover premium-card-sheen group relative rounded-2xl',
        isCompleted && 'opacity-90',
        isCancelled && 'opacity-55'
      )}
    >
      {/* PREMIUM-UI: state wash overlay — dipasang sebagai CHILD div, bukan
          utility tint di elemen premium-card sendiri (class unlayered premium
          menang cascade atas utility Tailwind, jadi tint di elemen yang sama
          akan kalah — pola yang sama dipakai agent 2-b utk habit selesai/
          kambuh). pointer-events-none + aria-hidden: dekoratif murni. */}
      {isCompleted && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent ring-1 ring-inset ring-emerald-500/25"
        />
      )}
      {isCancelled && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-slate-500/10 via-slate-500/5 to-transparent ring-1 ring-inset ring-slate-400/20"
        />
      )}
      {/* Content wrapper: relative agar berada DI ATAS state overlay. */}
      <div className="relative p-4 sm:p-5">
        {/* Title row — chip-icon status avatar + content + actions */}
        <div className="flex items-start gap-3">
          {/* Status avatar chip: teal (aktif) / emerald (selesai) / slate (batal) */}
          <span
            className={cn(
              'chip-icon h-10 w-10',
              isCompleted ? 'chip-emerald' : isCancelled ? 'chip-slate' : 'chip-teal'
            )}
            aria-hidden="true"
          >
            {isCompleted ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : isCancelled ? (
              <X className="h-5 w-5" />
            ) : (
              <Target className="h-5 w-5" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className={cn(
                  'font-semibold text-sm sm:text-base leading-tight',
                  isCompleted && 'line-through text-muted-foreground'
                )}
              >
                {goal.title}
              </h3>
              <Badge
                variant="outline"
                className={cn('text-xs px-1.5 py-0', getBadgeClass(priorityMap[goal.priority]?.color || 'gray'))}
              >
                {PRIORITY_LABELS[goal.priority] ?? goal.priority}
              </Badge>
              <Badge
                variant="secondary"
                className={cn('text-xs px-1.5 py-0', STATUS_STYLES[goal.status] ?? '')}
              >
                {STATUS_LABELS[goal.status] ?? goal.status}
              </Badge>
              {isOverdue && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0">
                  Terlewat
                </Badge>
              )}
            </div>

            {goal.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {goal.description}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(goal)}
              disabled={isCompleted || isCancelled}
              aria-label={`Edit tujuan ${goal.title}`}
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            {goal.status === 'active' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/5"
                onClick={() => onComplete(goal)}
                aria-label={`Tandai tujuan ${goal.title} selesai`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {/* BUGHUNT-OTHER-1 BUG-L7: add Cancel action so users can stop
                an active goal without deleting it. */}
            {goal.status === 'active' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={() => onCancel(goal)}
                aria-label="Batalkan tujuan"
                title="Batalkan tujuan"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/15"
              onClick={() => onDelete(goal)}
              aria-label={`Hapus tujuan ${goal.title}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Progress bar — fill gradien otomatis dari base Progress */}
        <div className="mt-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="premium-label">Progress</span>
            <span className="font-semibold tabular-nums">{goal.progress}%</span>
          </div>
          <Progress value={goal.progress} className="h-2" />
        </div>

        {/* Footer row: deadline chip (amber saat dekat / rose saat lewat) + milestone pill */}
        <div className="flex items-center justify-between mt-3 gap-2">
          {goal.deadline ? (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2 py-1',
                isOverdue
                  ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300'
                  : isUrgent
                  ? 'bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300 anim-urgency-pulse'
                  : 'bg-muted/70 text-muted-foreground'
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              {/* BUGHUNT-OTHER-1 BUG-M3 (+ BUGFIX 6-a): format the LOCAL
                  midnight Date built from the YMD portion (see deadlineDate
                  above) so the calendar day is preserved in any browser tz. */}
              {deadlineDate && format(deadlineDate, 'd MMM yyyy', { locale: idLocale })}
            </span>
          ) : (
            <span />
          )}

          {milestones.length > 0 && (
            <button
              onClick={() => onToggleExpand(goal.id)}
              className="inline-flex items-center gap-1.5 text-xs rounded-full border border-border/70 bg-muted/50 hover:bg-muted/80 px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              aria-expanded={isExpanded}
            >
              <span className="font-semibold tabular-nums">
                {milestones.filter((m) => m.done).length}/{milestones.length}
              </span>
              <span className="text-muted-foreground">milestone</span>
              {isExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          )}
        </div>

        {/* Milestones section */}
        {isExpanded && milestones.length > 0 && (
          <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="premium-divider mb-3" />
            <div className="space-y-1">
              {milestones.map((ms, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 -mx-1.5 group/milestone hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={ms.done}
                    disabled={isCompleted || isCancelled}
                    onCheckedChange={() => onToggleMilestone(goal, idx)}
                    className={cn(
                      // PREMIUM-UI: checkbox milestone dicekokkan ke pola
                      // checkbox habit agent 2-b — bulat + gradient teal→
                      // emerald + glow (hanya visual; state/API tak berubah).
                      'h-5 w-5 rounded-full border-2 transition-all duration-200',
                      'data-[state=unchecked]:border-muted-foreground/30 dark:data-[state=unchecked]:border-white/25',
                      'data-[state=checked]:border-transparent data-[state=checked]:text-white',
                      'data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-teal-400 data-[state=checked]:to-emerald-600 data-[state=checked]:shadow-[0_3px_8px_-2px_rgba(16,185,129,0.55)]'
                    )}
                  />
                  <span
                    className={cn(
                      'text-sm flex-1 transition-colors',
                      ms.done
                        ? 'line-through text-muted-foreground'
                        : 'text-foreground'
                    )}
                  >
                    {ms.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
