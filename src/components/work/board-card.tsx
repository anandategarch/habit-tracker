// ---------------------------------------------------------------------------
// src/components/work/board-card.tsx — kartu tugas lepas di papan (pecahan
// Task 71-e dari work-board.tsx): dipakai untuk item sortable & DragOverlay,
// dengan badge LEWAT/MENUNGGU/JALAN/BARU + tombol geser cepat mobile.
// ---------------------------------------------------------------------------
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isTaskNew, type WorkTaskItem } from './work-types';
import { WorkBadge, formatLongIndoDate } from './work-shared';
import { QUICK_LABEL, QUICK_NEXT } from './work-board-shared';

function boardMetaLabel(task: WorkTaskItem, today: string): string | null {
  if (task.overdue) return 'lewat tenggat';
  if (task.kapanSaja) return 'kapan saja';
  if (task.dayKey === today) return 'hari ini';
  if (task.dayKey) {
    return task.dayKey > today
      ? `target ${formatLongIndoDate(task.dayKey).split(', ')[1] ?? task.dayKey}`
      : null;
  }
  return null;
}

/** Kartu tugas di papan — dipakai untuk item sortable & DragOverlay. */
export function BoardCard({
  task,
  today,
  onEdit,
  onQuickMove,
  quickPending,
  dragging,
  overlay,
}: {
  task: WorkTaskItem;
  today: string;
  onEdit: (task: WorkTaskItem) => void;
  onQuickMove?: (task: WorkTaskItem) => void;
  quickPending?: boolean;
  dragging?: boolean;
  overlay?: boolean;
}) {
  const done = task.status === 'selesai';
  const meta = boardMetaLabel(task, today);
  const next = QUICK_NEXT[task.status] ?? 'todo';
  return (
    <div
      className={cn(
        'premium-card rounded-xl p-2.5',
        dragging && 'opacity-40',
        overlay && 'rotate-2 shadow-xl',
        done && 'opacity-75',
        task.overdue && !done && 'border-destructive/40'
      )}
    >
      <div className="flex items-start gap-1.5">
        <span
          className="mt-0.5 hidden h-5 w-5 shrink-0 cursor-grab touch-none text-muted-foreground/50 sm:block"
          aria-hidden="true"
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <button
          type="button"
          onClick={() => onEdit(task)}
          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:rounded-lg"
          aria-label={`Buka editor tugas ${task.title}`}
        >
          <p
            className={cn(
              'text-[13px] font-semibold leading-snug',
              done ? 'text-muted-foreground/80 line-through decoration-muted-foreground/50' : 'text-foreground'
            )}
          >
            {task.title}
          </p>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {task.overdue && !done && (
              <WorkBadge variant="menunggu" className="!bg-destructive/10 !text-destructive dark:!text-destructive/90">
                LEWAT
              </WorkBadge>
            )}
            {task.status === 'nunggu' && !done && <WorkBadge variant="menunggu">MENUNGGU</WorkBadge>}
            {task.status === 'jalan' && !done && <WorkBadge variant="jalan">JALAN</WorkBadge>}
            {isTaskNew(task, today) && task.dayKey === today && !done && <WorkBadge variant="baru">BARU</WorkBadge>}
            {meta && <span className="text-[10.5px] text-muted-foreground">{meta}</span>}
            {task.notes && <span className="truncate text-[10.5px] text-muted-foreground/70">· {task.notes}</span>}
          </span>
        </button>
      </div>
      {/* Geser cepat — pengganti drag&drop di layar kecil (tetap bisa drag). */}
      {onQuickMove && (
        <button
          type="button"
          onClick={() => onQuickMove(task)}
          disabled={quickPending}
          className="mt-1.5 ml-auto flex min-h-9 items-center gap-1 rounded-full border border-border/70 px-3 text-[11px] font-bold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary active:scale-95 disabled:opacity-50 lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-label={`Pindahkan ${task.title} ke kolom ${QUICK_LABEL[next]}`}
        >
          {QUICK_LABEL[next]}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Item sortable tugas dengan handle drag seluruh kartu (jarak aktivasi 8px supaya
 *  tap tetap masuk ke editor, geser baru menyeret). */
export function SortableBoardCard({
  task,
  today,
  onEdit,
  onQuickMove,
  quickPending,
}: {
  task: WorkTaskItem;
  today: string;
  onEdit: (task: WorkTaskItem) => void;
  onQuickMove: (task: WorkTaskItem) => void;
  quickPending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="touch-manipulation"
      {...attributes}
      {...listeners}
    >
      <BoardCard
        task={task}
        today={today}
        onEdit={onEdit}
        onQuickMove={onQuickMove}
        quickPending={quickPending}
        dragging={isDragging}
      />
    </div>
  );
}
