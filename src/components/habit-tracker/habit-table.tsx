'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Pencil, Trash2, Clock, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getBadgeClass, getDotClass, getLabelColor } from '@/lib/label-colors';
import { STATUS_STYLES, type Habit } from './habit-master-types';
import type { HabitOption } from '@/hooks/use-habit-options';

interface HabitTableProps {
  habits: Habit[];
  categoryMap: Record<string, HabitOption>;
  priorityMap: Record<string, HabitOption>;
  difficultyMap: Record<string, HabitOption>;
  onEdit: (h: Habit) => void;
  onToggleStatus: (h: Habit) => void;
  onArchive: (h: Habit) => void;
  onDelete: (id: string) => void;
}

export function HabitTable({
  habits, categoryMap, priorityMap, difficultyMap,
  onEdit, onToggleStatus, onArchive, onDelete,
}: HabitTableProps) {
  return (
    <Card className="hidden md:block">
      <CardContent className="p-0">
        <div className="max-h-[600px] overflow-x-auto overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12" />
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {habits.map((habit) => (
                <TableRow key={habit.id} className="group">
                  <TableCell className="text-xl font-medium">
                    {habit.icon}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: habit.color }}
                      />
                      <span className="font-medium">{habit.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'font-medium border-0',
                        getBadgeClass(categoryMap[habit.category]?.color || 'gray')
                      )}
                    >
                      {habit.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          getDotClass(priorityMap[habit.priority]?.color || 'gray')
                        )}
                      />
                      <span
                        className={cn(
                          'text-sm font-medium',
                          getLabelColor(priorityMap[habit.priority]?.color || 'gray').text
                        )}
                      >
                        {habit.priority}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'font-medium border-0',
                        getBadgeClass(difficultyMap[habit.difficulty]?.color || 'gray')
                      )}
                    >
                      {habit.difficulty}
                    </Badge>
                    {habit.trackTime && (
                      <span className="ml-1.5 inline-flex items-center text-xs text-muted-foreground" title="Track Waktu aktif">
                        <Clock className="h-3 w-3 mr-0.5" />
                        {habit.targetTime || 'on'}
                      </span>
                    )}
                    {habit.trackLastDone && (
                      <span className="ml-1.5 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" title="Track Terakhir aktif">
                        <History className="h-3 w-3 mr-0.5" />
                        {habit.lastDoneInterval || 'track'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-medium">
                      {habit.target} / {habit.targetType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'font-medium border-0 capitalize',
                        STATUS_STYLES[habit.status]
                      )}
                    >
                      {habit.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default HabitTable;
