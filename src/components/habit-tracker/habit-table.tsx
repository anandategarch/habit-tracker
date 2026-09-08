'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Pencil, Trash2, Clock, History, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getBadgeClass, getDotClass, getLabelColor } from '@/lib/label-colors';
import { STATUS_STYLES, type Habit } from './habit-master-types';
import type { HabitOption } from '@/hooks/use-habit-options';
import { useAppStore } from '@/store/app-store';

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
  // ONE-CLICK (4-foundation): row click opens the habit's analysis dialog on
  // the tracker tab — openHabitFocus(id) switches the tab AND focuses the
  // habit in a single call.
  const openHabitFocus = useAppStore((s) => s.openHabitFocus);

  return (
    // Div polong premium-card (bukan komponen Card — .card-shadow-premium milik
    // Card menimpa multi-layer shadow premium; pola agent 2-a/2-b/2-c).
    <div className="premium-card premium-card-sheen rounded-2xl hidden md:block overflow-hidden">
      <div className="max-h-[600px] overflow-x-auto overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-14" />
              <TableHead>Nama</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Prioritas</TableHead>
              <TableHead>Level Kesulitan</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {habits.map((habit) => (
              <TableRow
                key={habit.id}
                className="group cursor-pointer hover:bg-accent/50"
                onClick={() => openHabitFocus(habit.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openHabitFocus(habit.id);
                  }
                }}
                tabIndex={0}
                aria-label={`Buka analisis habit ${habit.name}`}
              >
                <TableCell>
                  <span
                    className="chip-soft h-10 w-10 text-xl select-none"
                    style={{ backgroundColor: `${habit.color}1f` }}
                    aria-hidden="true"
                  >
                    {habit.icon}
                  </span>
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
                      {habit.targetTime || 'aktif'}
                    </span>
                  )}
                  {habit.trackLastDone && (
                    <span className="ml-1.5 inline-flex items-center text-xs px-1.5 py-0.5 rounded-full bg-warning/10 text-warning dark:bg-warning/15 dark:text-warning/80" title="Track Terakhir aktif">
                      <History className="h-3 w-3 mr-0.5" />
                      {habit.lastDoneInterval || 'Track'}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-medium">
                    {habit.target} / {habit.targetType === 'daily' ? 'Harian' : habit.targetType === 'weekly' ? 'Mingguan' : 'Bulanan'}
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
                    {habit.status === 'active' ? 'Aktif' : habit.status === 'paused' ? 'Dijeda' : 'Diarsipkan'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5">
                    {/* Per-row affordance: buka analisis habit (sama dengan klik baris) */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity focus-visible:ring-2 focus-visible:ring-ring/60"
                      onClick={(e) => {
                        e.stopPropagation();
                        openHabitFocus(habit.id);
                      }}
                      aria-label={`Buka analisis ${habit.name}`}
                      title="Buka analisis"
                    >
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        {/* stopPropagation agar klik tombol menu tidak memicu
                            row-click (buka tracker). */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity focus-visible:ring-2 focus-visible:ring-ring/60"
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default HabitTable;
