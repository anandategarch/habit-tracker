'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Pencil, Trash2, Clock, History, Pause, Play, Archive, ArchiveRestore } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getBadgeClass, getDotClass, getLabelColor } from '@/lib/label-colors';
import { STATUS_STYLES, type Habit } from './habit-master-types';
import type { HabitOption } from '@/hooks/use-habit-options';

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
  return (
    <div className="md:hidden space-y-3 max-h-[600px] overflow-y-auto">
      {habits.map((habit) => (
        <Card key={habit.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-2xl mt-0.5 shrink-0">{habit.icon}</span>
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
                      className={cn('text-[10px] border-0', getBadgeClass(categoryMap[habit.category]?.color || 'gray'))}
                    >
                      {habit.category}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={cn('text-[10px] border-0', getBadgeClass(difficultyMap[habit.difficulty]?.color || 'gray'))}
                    >
                      {habit.difficulty}
                    </Badge>
                    {habit.trackTime && (
                      <span className="inline-flex items-center text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3 mr-0.5" />
                        {habit.targetTime || 'on'}
                      </span>
                    )}
                    {habit.trackLastDone && (
                      <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                        <History className="h-3 w-3 mr-0.5" />
                        {habit.lastDoneInterval || 'track'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-[10px]">
                      {habit.target} / {habit.targetType}
                    </Badge>
                    <span className={cn('text-[10px] font-medium', getLabelColor(priorityMap[habit.priority]?.color || 'gray').text)}>
                      {habit.priority}
                    </span>
                    <Badge variant="secondary" className={cn('text-[10px] border-0 capitalize', STATUS_STYLES[habit.status])}>
                      {habit.status}
                    </Badge>
                  </div>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(habit)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onToggleStatus(habit)}>
                    {habit.status === 'active' ? 'Pause' : 'Resume'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onArchive(habit)}>
                    {habit.status === 'archived' ? 'Unarchive' : 'Archive'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(habit.id)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default HabitMobileCards;
