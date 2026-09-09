'use client';

// components/habit-tracker/daily-tracker-sortable-card.tsx — wrapper dnd-kit
// untuk HabitCard. Transform drag diterapkan di wrapper LUAR (bukan di
// premium-card) supaya hover-lift + sheen kartu tetap utuh.

import { GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { HabitCard } from './daily-tracker-habit-card';
import type { HabitCardProps } from './daily-tracker-habit-card';

export interface SortableHabitCardProps extends HabitCardProps {
  dragMode?: boolean;
}

export function SortableHabitCard(props: SortableHabitCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.habit.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 30 : undefined,
        opacity: isDragging ? 0.9 : 1,
        position: 'relative',
      }}
      className="relative"
    >
      {/* Grip handle — satu-satunya area aktivasi drag (tap kartu tetap
          ke toggle/stepper; constraint sensor sudah menjaga mis-tap). */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Geser untuk mengurutkan: ${props.habit.name}`}
        title="Geser untuk mengurutkan"
        className="absolute -top-2 -right-2 z-20 h-8 w-8 rounded-full bg-card border border-border shadow-sm grid place-items-center text-muted-foreground hover:text-primary hover:border-primary/50 cursor-grab active:scale-95 active:cursor-grabbing touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <HabitCard {...props} dragMode={props.dragMode ?? true} />
    </div>
  );
}
