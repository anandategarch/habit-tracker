'use client';

// components/habit-tracker/habit-master-list.tsx — daftar habit (hasil
// pemecahan habit-master.tsx, Task 71-b): skeleton memuat, empty state
// premium, tabel desktop + kartu mobile. (Markup dipindah apa adanya.)

import { Plus, Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { HabitOptionRow } from '@/hooks/use-habit-options';
import type { Habit } from './habit-master-types';
import { HabitTable } from './habit-table';
import { HabitMobileCards } from './habit-mobile-cards';

export interface HabitMasterListProps {
  loading: boolean;
  /** Seluruh habit (untuk pesan empty-state: belum ada sama sekali vs
   *  tersaring pencarian/filter). */
  habits: Habit[];
  /** Habit hasil filter pencarian/kategori/status. */
  filteredHabits: Habit[];
  categoryMap: Map<string, HabitOptionRow>;
  priorityMap: Map<string, HabitOptionRow>;
  difficultyMap: Map<string, HabitOptionRow>;
  onEdit: (habit: Habit) => void;
  onToggleStatus: (habit: Habit) => void;
  onArchive: (habit: Habit) => void;
  onDelete: (id: string) => void;
  /** CTA "Habit Baru" pada empty state (membuka dialog yang sama). */
  onAdd: () => void;
}

export function HabitMasterList({
  loading,
  habits,
  filteredHabits,
  categoryMap,
  priorityMap,
  difficultyMap,
  onEdit,
  onToggleStatus,
  onArchive,
  onDelete,
  onAdd,
}: HabitMasterListProps) {
  return (
    <>
      {loading ? (
        // Skeleton — meniru layout baris final (avatar emoji squircle 40px +
        // title bar + meta bar), pola goals-skeleton (div polong premium-card).
        <div className="premium-card rounded-2xl p-4 sm:p-5 space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3.5 py-2.5">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredHabits.length === 0 ? (
        // Empty state premium — orb + headline + CTA (CTA membuka dialog yang
        // sama dengan tombol "Habit Baru" di header).
        <div className="premium-card premium-empty rounded-2xl min-h-[18rem]">
          <div className="premium-empty-orb">
            <Sprout className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">Belum Ada Habit</p>
          <p className="text-xs text-muted-foreground/70 -mt-0.5">
            {habits.length === 0
              ? 'Buat habit pertama kamu untuk mulai!'
              : 'Coba ubah pencarian atau filter.'}
          </p>
          {habits.length === 0 && (
            <Button
              size="sm"
              className="btn-primary-gradient mt-2"
              onClick={onAdd}
            >
              <Plus className="h-4 w-4" />
              Habit Baru
            </Button>
          )}
        </div>
      ) : (
        <>
          <HabitTable
            habits={filteredHabits}
            categoryMap={categoryMap}
            priorityMap={priorityMap}
            difficultyMap={difficultyMap}
            onEdit={onEdit}
            onToggleStatus={onToggleStatus}
            onArchive={onArchive}
            onDelete={onDelete}
          />
          <HabitMobileCards
            habits={filteredHabits}
            categoryMap={categoryMap}
            priorityMap={priorityMap}
            difficultyMap={difficultyMap}
            onEdit={onEdit}
            onToggleStatus={onToggleStatus}
            onArchive={onArchive}
            onDelete={onDelete}
          />
        </>
      )}
    </>
  );
}
