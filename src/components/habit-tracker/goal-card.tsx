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
  Trash2,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, differenceInCalendarDays, id as idLocale } from '@/lib/date-utils';
// PERF-FIX (FIX-TIER3 / Fix 15): replaced `date-fns` with native Intl-based
// utility module. Output is identical for the patterns and helpers used
// here ('d MMM yyyy' + differenceInCalendarDays) — verified via test
// script in worklog FIX-TIER3 entry.
import { getBadgeClass } from '@/lib/label-colors';
import { jakartaDateString } from '@/lib/jakarta-date';
import { parseMilestones, STATUS_STYLES, getProgressColor } from './goals-helpers';
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
  // BUGHUNT-OTHER-1 BUG-M4: `isPast(parseISO(deadline))` returns true the
  // moment "now" exceeds the UTC midnight of the deadline. For Jakarta
  // users, the deadline's UTC midnight = 07:00 WIB on the deadline day,
  // so goals would be marked overdue at 07:00 WIB on the deadline day
  // itself (a full day early). Instead, compare YMD strings: the goal is
  // overdue only when today's Jakarta date is strictly after the deadline
  // date. The deadline is stored as UTC midnight, so its YMD portion is
  // the user-meaningful calendar date.
  const isOverdue = (() => {
    if (!goal.deadline || isCompleted || isCancelled) return false;
    const deadlineYmd = goal.deadline.slice(0, 10); // "2025-01-15"
    const todayYmd = jakartaDateString();
    return deadlineYmd < todayYmd;
  })();
  // Deadline within 7 days (not overdue yet) — subtle urgency pulse
  const isUrgent = !isOverdue && goal.deadline && (() => {
    const deadlineYmd = goal.deadline.slice(0, 10);
    const todayYmd = jakartaDateString();
    if (deadlineYmd <= todayYmd) return false;
    const [y, m, d] = deadlineYmd.split('-').map(Number);
    const days = differenceInCalendarDays(new Date(y, m - 1, d), new Date());
    return days >= 0 && days <= 7;
  })();

  return (
    <Card
      key={goal.id}
      className={cn(
        'group transition-all hover:shadow-md',
        isCompleted && 'opacity-75',
        isCancelled && 'opacity-50'
      )}
    >
      <CardContent className="p-4 sm:p-5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
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
                {goal.priority}
              </Badge>
              <Badge
                variant="secondary"
                className={cn('text-xs px-1.5 py-0', STATUS_STYLES[goal.status] ?? '')}
              >
                {goal.status}
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
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            {goal.status === 'active' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/5"
                onClick={() => onComplete(goal)}
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
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium tabular-nums">{goal.progress}%</span>
          </div>
          <Progress
            value={goal.progress}
            className={cn('h-2', getProgressColor(goal.progress))}
          />
        </div>

        {/* Footer row: deadline + milestone toggle */}
        <div className="flex items-center justify-between mt-3">
          {goal.deadline ? (
            <span
              className={cn(
                'flex items-center gap-1 text-xs rounded px-1 py-0.5',
                isOverdue
                  ? 'text-destructive font-medium'
                  : isUrgent
                  ? 'text-warning dark:text-warning/80 font-medium anim-urgency-pulse'
                  : 'text-muted-foreground'
              )}
            >
              <Calendar className="h-3 w-3" />
              {/* BUGHUNT-OTHER-1 BUG-M3: build a local Date from the YMD
                  portion of the ISO so the calendar day is preserved in
                  any browser tz (was `parseISO(goal.deadline)` which reads
                  UTC midnight → shifted to one day earlier on negative-tz
                  browsers). */}
              {format(new Date(goal.deadline.slice(0, 10)), 'd MMM yyyy', { locale: idLocale })}
            </span>
          ) : (
            <span />
          )}

          {milestones.length > 0 && (
            <button
              onClick={() => onToggleExpand(goal.id)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {milestones.filter((m) => m.done).length}/{milestones.length} milestone
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
            <Separator className="mb-3" />
            <div className="space-y-2">
              {milestones.map((ms, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 group/milestone"
                >
                  <Checkbox
                    checked={ms.done}
                    disabled={isCompleted || isCancelled}
                    onCheckedChange={() => onToggleMilestone(goal, idx)}
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
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
      </CardContent>
    </Card>
  );
});
