// ---------------------------------------------------------------------------
// src/components/work/work-board-controller.ts — otak sub-tab "Papan" (pecahan
// Task 71-e dari work-board.tsx): mutasi (status tugas, simpan tugas, log
// rutinitas), derivasi kolom (rutinitas → Belum/Selesai + tugas lepas),
// sensor drag & drop, dan handler drop (termasuk aturan kartu rutinitas hanya
// boleh Belum ↔ Selesai). Query key & payload memakai hook use-work-api
// apa adanya.
// ---------------------------------------------------------------------------
'use client';

import { useMemo, useState } from 'react';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { useSetTaskStatus, useSaveTask, useToggleRoutineLog } from './use-work-api';
import type { WorkBoardPayload, WorkRoutineItem, WorkTaskItem, WorkTaskStatus } from './work-types';
import {
  COLUMN_DEFS,
  QUICK_NEXT,
  ROUTINE_PREFIX,
  ROUTINE_TIME_ORDER,
  routineDragId,
  type BoardItem,
} from './work-board-shared';

export function useBoardController({
  date,
  board,
  routines,
  holiday,
}: {
  date: string;
  board: WorkBoardPayload | undefined;
  routines: WorkRoutineItem[] | undefined;
  holiday: boolean;
}) {
  const setTaskStatus = useSetTaskStatus(date);
  const saveTask = useSaveTask(date);
  const toggleRoutine = useToggleRoutineLog(date);
  const [activeItem, setActiveItem] = useState<BoardItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Rutinitas aktif hari ini (kosong saat Mode Libur — kartu tidak dimunculkan).
  const activeRoutines = useMemo(
    () => (holiday ? [] : (routines ?? []).filter((r) => r.active)),
    [routines, holiday]
  );

  // Kolom Belum: rutinitas belum dicentang, urut Pagi → Siang → Sore.
  const openRoutines = useMemo(
    () =>
      [...activeRoutines]
        .filter((r) => !r.doneToday)
        .sort(
          (a, b) =>
            (ROUTINE_TIME_ORDER[a.timeOfDay] ?? 9) - (ROUTINE_TIME_ORDER[b.timeOfDay] ?? 9) ||
            a.sortOrder - b.sortOrder ||
            a.createdAt.localeCompare(b.createdAt)
        ),
    [activeRoutines]
  );

  // Kolom Selesai: rutinitas dicentang hari ini, terbaru dicentang di atas.
  const doneRoutines = useMemo(
    () =>
      [...activeRoutines]
        .filter((r) => r.doneToday)
        .sort(
          (a, b) =>
            (b.doneAt ?? '').localeCompare(a.doneAt ?? '') ||
            (ROUTINE_TIME_ORDER[a.timeOfDay] ?? 9) - (ROUTINE_TIME_ORDER[b.timeOfDay] ?? 9) ||
            a.sortOrder - b.sortOrder
        ),
    [activeRoutines]
  );

  const columns = useMemo(() => {
    const byStatus: Record<string, WorkTaskItem[]> = { todo: [], jalan: [], nunggu: [] };
    if (board) {
      for (const task of board.tasks) {
        (byStatus[task.status] ??= []).push(task);
      }
    }
    return byStatus;
  }, [board]);

  const doneToday = useMemo(() => board?.doneToday ?? [], [board]);
  const archive = useMemo(() => board?.archive ?? [], [board]);

  // Susunan kartu per kolom: rutinitas dulu (tulang punggung hari ini), lalu
  // tugas lepas. Jalan & Nunggu khusus tugas lepas (rutinitas biner).
  const columnItems = useMemo(() => {
    const routine = (r: WorkRoutineItem): BoardItem => ({ kind: 'routine', routine: r });
    const task = (t: WorkTaskItem): BoardItem => ({ kind: 'task', task: t });
    return {
      todo: [...openRoutines.map(routine), ...columns.todo.map(task)],
      jalan: columns.jalan.map(task),
      nunggu: columns.nunggu.map(task),
      selesai: [...doneRoutines.map(routine), ...doneToday.map(task)],
    };
  }, [openRoutines, doneRoutines, columns, doneToday]);

  const statusOf = (id: string): WorkTaskStatus | null => {
    if (id.startsWith(ROUTINE_PREFIX)) {
      const rid = id.slice(ROUTINE_PREFIX.length);
      if (openRoutines.some((r) => r.id === rid)) return 'todo';
      if (doneRoutines.some((r) => r.id === rid)) return 'selesai';
      return null;
    }
    for (const col of ['todo', 'jalan', 'nunggu'] as WorkTaskStatus[]) {
      if (columns[col].some((t) => t.id === id)) return col;
    }
    if (doneToday.some((t) => t.id === id)) return 'selesai';
    return null;
  };

  const findItem = (id: string): BoardItem | null => {
    for (const col of ['todo', 'jalan', 'nunggu', 'selesai'] as const) {
      const found = columnItems[col].find((item) =>
        item.kind === 'routine' ? routineDragId(item.routine) === id : item.task.id === id
      );
      if (found) return found;
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveItem(findItem(String(event.active.id)));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;
    const dragId = String(active.id);
    const overId = String(over.id);

    // Target: kolom (droppable id = status) atau kartu lain (ambil statusnya).
    const targetStatus = (COLUMN_DEFS.find((c) => c.id === overId)?.id ?? statusOf(overId)) as WorkTaskStatus | null;
    if (!targetStatus) return;

    // ── Kartu RUTINITAS: hanya boleh Belum ↔ Selesai (centang hari ini). ──
    if (dragId.startsWith(ROUTINE_PREFIX)) {
      const routine = activeRoutines.find((r) => routineDragId(r) === dragId);
      if (!routine) return;
      if (targetStatus === 'selesai' && !routine.doneToday) {
        toggleRoutine.mutate({ routineId: routine.id, done: true });
      } else if (targetStatus === 'todo' && routine.doneToday) {
        toggleRoutine.mutate({ routineId: routine.id, done: false });
      } else if (targetStatus === 'jalan' || targetStatus === 'nunggu') {
        toast.info(
          'Rutinitas cuma punya dua kondisi: Belum dan Selesai. Untuk kolom Jalan/Nunggu, pakai tugas lepas.'
        );
      }
      return;
    }

    // ── Kartu tugas lepas (logika lama). ──
    const task = [...columns.todo, ...columns.jalan, ...columns.nunggu, ...doneToday].find((t) => t.id === dragId);
    if (!task) return;
    if (targetStatus === task.status) return;

    setTaskStatus.mutate({ task, status: targetStatus });
  };

  const toggleRoutineCard = (routine: WorkRoutineItem) => {
    toggleRoutine.mutate({ routineId: routine.id, done: !routine.doneToday });
  };

  const quickMove = (task: WorkTaskItem) => {
    const next = QUICK_NEXT[task.status] ?? 'todo';
    setTaskStatus.mutate({ task, status: next });
  };

  const reopenArchived = (task: WorkTaskItem) => {
    saveTask.mutate({ id: task.id, title: task.title, status: 'todo', dayKey: date });
  };

  return {
    sensors,
    activeItem,
    activeRoutines,
    openRoutines,
    doneRoutines,
    columnItems,
    archive,
    handleDragStart,
    handleDragEnd,
    toggleRoutineCard,
    quickMove,
    reopenArchived,
    /** toggleRoutine.isPending — quickPending kartu rutinitas. */
    routinePending: toggleRoutine.isPending,
    /** setTaskStatus.isPending — quickPending kartu tugas lepas. */
    taskPending: setTaskStatus.isPending,
    /** saveTask.isPending — tombol "Buka lagi" di arsip. */
    archivePending: saveTask.isPending,
  };
}
