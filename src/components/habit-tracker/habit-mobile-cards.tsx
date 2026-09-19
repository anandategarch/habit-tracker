'use client';

// components/habit-tracker/habit-mobile-cards.tsx — kartu habit mobile (<md).
// Tap kartu → openHabitFocus(id) (store 1-klik); tombol aksi memakai
// stopPropagation + aria-label Indonesia.

import { Pencil, Trash2, Pause, Play, Archive, ArchiveRestore, GraduationCap, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import { tintFromEmoji } from '@/lib/emoji-color';
import { jakartaDateString } from '@/lib/timezone';
import { isScheduledOn, parseSchedule, scheduleLabel } from '@/lib/habit-schedule';
import type { HabitOptionRow } from '@/hooks/use-habit-options';
import {
  habitStatus,
  HABIT_STATUS_LABELS,
  HABIT_TYPE_LABELS,
  type Habit,
} from './habit-master-types';

export interface HabitMobileCardsProps {
  habits: Habit[];
  categoryMap: Map<string, HabitOptionRow>;
  priorityMap: Map<string, HabitOptionRow>;
  difficultyMap: Map<string, HabitOptionRow>;
  onEdit: (habit: Habit) => void;
  onToggleStatus: (habit: Habit) => void;
  onArchive: (habit: Habit) => void;
  onDelete: (id: string) => void;
}

// Task 61-f (audit 61-a P3): tombol aksi kartu mobile 36px → 40px (aksi
// termasuk HAPUS destruktif; guard pointer:coarse di globals.css tidak
// mencocokkan h-9).
const ACTION_BTN =
  'inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

function BadgeDot({ option, fallback }: { option?: HabitOptionRow; fallback: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      {option?.color && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: option.color }}
          aria-hidden="true"
        />
      )}
      {option?.label ?? fallback}
    </span>
  );
}

export function HabitMobileCards({
  habits,
  categoryMap,
  priorityMap,
  difficultyMap,
  onEdit,
  onToggleStatus,
  onArchive,
  onDelete,
}: HabitMobileCardsProps) {
  const openHabitFocus = useAppStore((s) => s.openHabitFocus);

  return (
    <div className="space-y-2.5 md:hidden">
      {habits.map((h, i) => {
        const status = habitStatus(h);
        const archived = status === 'archived';
        const graduated = status === 'graduated';
        // Task 37 — badge jadwal tampil (tidak render untuk harian).
        const sched = parseSchedule(h.scheduleJson);
        const schedBadge = sched.kind !== 'daily' ? scheduleLabel(sched) : null;
        // VERIFY-48 (48-a #3): label kartu = perilaku klik persis — sama
        // dengan HabitTable (trackTime → analisis; aktif + terjadwal hari
        // ini → fokus kartu tracker; selainnya → form edit).
        const focusInTracker =
          h.trackTime ||
          (h.isActive &&
            !h.isArchived &&
            !h.graduatedAt &&
            isScheduledOn(sched, jakartaDateString()));
        return (
          <div
            key={h.id}
            role="button"
            tabIndex={0}
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
              'premium-card premium-card-hover premium-fade-up cursor-pointer rounded-2xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              status !== 'active' && 'opacity-60',
            )}
            style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
          >
            {/* Header: avatar + nama + status */}
            <div className="flex items-start gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl"
                style={{ backgroundColor: tintFromEmoji(h.emoji) }}
                aria-hidden="true"
              >
                {h.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{h.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                      status === 'active'
                        ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
                        : status === 'paused'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : status === 'graduated'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-400/10 text-slate-600 dark:text-slate-400',
                    )}
                  >
                    {graduated ? (
                      <span className="inline-flex items-center gap-1">
                        <GraduationCap className="h-3 w-3" aria-hidden="true" />
                        {HABIT_STATUS_LABELS[status]}
                        {h.targetDays ? ` · ${h.completedLogCount ?? 0}/${h.targetDays}` : ''}
                      </span>
                    ) : (
                      HABIT_STATUS_LABELS[status]
                    )}
                  </span>
                  <BadgeDot option={priorityMap.get(h.priority)} fallback={h.priority} />
                  <span aria-hidden="true">·</span>
                  <span className="text-[11px] text-muted-foreground">
                    {HABIT_TYPE_LABELS[h.habitType]}
                    {h.habitType === 'amount' && h.target > 1 ? ` · target ${h.target}` : ''}
                  </span>
                  {schedBadge && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-teal-500/10 dark:bg-teal-400/10 px-1.5 py-0.5 text-[10px] font-bold text-teal-600 dark:text-teal-300 max-w-[8rem]">
                      <CalendarDays className="h-3 w-3" aria-hidden="true" />
                      <span className="truncate">{schedBadge}</span>
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {h.completedLogCount ?? 0}× selesai
                  {h.category ? ` · ${h.category}` : ''}
                </p>
              </div>
            </div>

            {/* Aksi — stopPropagation supaya kartu tidak terpicu */}
            <div
              className="mt-3 flex items-center justify-end gap-1 border-t border-border/60 pt-2"
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
                {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
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
          </div>
        );
      })}
    </div>
  );
}
