'use client';

// components/habit-tracker/goal-card.tsx — kartu tujuan premium Aurora.
//
// - div polong premium-card (anti-pattern <Card className="premium-card">
//   dihindari — cascade flat-shadow, lihat worklog 2-c/6-c).
// - State selesai/dibatalkan: wash overlay pada CHILD div (bukan bg-* di
//   elemen premium-card) + opacity 90/55.
// - Badge prioritas/status memakai label Indonesia (fix 6-a FIX-9).
// - Deadline diformat dari KOMPONEN YMD new Date(y, m-1, d) — bukan
//   new Date('yyyy-MM-dd') (fix 6-a FIX-8); urgensi dihitung vs hari Jakarta.
// - Tombol ikon-saja memakai aria-label Indonesia (fix 6-a FIX-7) dan
//   hapus tujuan + hapus milestone dikonfirmasi via AlertDialog.

import { useState } from 'react';
import {
  Target,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  RotateCcw,
  Check,
  X,
  ChevronDown,
  CalendarClock,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  goalProgress,
  formatDeadlineYMD,
  deadlineRelativeLabel,
  isDeadlineOverdue,
  isDeadlineUrgent,
  priorityKey,
  priorityLabel,
  statusLabel,
  PRIORITY_BADGE_CLASSES,
  STATUS_BADGE_CLASSES,
  type Goal,
} from './goals-helpers';

export interface GoalCardProps {
  goal: Goal;
  /** Buka dialog edit. */
  onEdit: (goal: Goal) => void;
  /** Tandai selesai / aktifkan kembali. */
  onComplete: (goal: Goal) => void;
  /** Hapus tujuan (dipanggil setelah konfirmasi AlertDialog). */
  onDelete: (goal: Goal) => void;
  /** Toggle milestone ke-i (BUG-M16: status ikut diturunkan). */
  onToggleMilestone: (goal: Goal, index: number) => void;
  /** Hapus milestone ke-i (dipanggil setelah konfirmasi AlertDialog). */
  onDeleteMilestone: (goal: Goal, index: number) => void;
}

const ICON_BTN =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

export function GoalCard({
  goal,
  onEdit,
  onComplete,
  onDelete,
  onToggleMilestone,
  onDeleteMilestone,
}: GoalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteMilestoneIndex, setDeleteMilestoneIndex] = useState<number | null>(null);

  const completed = goal.status === 'completed';
  const cancelled = goal.status === 'cancelled';
  const milestones = goal.milestones ?? [];
  const doneCount = milestones.filter((m) => m.done).length;
  const pct = goalProgress(goal);

  const deadline = goal.deadline;
  // Fix 11-c L-2: goal selesai TIDAK menampilkan badge "Terlewat"/
  // urgensi (deadline tercapai — terlambat atau tidak tidak lagi relevan).
  const overdue = deadline && !completed ? isDeadlineOverdue(deadline) : false;
  const urgent = deadline && !completed ? isDeadlineUrgent(deadline) : false;

  // Avatar chip status (pola 2-c): teal aktif / emerald selesai / slate batal.
  const statusIcon = cancelled ? XCircle : completed ? CheckCircle2 : Target;
  const StatusIcon = statusIcon;
  const statusChip = cancelled ? 'chip-slate' : completed ? 'chip-emerald' : 'chip-teal';

  const milestoneToDelete =
    deleteMilestoneIndex !== null ? milestones[deleteMilestoneIndex] : undefined;

  return (
    <div
      className={cn(
        'premium-card premium-card-hover premium-card-sheen group relative rounded-2xl',
        completed && 'opacity-90',
        cancelled && 'opacity-55',
      )}
    >
      {/* Wash overlay state — child div (tint TIDAK boleh bg-* di elemen premium-card). */}
      {completed && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent ring-1 ring-inset ring-emerald-500/25"
        />
      )}
      {cancelled && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-slate-500/10 to-transparent ring-1 ring-inset ring-slate-400/20"
        />
      )}

      <div className="relative p-4 sm:p-5 space-y-3.5">
        {/* Header: avatar chip + judul + aksi */}
        <div className="flex items-start gap-3.5">
          <span className={cn('chip-icon h-10 w-10 shrink-0', statusChip)} aria-hidden="true">
            <StatusIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3
              className={cn(
                'text-sm sm:text-base font-semibold leading-snug break-words',
                completed && 'line-through decoration-emerald-500/60',
                cancelled && 'line-through',
              )}
            >
              {goal.title}
            </h3>
            {goal.description && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2 break-words">
                {goal.description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {/* fix 6-a FIX-7: aria-label Indonesia untuk tombol ikon-saja */}
            <button
              type="button"
              className={ICON_BTN}
              aria-label={`Edit tujuan ${goal.title}`}
              onClick={() => onEdit(goal)}
            >
              <Pencil className="h-4 w-4" />
            </button>
            {!cancelled && (
              <button
                type="button"
                className={ICON_BTN}
                aria-label={
                  completed
                    ? `Aktifkan kembali tujuan ${goal.title}`
                    : `Tandai tujuan ${goal.title} selesai`
                }
                onClick={() => onComplete(goal)}
              >
                {completed ? (
                  <RotateCcw className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
              </button>
            )}
            <button
              type="button"
              className={cn(ICON_BTN, 'hover:text-destructive hover:bg-destructive/10')}
              aria-label={`Hapus tujuan ${goal.title}`}
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Badge prioritas + status + chip deadline */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn('text-[11px]', PRIORITY_BADGE_CLASSES[priorityKey(goal.priority)])}
          >
            {priorityLabel(goal.priority)}
          </Badge>
          <Badge variant="outline" className={cn('text-[11px]', STATUS_BADGE_CLASSES[goal.status] ?? '')}>
            {statusLabel(goal.status)}
          </Badge>
          {deadline && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
                overdue
                  ? 'border-rose-500/35 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  : urgent
                    ? 'border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'border-border bg-muted/50 text-muted-foreground',
                (overdue || urgent) && 'anim-urgency-pulse',
              )}
              title={
                completed
                  ? `${formatDeadlineYMD(deadline)} — tercapai`
                  : `${formatDeadlineYMD(deadline)} — ${deadlineRelativeLabel(deadline)}`
              }
            >
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {formatDeadlineYMD(deadline)}
              <span className="text-muted-foreground/80">
                · {completed ? 'tercapai' : deadlineRelativeLabel(deadline)}
              </span>
            </span>
          )}
        </div>

        {/* Progress otomatis dari % milestone */}
        <div className="flex items-center gap-3">
          <Progress value={pct} className="anim-progress-fill h-2 flex-1" aria-label={`Progres ${pct}%`} />
          <span className="premium-stat text-xs text-foreground shrink-0">{pct}%</span>
          {milestones.length > 0 && (
            <span className="text-[11px] text-muted-foreground shrink-0">
              {doneCount}/{milestones.length} milestone
            </span>
          )}
        </div>

        {/* Expand milestone */}
        {milestones.length > 0 && (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <span>{expanded ? 'Sembunyikan milestone' : 'Lihat milestone'}</span>
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')}
                aria-hidden="true"
              />
            </button>
            {expanded && (
              <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-muted/20 px-3 py-1">
                {milestones.map((m, i) => (
                  <li key={`${i}-${m.text}`} className="flex items-center gap-2.5 py-2">
                    {/* Checkbox bulat gradien (pola 2-b/2-c) */}
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={m.done}
                      aria-label={`Tandai milestone ${m.text}`}
                      onClick={() => onToggleMilestone(goal, i)}
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                        m.done
                          ? 'border-transparent bg-gradient-to-br from-teal-400 to-emerald-500 shadow-[0_0_10px_-2px_rgba(16,185,129,0.55)]'
                          : 'border-muted-foreground/40 hover:border-primary/60',
                      )}
                    >
                      {m.done && <Check className="h-3 w-3 text-white" aria-hidden="true" />}
                    </button>
                    <span
                      className={cn(
                        'min-w-0 flex-1 text-sm break-words',
                        m.done && 'line-through text-muted-foreground',
                      )}
                    >
                      {m.text}
                    </span>
                    <button
                      type="button"
                      className={cn(ICON_BTN, 'h-7 w-7')}
                      aria-label={`Hapus milestone ${m.text}`}
                      onClick={() => setDeleteMilestoneIndex(i)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Konfirmasi hapus TUJUAN */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
              Hapus Tujuan
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  Yakin ingin menghapus tujuan{' '}
                  <span className="font-semibold text-foreground">{goal.title}</span>? Semua
                  milestone-nya juga ikut terhapus dan tindakan ini tidak bisa dibatalkan.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                setDeleteDialogOpen(false);
                onDelete(goal);
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Ya, Hapus
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Konfirmasi hapus MILESTONE */}
      <AlertDialog
        open={deleteMilestoneIndex !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteMilestoneIndex(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
              Hapus Milestone
            </AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus milestone{' '}
              <span className="font-semibold text-foreground">{milestoneToDelete?.text}</span> dari
              tujuan {goal.title}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteMilestoneIndex !== null) {
                  const idx = deleteMilestoneIndex;
                  setDeleteMilestoneIndex(null);
                  onDeleteMilestone(goal, idx);
                }
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Ya, Hapus
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
