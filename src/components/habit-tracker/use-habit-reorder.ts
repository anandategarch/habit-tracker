'use client';

// components/habit-tracker/use-habit-reorder.ts — drag-to-reorder habit
// (@dnd-kit) + state urutan optimistik.
//
// Task 71-c (split god file): DIEKSTRAKSI VERBATIM dari daily-tracker.tsx —
// sensors, handleDragEnd (PUT /api/habits/[id] per diff sortOrder + snapshot
// rollback BUGHUNT-54 3-b #3), toggleDragMode, dan state optimistic
// localHabitsOverride. Hook ini juga memiliki `habits` (override ?? query)
// beserta turunannya `activeHabits` — handleDragEnd dan parent (grid, XP,
// jadwal, comeback) memakai array yang SAMA dengan yang dirender grid mode
// drag (sumber indeks BUGHUNT-54 3-b #2), tanpa duplikasi memo.

import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type SensorDescriptor,
  type SensorOptions,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import type { Habit } from './daily-tracker-types';

export interface HabitReorderApi {
  /** Daftar habit berlaku: override optimistik (saat reorder) ?? data query. */
  habits: Habit[];
  /** Habit aktif (tidak arsip, tidak dijeda, belum lulus) — semesta grid/XP. */
  activeHabits: Habit[];
  dragMode: boolean;
  /** Tipe keluaran useSensors (diteruskan apa adanya ke DndContext). */
  sensors: SensorDescriptor<SensorOptions>[];
  handleDragEnd: (event: DragEndEvent) => void;
  toggleDragMode: () => void;
}

export function useHabitReorder(
  queryHabits: Habit[],
  setViewFilter: (f: 'all' | 'incomplete' | 'completed') => void,
): HabitReorderApi {
  const queryClient = useQueryClient();

  // PHASE4-POLISH: drag-to-reorder support. When the user reorders habits via
  // the @dnd-kit drag handle, we apply the new order optimistically via a
  // local override. The override is cleared after the server confirms (PUT
  // succeeds + query refetch). While `localHabitsOverride` is set, it
  // shadows the query data so the UI reflects the new order immediately.
  const [dragMode, setDragMode] = useState(false);
  const [localHabitsOverride, setLocalHabitsOverride] = useState<Habit[] | null>(null);
  const habits = localHabitsOverride ?? queryHabits;

  const activeHabits = useMemo(
    // Task 36: habit yang sudah LULUS keluar dari rotasi harian — tugasnya
    // selesai, bukan dihapus (masih terlihat di Habit Master + XP tetap).
    () => habits.filter((h) => h.isActive && !h.isArchived && !h.graduatedAt),
    [habits],
  );

  // ── PHASE4-POLISH: drag-to-reorder (@dnd-kit) ──────────────────────────
  // Sensors: PointerSensor (mouse), TouchSensor (mobile drag — required for
  // touch devices), KeyboardSensor (a11y). Activation constraints prevent
  // accidental drags when the user is just tapping a card to toggle it.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      // BUGHUNT-54 (3-b #2): sumber array HARUS sama dengan yang dirender
      // grid mode drag — SEMUA habit aktif (activeHabits), bukan hanya yang
      // terjadwal hari itu. Dulu indeks reorder dihitung dari scheduledHabits,
      // sehingga habit mingguan/bulanan tidak bisa diurutkan di luar hari
      // jadwalnya. Task 39 (#2) tetap terpenuhi secara alami: penomoran
      // ulang kini mencakup SELURUH habit aktif — tidak ada dua habit
      // ber-sortOrder sama setelah refresh.
      const oldIndex = activeHabits.findIndex((h) => h.id === active.id);
      const newIndex = activeHabits.findIndex((h) => h.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      const reorderedActive = arrayMove(activeHabits, oldIndex, newIndex);

      // Re-assign `sortOrder` so the new array position matches the DB order
      // (0..N-1 across ALL active habits — scheduled or not). Collect only
      // the diffs to PUT.
      const updates: { id: string; sortOrder: number }[] = [];
      reorderedActive.forEach((h, idx) => {
        if (h.sortOrder !== idx) updates.push({ id: h.id, sortOrder: idx });
      });

      // Optimistic local override: reordered active habits (with new order
      // field) followed by the unchanged paused/graduated habits.
      const activeIds = new Set(reorderedActive.map((h) => h.id));
      const nonActive = habits.filter((h) => !activeIds.has(h.id));
      const reorderedAll: Habit[] = [
        ...reorderedActive.map((h, idx) => ({ ...h, sortOrder: idx })),
        ...nonActive,
      ];
      setLocalHabitsOverride(reorderedAll);

      // BUGHUNT-54 (3-b #3): snapshot sortOrder LAMA sebelum kirim. PUT
      // paralel non-atomik — satu gagal membuat urutan setengah-teraplikasi
      // menempel permanen; snapshot dipakai di catch untuk PUT-balik.
      // `habits` saat handler ini jalan masih nilai server (override baru
      // di-set di atas dan tidak pernah dibaca balik di sini).
      const priorOrders = new Map(habits.map((h) => [h.id, h.sortOrder]));

      // Persist each changed habit's order via PUT /api/habits/[id].
      // Parallel; invalidate the query on settle so the server-side truth
      // is re-fetched (and the local override cleared).
      // VERIFY-48 (48-b): fetch TIDAK reject pada 4xx/5xx — cek res.ok per
      // PUT dan lempar agar jalur catch (toast + revert) benar-benar jalan
      // untuk kegagalan server (dulu kegagalan senyap, order kembali tanpa
      // penjelasan).
      try {
        await Promise.all(
          updates.map(async (u) => {
            const res = await fetch(`/api/habits/${u.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sortOrder: u.sortOrder }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
          }),
        );
        await queryClient.invalidateQueries({ queryKey: ['habits'] });
        // Brief delay so the refetch lands before we drop the override —
        // otherwise a re-render with the stale query cache could flicker
        // back to the old order for one frame.
        setTimeout(() => setLocalHabitsOverride(null), 200);
      } catch {
        toast.error('Gagal menyimpan urutan');
        // BUGHUNT-54 (3-b #3): rollback best-effort — PUT-balik sortOrder
        // lama untuk semua update yang sudah terkirim (PUT yang tadi gagal
        // menjadi no-op dengan nilai sama; kegagalan rollback pun ditelan
        // allSettled — kebenaran akhir tetap lewat refetch di bawah).
        await Promise.allSettled(
          updates.map(async (u) => {
            const prior = priorOrders.get(u.id);
            if (prior === undefined) return;
            await fetch(`/api/habits/${u.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sortOrder: prior }),
            });
          }),
        );
        // Revert to server truth.
        await queryClient.invalidateQueries({ queryKey: ['habits'] });
        setLocalHabitsOverride(null);
      }
    },
    [activeHabits, habits, queryClient],
  );

  /** Toggle drag mode. When enabling, force viewFilter to "all" so every
   *  active habit is visible for reordering. When disabling, drop the
   *  optimistic override (any pending server update is left to complete —
   *  the next habits refetch will surface the truth). */
  const toggleDragMode = useCallback(() => {
    if (!dragMode) {
      setViewFilter('all');
      setDragMode(true);
    } else {
      setDragMode(false);
      setLocalHabitsOverride(null);
    }
  }, [dragMode, setViewFilter]);

  return {
    habits,
    activeHabits,
    dragMode,
    sensors,
    handleDragEnd,
    toggleDragMode,
  };
}
