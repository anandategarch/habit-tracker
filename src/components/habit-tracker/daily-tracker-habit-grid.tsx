'use client';

// components/habit-tracker/daily-tracker-habit-grid.tsx — seksi grid habit
// (kontrol filter/drag + empty state + grid normal/drag @dnd-kit).
//
// Task 38 (split god file): DIEKSTRAKSI dari daily-tracker.tsx — JSX dan
// logika render identik; parent tinggal meneruskan state + handler.

import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  type Sensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import {
  CheckCircle2,
  ClipboardList,
  Flag,
  GripVertical,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Habit, HabitLog } from './daily-tracker-types';
import { HabitCard } from './daily-tracker-habit-card';
import { SortableHabitCard } from './daily-tracker-sortable-card';

export interface HabitGridSectionProps {
  activeHabits: Habit[];
  /** CONNECTED-APP (Task 49) — judul tujuan per goalId (chip pada kartu). */
  goalTitleById?: Record<string, string>;
  /** Task 37: habit terjadwal tanggal terpilih (dasar X/Y + grid). */
  scheduledHabits: Habit[];
  filteredHabits: Habit[];
  nextOccurrences: { id: string; name: string; emoji: string; label: string }[];
  dragMode: boolean;
  viewFilter: 'all' | 'incomplete' | 'completed';
  setViewFilter: (f: 'all' | 'incomplete' | 'completed') => void;
  toggleDragMode: () => void;
  sensors: Sensors;
  handleDragEnd: (event: DragEndEvent) => void;
  completionMap: Record<string, boolean>;
  togglingIds: Set<string>;
  recentlyCompleted: Set<string>;
  completedAtMap: Record<string, string>;
  monthLogsCache?: Record<string, HabitLog[]>;
  selectedDate: string;
  todayStr: string;
  categoryMap: Record<string, { label: string; color?: string | null }>;
  primaryColor: string;
  amountValueMap: Record<string, number>;
  completedCount: number;
  totalCount: number;
  onToggleHabit: (
    habit: Habit,
    event?: React.MouseEvent | React.KeyboardEvent,
  ) => void;
  onAmountDelta: (
    habit: Habit,
    delta: number,
    event?: React.MouseEvent | React.KeyboardEvent,
  ) => void;
  onSetConfettiEl: (el: HTMLElement | null) => void;
  onOpenAnalysis: (habitId: string) => void;
  onGraduate: (habit: Habit, el: HTMLElement | null) => void;
  /** CTA empty-state "Buat Habit Pertama" (ONE-CLICK-5). */
  onQuickAddHabit: () => void;
}

export function HabitGridSection({
  activeHabits,
  goalTitleById,
  scheduledHabits,
  filteredHabits,
  nextOccurrences,
  dragMode,
  viewFilter,
  setViewFilter,
  toggleDragMode,
  sensors,
  handleDragEnd,
  completionMap,
  togglingIds,
  recentlyCompleted,
  completedAtMap,
  monthLogsCache,
  selectedDate,
  todayStr,
  categoryMap,
  primaryColor,
  amountValueMap,
  completedCount,
  totalCount,
  onToggleHabit,
  onAmountDelta,
  onSetConfettiEl,
  onOpenAnalysis,
  onGraduate,
  onQuickAddHabit,
}: HabitGridSectionProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h3 className="premium-label">Habits</h3>
        {/* FIX-AUDIT-23 (#2): div kontrol diberi flex-wrap + segmen dibuat
            w-full <sm — dulu "Atur Urutan" (114px) + segmen (239px) = 361px
            di kotak 288px → 57px terpotong di 320–375px. Sekarang di layar
            sempit segmen ambil baris sendiri (pill sama lebar, target sentuh
            lebih besar); ≥sm kembali 1 baris seperti semula. Logika filter/
            dragMode tidak berubah. */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
            {completedCount}/{totalCount}
          </span>
          {/* PHASE4-POLISH: drag-to-reorder toggle. When active, hides the
              filter chips and shows a "Selesai" button to exit drag mode. */}
          {activeHabits.length > 0 && (
            <Button
              type="button"
              variant={dragMode ? 'default' : 'outline'}
              size="sm"
              onClick={toggleDragMode}
              className="h-7 text-xs rounded-full px-3"
              title={dragMode ? 'Selesai mengatur urutan' : 'Atur urutan habit'}
            >
              <GripVertical className="h-3 w-3" />
              {dragMode ? 'Selesai' : 'Atur Urutan'}
            </Button>
          )}
          {!dragMode && (
            <div
              className="premium-segment w-full sm:w-auto min-w-0"
              role="group"
              aria-label="Filter habit"
            >
              {(
                [
                  ['all', 'Semua'],
                  ['incomplete', 'Belum'],
                  ['completed', 'Selesai'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setViewFilter(key)}
                  data-active={viewFilter === key}
                  aria-pressed={viewFilter === key}
                  className="premium-segment-item flex-1 min-w-0"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PHASE4-POLISH: drag-mode helper banner. Lets the user know that
          tapping the grip handle and dragging will reorder habits, and
          that normal tap-to-toggle is disabled while in drag mode. */}
      {dragMode && activeHabits.length > 0 && (
        <div className="premium-card mb-3 rounded-2xl px-3 py-2 flex items-center gap-2.5 text-xs text-muted-foreground">
          <span className="chip-soft chip-soft-teal h-6 w-6 shrink-0">
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          <span>
            <span className="font-semibold text-foreground">Mode Atur Urutan:</span>{' '}
            Tahan tombol geser di sudut kartu untuk mengubah urutan. Perubahan tersimpan otomatis.
          </span>
        </div>
      )}

      {/* Task 37: hari tanpa habit terjadwal — bukan error, cuma jadwal.
          Tampilkan kapan habit terdekat muncul lagi supaya tidak terasa
          "kehilangan" habit (kecemasan tipe pemula-rajin). */}
      {activeHabits.length === 0 ? (
        <div className="premium-card premium-empty rounded-2xl">
          <div className="premium-empty-orb">
            <ClipboardList className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Belum ada habit aktif
          </p>
          <p className="text-xs text-muted-foreground/70 -mt-0.5">
            Buka Habit Master untuk membuatnya!
          </p>
          {/* ONE-CLICK-5: empty state is no longer a dead end — the CTA
              opens the add-habit dialog directly (same flow as the FAB
              "Habit Baru"): trigger the quick-add action + jump to the
              settings tab, where the HabitMaster auto-opens its form. */}
          <Button
            size="sm"
            className="btn-primary-gradient anim-press"
            onClick={onQuickAddHabit}
          >
            <Plus className="h-4 w-4" />
            Buat Habit Pertama
          </Button>
        </div>
      ) : !dragMode && scheduledHabits.length === 0 ? (
        <div className="premium-card premium-empty rounded-2xl">
          <div className="premium-empty-orb">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 2v4" />
              <path d="M16 2v4" />
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <path d="M3 10h18" />
            </svg>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Tidak ada habit terjadwal hari ini
          </p>
          <p className="text-xs text-muted-foreground/70 -mt-0.5 max-w-xs text-center leading-relaxed">
            Beberapa habit hanya tampil di hari tertentu — hari tanpa jadwal
            tidak menghitung bolong, jadi santai saja.
            {nextOccurrences.length > 0 && (
              <span className="block mt-1.5">
                Berikutnya:{' '}
                {nextOccurrences
                  .map((o) => `${o.emoji} ${o.name} (${o.label})`)
                  .join(' · ')}
              </span>
            )}
          </p>
        </div>
      ) : !dragMode && filteredHabits.length === 0 ? (
        <div className="premium-card premium-empty rounded-2xl">
          <div className="premium-empty-orb">
            {viewFilter === 'completed' ? (
              <Flag className="h-8 w-8 text-primary" />
            ) : (
              <CheckCircle2 className="h-8 w-8 text-primary" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {viewFilter === 'completed'
              ? 'Belum ada habit yang selesai.'
              : viewFilter === 'incomplete'
                ? 'Semua habit selesai — kerja bagus!'
                : 'Tidak ada habit yang cocok dengan filter ini.'}
          </p>
        </div>
      ) : dragMode ? (
        // ── Drag mode: wrap the grid in DndContext + SortableContext ──
        // Drag mode ignores the viewFilter (always shows ALL active habits
        // so every reorderable item is visible). SortableHabitCard adds
        // the grip handle + DnD listeners; outside drag mode it would be a
        // transparent wrapper, but we only render it inside this branch.
        // BUGHUNT-54 (3-b #2): cabang ini kini merender SEMUA habit aktif
        // (activeHabits), bukan hanya yang TERJADWAL hari itu — habit
        // mingguan/bulanan jadi bisa diurutkan di hari non-jadwalnya.
        // Empty-state "tidak terjadwal" & filter di-guard !dragMode supaya
        // cabang ini menang saat mode urutan aktif; handleDragEnd (parent)
        // memakai activeHabits — sumber array yang SAMA dengan yang
        // dirender di sini agar indeks reorder cocok.
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={activeHabits.map((h) => h.id)}
            strategy={rectSortingStrategy}
          >
            <div className="habit-grid">
              {activeHabits.map((habit, idx) => {
                const isDone = !!(completionMap[habit.id] ?? false);
                const isToggling = togglingIds.has(habit.id);
                const justCompleted = recentlyCompleted.has(habit.id);
                const doneTime = isDone ? completedAtMap[habit.id] : null;

                return (
                  <SortableHabitCard
                    key={habit.id}
                    habit={habit}
                    goalTitle={habit.goalId ? goalTitleById?.[habit.goalId] : undefined}
                    idx={idx}
                    isDone={isDone}
                    isToggling={isToggling}
                    justCompleted={justCompleted}
                    doneTime={doneTime ?? null}
                    monthLogs={monthLogsCache?.[habit.id]}
                    selectedDate={selectedDate}
                    todayStr={todayStr}
                    categoryColor={categoryMap[habit.category]?.color || 'slate'}
                    primaryColor={primaryColor}
                    amountValue={amountValueMap[habit.id] ?? 0}
                    onToggleHabit={onToggleHabit}
                    onAmountDelta={onAmountDelta}
                    onSetConfettiEl={onSetConfettiEl}
                    onOpenAnalysis={onOpenAnalysis}
                    onGraduate={onGraduate}
                    dragMode={dragMode}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="habit-grid">
          {filteredHabits.map((habit, idx) => {
            const isDone = !!(completionMap[habit.id] ?? false);
            const isToggling = togglingIds.has(habit.id);
            const justCompleted = recentlyCompleted.has(habit.id);
            const doneTime = isDone ? completedAtMap[habit.id] : null;

            return (
              <HabitCard
                key={habit.id}
                habit={habit}
                goalTitle={habit.goalId ? goalTitleById?.[habit.goalId] : undefined}
                idx={idx}
                isDone={isDone}
                isToggling={isToggling}
                justCompleted={justCompleted}
                doneTime={doneTime ?? null}
                monthLogs={monthLogsCache?.[habit.id]}
                selectedDate={selectedDate}
                todayStr={todayStr}
                categoryColor={categoryMap[habit.category]?.color || 'slate'}
                primaryColor={primaryColor}
                amountValue={amountValueMap[habit.id] ?? 0}
                onToggleHabit={onToggleHabit}
                onAmountDelta={onAmountDelta}
                onSetConfettiEl={onSetConfettiEl}
                onOpenAnalysis={onOpenAnalysis}
                onGraduate={onGraduate}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
