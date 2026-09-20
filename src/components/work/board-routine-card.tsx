// ---------------------------------------------------------------------------
// src/components/work/board-routine-card.tsx — kartu rutinitas di papan
// (pecahan Task 71-e dari work-board.tsx, logika Task 22): dipakai untuk item
// sortable & DragOverlay. Tap kartu = centang / batalkan (mutasi yang sama
// dengan tab Hari Ini).
// ---------------------------------------------------------------------------
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkRoutineItem } from './work-types';
import { WorkBadge } from './work-shared';
import { ROUTINE_TIME_META, routineDragId } from './work-board-shared';

export function RoutineBoardCard({
  routine,
  onToggle,
  onQuickMove,
  quickPending,
  dragging,
  overlay,
}: {
  routine: WorkRoutineItem;
  onToggle: () => void;
  onQuickMove?: () => void;
  quickPending?: boolean;
  dragging?: boolean;
  overlay?: boolean;
}) {
  const done = routine.doneToday;
  const meta = ROUTINE_TIME_META[routine.timeOfDay] ?? ROUTINE_TIME_META.siang;
  return (
    <div
      className={cn(
        'premium-card rounded-xl p-2.5',
        dragging && 'opacity-40',
        overlay && 'rotate-2 shadow-xl',
        done && 'opacity-75'
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
          onClick={onToggle}
          disabled={quickPending}
          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:rounded-lg disabled:opacity-60"
          aria-label={`${done ? 'Batalkan' : 'Tandai selesai'} rutinitas ${routine.title}`}
          aria-pressed={done}
        >
          <p
            className={cn(
              'text-[13px] font-semibold leading-snug',
              done ? 'text-muted-foreground/80 line-through decoration-muted-foreground/50' : 'text-foreground'
            )}
          >
            {routine.title}
          </p>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <WorkBadge variant="rutin">RUTIN</WorkBadge>
            <span className={cn('flex items-center gap-1 text-[10.5px] font-extrabold', meta.text)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden="true" />
              {meta.label}
            </span>
          </span>
        </button>
      </div>
      {/* Geser cepat — pengganti drag&drop di layar kecil (tetap bisa drag). */}
      {onQuickMove && (
        <button
          type="button"
          onClick={onQuickMove}
          disabled={quickPending}
          className="mt-1.5 ml-auto flex min-h-9 items-center gap-1 rounded-full border border-border/70 px-3 text-[11px] font-bold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary active:scale-95 disabled:opacity-50 lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-label={`${done ? 'Batalkan' : 'Tandai selesai'} rutinitas ${routine.title}`}
        >
          {done ? 'Belum' : 'Selesai'}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Item sortable rutinitas (handle drag seluruh kartu, jarak aktivasi 8px). */
export function SortableRoutineCard({
  routine,
  onToggle,
  quickPending,
}: {
  routine: WorkRoutineItem;
  onToggle: () => void;
  quickPending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: routineDragId(routine),
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="touch-manipulation"
      {...attributes}
      {...listeners}
    >
      <RoutineBoardCard
        routine={routine}
        onToggle={onToggle}
        onQuickMove={onToggle}
        quickPending={quickPending}
        dragging={isDragging}
      />
    </div>
  );
}
