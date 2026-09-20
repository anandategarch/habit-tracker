// ---------------------------------------------------------------------------
// src/components/work/board-column.tsx — satu kolom kanban papan (pecahan
// Task 71-e dari work-board.tsx): header label + titik warna + penghitung,
// area drop @dnd-kit.
// ---------------------------------------------------------------------------
'use client';

import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

export function BoardColumn({
  columnId,
  label,
  tone,
  dot,
  count,
  children,
}: {
  columnId: string;
  label: string;
  tone: string;
  dot: string;
  count: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  return (
    <section
      aria-label={`Kolom ${label}`}
      className={cn(
        'flex w-[78vw] shrink-0 snap-center flex-col gap-2 rounded-2xl border bg-card/40 p-2.5 sm:w-[46%]',
        'lg:w-auto lg:shrink lg:snap-align-none',
        'transition-colors',
        isOver ? 'border-primary/40 bg-primary/5' : 'border-border/70'
      )}
    >
      <header className="flex items-center gap-2 px-1">
        <span className={cn('h-2 w-2 rounded-full', dot)} aria-hidden="true" />
        <h4 className={cn('text-xs font-extrabold uppercase tracking-wider', tone)}>{label}</h4>
        <span className="ml-auto rounded-full bg-muted px-2 py-px text-[10.5px] font-bold tabular-nums text-muted-foreground">
          {count}
        </span>
      </header>
      <div ref={setNodeRef} className="flex min-h-16 flex-col gap-2">
        {children}
      </div>
    </section>
  );
}
