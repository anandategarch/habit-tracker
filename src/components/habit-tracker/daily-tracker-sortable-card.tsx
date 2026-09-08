'use client';

// ── SortableHabitCard (PHASE4-POLISH) ─────────────────────────────────────
// Wrapper around <HabitCard> that wires it into a @dnd-kit/sortable context.
// The drag handle (GripVertical icon) is only rendered when `dragMode` is
// true — outside drag mode, the card behaves exactly as before (no DnD
// listeners attached, no visual handle, normal tap-to-toggle works).
//
// Why a wrapper instead of adding DnD to HabitCard itself?
//  - HabitCard is wrapped in React.memo with a fixed prop signature. Adding
//    useSortable hooks + listeners + transform styles would either break
//    memo (new props each render) or require a new prop drilling surface.
//  - The wrapper keeps HabitCard unchanged and lets us apply the sortable
//    transform to an outer <div> (whose grid item identity the DnD library
//    can swap via CSS transforms without affecting inner layout).

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HabitCard, type HabitCardProps } from './daily-tracker-habit-card';
import type { Habit } from './daily-tracker-types';

export interface SortableHabitCardProps extends HabitCardProps {
  /** When true, the drag handle is visible and DnD listeners are active. */
  dragMode: boolean;
}

export function SortableHabitCard({ dragMode, ...habitCardProps }: SortableHabitCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: (habitCardProps.habit as Habit).id,
      // Disable the sortable entirely outside drag mode so taps never trigger
      // a drag-claim — keeps normal card interactions (tap-to-toggle,
      // flip-on-tap) fully intact.
      disabled: !dragMode,
    });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // When dragging, lift the card above siblings and let it cast a shadow.
    opacity: isDragging ? 0.85 : 1,
    zIndex: isDragging ? 50 : undefined,
    // `touch-action: none` is required by @dnd-kit for touch drag to work.
    // Applied at the wrapper so only the handle area initiates touch drag
    // (the listeners are spread on the handle, not the wrapper).
    touchAction: dragMode ? 'none' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative',
        isDragging && 'shadow-xl ring-2 ring-primary/40 rounded-2xl',
      )}
    >
      {dragMode && (
        <button
          type="button"
          aria-label="Geser untuk mengatur urutan"
          title="Geser untuk mengatur urutan"
          // Spread DnD listeners ONLY on the handle so the rest of the card
          // stays clickable (toggle, flip, time-analysis button) even in
          // drag mode. The handle stops propagation so tapping it doesn't
          // accidentally toggle the underlying checkbox.
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2 left-2 z-30 p-1.5 rounded-full bg-background/85 backdrop-blur-sm border border-border/70 shadow-sm text-muted-foreground hover:text-foreground hover:border-border cursor-grab active:cursor-grabbing active:scale-95 transition"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <HabitCard {...habitCardProps} />
    </div>
  );
}
