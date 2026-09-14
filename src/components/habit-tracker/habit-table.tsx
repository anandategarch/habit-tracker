'use client';

// components/habit-tracker/habit-table.tsx — tabel habit desktop (≥md).
// Baris klik mendarat sesuai kapabilitas/status (VERIFY-48 48-a #3):
// trackTime → dialog analisis; aktif terjadwal hari ini → gulir kartu;
// selainnya → form edit. Tombol aksi memakai stopPropagation + aria-label.

import {
  Pencil,
  Trash2,
  Pause,
  Play,
  Archive,
  ArchiveRestore,
  GraduationCap,
  CalendarDays,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import { tintFromEmoji } from '@/lib/emoji-color';
import { jakartaDateString } from '@/lib/timezone';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { HabitOptionRow } from '@/hooks/use-habit-options';
import {
  habitStatus,
  HABIT_STATUS_LABELS,
  HABIT_TYPE_LABELS,
  type Habit,
} from './habit-master-types';
import { isScheduledOn, parseSchedule, scheduleLabel } from '@/lib/habit-schedule';

export interface HabitTableProps {
  habits: Habit[];
  categoryMap: Map<string, HabitOptionRow>;
  priorityMap: Map<string, HabitOptionRow>;
  difficultyMap: Map<string, HabitOptionRow>;
  /** VERIFY-48 (48-c F10) — judul tujuan per id (chip Habit↔Tujuan). */
  goalMap?: Map<string, string>;
  onEdit: (habit: Habit) => void;
  onToggleStatus: (habit: Habit) => void;
  onArchive: (habit: Habit) => void;
  onDelete: (id: string) => void;
}

const ACTION_BTN =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

function OptionBadge({ option, fallback }: { option?: HabitOptionRow; fallback: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {option?.color && (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: option.color }}
          aria-hidden="true"
        />
      )}
      {option?.label ?? fallback}
    </span>
  );
}

export function HabitTable({
  habits,
  categoryMap,
  priorityMap,
  difficultyMap,
  goalMap,
  onEdit,
  onToggleStatus,
  onArchive,
  onDelete,
}: HabitTableProps) {
  const openHabitFocus = useAppStore((s) => s.openHabitFocus);
  const openGoalFocus = useAppStore((s) => s.openGoalFocus);

  return (
    <div className="premium-card hidden overflow-x-auto rounded-2xl md:block">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4 sm:pl-5">Habit</TableHead>
            <TableHead>Prioritas</TableHead>
            <TableHead>Kesulitan</TableHead>
            <TableHead>Tipe</TableHead>
            <TableHead className="text-right">Selesai</TableHead>
            <TableHead className="w-[168px] text-right pr-4 sm:pr-5">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {habits.map((h) => {
            const status = habitStatus(h);
            const archived = status === 'archived';
            const graduated = status === 'graduated';
            // Task 37 — badge jadwal tampil (tidak render untuk harian).
            const sched = parseSchedule(h.scheduleJson);
            const schedBadge =
              sched.kind !== 'daily' ? scheduleLabel(sched) : null;
            // VERIFY-48 (48-a #3): label baris = perilaku klik persis (bukan
            // perkiraan): trackTime → analisis; aktif + terjadwal hari ini →
            // fokus kartu tracker; selainnya → form edit.
            const focusInTracker =
              h.trackTime ||
              (h.isActive &&
                !h.isArchived &&
                !h.graduatedAt &&
                isScheduledOn(sched, jakartaDateString()));
            return (
              <TableRow
                key={h.id}
                tabIndex={0}
                role="button"
                aria-label={
                  h.trackTime
                    ? `Buka analisis waktu habit ${h.name}`
                    : focusInTracker
                      ? `Buka habit ${h.name} di tracker`
                      : `Edit habit ${h.name}`
                }
                onClick={() => (focusInTracker ? openHabitFocus(h.id) : onEdit(h))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (focusInTracker) openHabitFocus(h.id);
                    else onEdit(h);
                  }
                }}
                className={cn(
                  'cursor-pointer border-border/60 transition-colors hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none',
                  status !== 'active' && !graduated && 'opacity-60',
                )}
              >
                <TableCell className="pl-4 sm:pl-5">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
                      style={{ backgroundColor: tintFromEmoji(h.emoji) }}
                      aria-hidden="true"
                    >
                      {h.emoji}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{h.name}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {graduated ? (
                          // Task 36: lulus = kemenangan — badge emerald +
                          // ikon toga (Task 41: emoji 🎓 → lucide seragam).
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-px text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <GraduationCap className="h-3 w-3" aria-hidden="true" />
                            {HABIT_STATUS_LABELS[status]}
                            {h.targetDays ? ` · ${h.completedLogCount ?? 0}/${h.targetDays} hari` : ''}
                          </span>
                        ) : (
                          HABIT_STATUS_LABELS[status]
                        )}
                        {h.category && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{h.category}</span>
                          </>
                        )}
                        {schedBadge && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-teal-500/10 dark:bg-teal-400/10 px-1.5 py-px text-[10px] font-bold text-teal-600 dark:text-teal-300 max-w-[8rem]">
                            <CalendarDays className="h-3 w-3" aria-hidden="true" />
                            <span className="truncate">{schedBadge}</span>
                          </span>
                        )}
                      </p>
                      {/* VERIFY-48 (48-c F10): Habit Master goal-blind — chip
                          tujuan (gaya kartu tracker) bikin link Habit↔Tujuan
                          terlihat di permukaan kurasi habit; klik → fokus
                          tujuan (stopPropagation — jangan trigger baris). */}
                      {h.goalId && goalMap?.get(h.goalId) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openGoalFocus(h.goalId!);
                          }}
                          title={`Mendukung tujuan: ${goalMap.get(h.goalId)}`}
                          aria-label={`Buka tujuan ${goalMap.get(h.goalId)}`}
                          className="mt-1 inline-flex max-w-full items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-px text-[9px] font-bold tracking-wider text-amber-700 transition-colors hover:bg-amber-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 dark:text-amber-400"
                        >
                          <Target className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                          <span className="max-w-[10rem] truncate normal-case">{goalMap.get(h.goalId)}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <OptionBadge option={priorityMap.get(h.priority)} fallback={h.priority} />
                </TableCell>
                <TableCell>
                  <OptionBadge option={difficultyMap.get(h.difficulty)} fallback={h.difficulty} />
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    {HABIT_TYPE_LABELS[h.habitType]}
                    {h.habitType === 'amount' && h.target > 1 && (
                      <span className="tabular-nums">· {h.target}</span>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="premium-stat text-xs text-foreground">
                    {h.completedLogCount ?? 0}×
                  </span>
                </TableCell>
                <TableCell className="pr-4 sm:pr-5">
                  <div
                    className="flex items-center justify-end gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    role="group"
                    aria-label={`Aksi habit ${h.name}`}
                  >
                    <button
                      type="button"
                      className={ACTION_BTN}
                      aria-label={`Edit habit ${h.name}`}
                      onClick={() => onEdit(h)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {!archived && (
                      <button
                        type="button"
                        className={ACTION_BTN}
                        aria-label={h.isActive ? `Jeda habit ${h.name}` : `Lanjutkan habit ${h.name}`}
                        onClick={() => onToggleStatus(h)}
                      >
                        {h.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                    )}
                    <button
                      type="button"
                      className={ACTION_BTN}
                      aria-label={archived ? `Pulihkan habit ${h.name}` : `Arsipkan habit ${h.name}`}
                      onClick={() => onArchive(h)}
                    >
                      {archived ? (
                        <ArchiveRestore className="h-4 w-4" />
                      ) : (
                        <Archive className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      className={cn(ACTION_BTN, 'hover:bg-destructive/10 hover:text-destructive')}
                      aria-label={`Hapus habit ${h.name}`}
                      onClick={() => onDelete(h.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
