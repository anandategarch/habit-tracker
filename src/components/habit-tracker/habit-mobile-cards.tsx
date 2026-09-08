'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Pencil, Trash2, Clock, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getBadgeClass, getLabelColor } from '@/lib/label-colors';
import { STATUS_STYLES, type Habit } from './habit-master-types';
import type { HabitOption } from '@/hooks/use-habit-options';
import { useAppStore } from '@/store/app-store';

interface HabitMobileCardsProps {
  habits: Habit[];
  categoryMap: Record<string, HabitOption>;
  priorityMap: Record<string, HabitOption>;
  difficultyMap: Record<string, HabitOption>;
  onEdit: (h: Habit) => void;
  onToggleStatus: (h: Habit) => void;
  onArchive: (h: Habit) => void;
  onDelete: (id: string) => void;
}

export function HabitMobileCards({
  habits, categoryMap, priorityMap, difficultyMap,
  onEdit, onToggleStatus, onArchive, onDelete,
}: HabitMobileCardsProps) {
  // ONE-CLICK (4-foundation): tap card → tracker tab + analysis dialog for
  // this habit in a single call.
  const openHabitFocus = useAppStore((s) => s.openHabitFocus);

  return (
    <div className="md:hidden space-y-3">
      {habits.map((habit) => (
        <div
          key={habit.id}
          // Div polong premium-card (bukan Card — pola agent 2-a/2-b/2-c)
          // + premium-card-hover untuk lift saat disentuh.
          className="premium-card premium-card-hover rounded-2xl p-4 cursor-pointer"
          role="button"
          tabIndex={0}
          aria-label={`Buka analisis habit ${habit.name}`}
          onClick={() => openHabitFocus(habit.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openHabitFocus(habit.id);
            }
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              {/* Avatar emoji squircle — tint dari warna habit */}
              <span
                className="chip-soft h-11 w-11 text-2xl shrink-0 select-none"
                style={{ backgroundColor: `${habit.color}1f` }}
                aria-hidden="true"
              >
                {habit.icon}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: habit.color }}
                  />
                  <span className="font-semibold text-sm truncate">
                    {habit.name}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <Badge
                    variant="secondary"
                    className={cn('text-xs border-0 rounded-full', getBadgeClass(categoryMap[habit.category]?.color || 'gray'))}
                  >
                    {habit.category}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={cn('text-xs border-0 rounded-full', getBadgeClass(difficultyMap[habit.difficulty]?.color || 'gray'))}
                  >
                    {habit.difficulty}
                  </Badge>
                  {habit.trackTime && (
                    <span className="inline-flex items-center text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 mr-0.5" />
                      {habit.targetTime || 'aktif'}
                    </span>
                  )}
                  {habit.trackLastDone && (
                    <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded-full bg-warning/10 text-warning dark:bg-warning/15 dark:text-warning/80">
                      <History className="h-3 w-3 mr-0.5" />
                      {habit.lastDoneInterval || 'Track'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs rounded-full">
                    {habit.target} / {habit.targetType === 'daily' ? 'Harian' : habit.targetType === 'weekly' ? 'Mingguan' : 'Bulanan'}
                  </Badge>
                  <span className={cn('text-xs font-medium', getLabelColor(priorityMap[habit.priority]?.color || 'gray').text)}>
                    {habit.priority}
                  </span>
                  <Badge variant="secondary" className={cn('text-xs border-0 rounded-full capitalize', STATUS_STYLES[habit.status])}>
                    {habit.status === 'active' ? 'Aktif' : habit.status === 'paused' ? 'Dijeda' : 'Diarsipkan'}
                  </Badge>
                </div>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {/* stopPropagation agar tap tombol menu tidak memicu tap-card
                    (buka tracker). */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 focus-visible:ring-2 focus-visible:ring-ring/60"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Menu aksi ${habit.name}`}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(habit)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onToggleStatus(habit)}>
                  {habit.status === 'active' ? 'Jeda' : 'Lanjut'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onArchive(habit)}>
                  {habit.status === 'archived' ? 'Pulihkan' : 'Arsipkan'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(habit.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Hapus
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
    </div>
  );
}

export default HabitMobileCards;
