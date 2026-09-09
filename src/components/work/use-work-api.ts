// ---------------------------------------------------------------------------
// src/components/work/use-work-api.ts — hook React Query + mutasi Meja Kerja
// (Task 17-a). Semua request relative path; invalidasi prefix ['work'] supaya
// query hari ini + hasil pencarian ikut refresh setelah mutasi.
// ---------------------------------------------------------------------------
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AiParsedPayload, WorkPayload, WorkSearchResult, WorkTaskItem } from './work-types';

/** fetch JSON kecil dengan pesan error Indonesia dari server. */
async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  let data: unknown = {};
  try {
    data = await res.json();
  } catch {
    // body kosong / non-JSON — biarkan {} lalu lempar error generik di bawah.
  }
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : 'Terjadi kesalahan internal server';
    throw new Error(message);
  }
  return data as T;
}

/** Query utama: payload satu hari (routines + tasks + notes + stats). */
export function useWorkData(date: string) {
  return useQuery<WorkPayload>({
    queryKey: ['work', date],
    queryFn: () => jsonFetch<WorkPayload>(`/api/work?date=${date}`),
    staleTime: 30_000,
  });
}

/** Pencarian tugas & catatan (dipanggil dengan debounce oleh UI). */
export function useWorkSearch(q: string) {
  const enabled = q.trim().length >= 2;
  return useQuery<WorkSearchResult>({
    queryKey: ['work-search', q.trim()],
    queryFn: () => jsonFetch<WorkSearchResult>(`/api/work/search?q=${encodeURIComponent(q.trim())}`),
    enabled,
    placeholderData: (prev) => prev,
  });
}

// ── Rutinitas ──────────────────────────────────────────────────────────────

export function useSaveRoutine(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; title: string; timeOfDay: string }) =>
      input.id
        ? jsonFetch(`/api/work/routines/${input.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ title: input.title, timeOfDay: input.timeOfDay }),
          })
        : jsonFetch('/api/work/routines', {
            method: 'POST',
            body: JSON.stringify({ title: input.title, timeOfDay: input.timeOfDay }),
          }),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ['work'] });
      toast.success(input.id ? 'Rutinitas diperbarui' : `Rutinitas "${input.title}" ditambahkan`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetRoutineActive(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      jsonFetch(`/api/work/routines/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      }),
    onSuccess: (_d, { active }) => {
      qc.invalidateQueries({ queryKey: ['work'] });
      toast.success(active ? 'Rutinitas diaktifkan' : 'Rutinitas diberhentikan sementara');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteRoutine(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => jsonFetch(`/api/work/routines/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work'] });
      toast.success('Rutinitas dihapus');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Toggle selesai rutinitas hari ini — optimistik agar animasi tap terasa instan. */
export function useToggleRoutineLog(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routineId, done }: { routineId: string; done: boolean }) =>
      jsonFetch(`/api/work/routines/${routineId}/logs`, {
        method: 'POST',
        body: JSON.stringify({ dayKey: date, done }),
      }),
    onMutate: async ({ routineId, done }) => {
      await qc.cancelQueries({ queryKey: ['work', date] });
      const prev = qc.getQueryData<WorkPayload>(['work', date]);
      if (prev) {
        qc.setQueryData<WorkPayload>(['work', date], {
          ...prev,
          routines: prev.routines.map((r) =>
            r.id === routineId
              ? { ...r, doneToday: done, doneAt: done ? new Date().toISOString() : null }
              : r
          ),
          stats: {
            ...prev.stats,
            rutinSelesai: prev.stats.rutinSelesai + (done ? 1 : -1),
          },
        });
      }
      return { prev };
    },
    onError: (_error, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['work', date], ctx.prev);
      toast.error('Gagal menyimpan status rutinitas');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['work', date] });
    },
  });
}

// ── Tugas lepas ────────────────────────────────────────────────────────────

export interface TaskInput {
  title: string;
  dayKey?: string | null;
  status?: string;
  notes?: string | null;
}

export function useSaveTask(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskInput & { id?: string }) =>
      input.id
        ? jsonFetch(`/api/work/tasks/${input.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              title: input.title,
              ...(input.dayKey !== undefined ? { dayKey: input.dayKey } : {}),
              ...(input.status !== undefined ? { status: input.status } : {}),
              ...(input.notes !== undefined ? { notes: input.notes } : {}),
            }),
          })
        : jsonFetch('/api/work/tasks', {
            method: 'POST',
            body: JSON.stringify({
              title: input.title,
              dayKey: input.dayKey ?? null,
              status: input.status ?? 'todo',
              notes: input.notes ?? null,
            }),
          }),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ['work'] });
      toast.success(input.id ? 'Tugas diperbarui' : `Tugas "${input.title}" ditambahkan`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Toggle lingkaran selesai (todo/jalan/nunggu → selesai; selesai → todo) — optimistik. */
export function useToggleTaskDone(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ task, done }: { task: WorkTaskItem; done: boolean }) =>
      jsonFetch(`/api/work/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: done ? 'selesai' : 'todo' }),
      }),
    onMutate: async ({ task, done }) => {
      await qc.cancelQueries({ queryKey: ['work', date] });
      const prev = qc.getQueryData<WorkPayload>(['work', date]);
      if (prev) {
        const oldDone = task.status === 'selesai';
        const bump = (done ? 1 : 0) - (oldDone ? 1 : 0);
        qc.setQueryData<WorkPayload>(['work', date], {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  status: done ? 'selesai' : 'todo',
                  completedAt: done ? new Date().toISOString() : null,
                  overdue: done ? false : t.overdue,
                }
              : t
          ),
          stats: {
            ...prev.stats,
            tugasSelesai: prev.stats.tugasSelesai + bump,
            ...(task.status === 'todo' && done
              ? { tugasTodo: prev.stats.tugasTodo - 1 }
              : {}),
            ...(task.status === 'jalan' && done
              ? { tugasJalan: prev.stats.tugasJalan - 1 }
              : {}),
            ...(task.status === 'nunggu' && done
              ? { tugasNunggu: prev.stats.tugasNunggu - 1 }
              : {}),
            ...(!done && task.status === 'selesai'
              ? { tugasTodo: prev.stats.tugasTodo + 1 }
              : {}),
          },
        });
      }
      return { prev };
    },
    onError: (_error, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['work', date], ctx.prev);
      toast.error('Gagal menyimpan status tugas');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['work', date] });
    },
  });
}

export function useDeleteTask(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => jsonFetch(`/api/work/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work'] });
      toast.success('Tugas dihapus');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// ── Catatan ────────────────────────────────────────────────────────────────

export function useSaveNote(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; content: string; tag?: string | null; pinned?: boolean }) =>
      input.id
        ? jsonFetch(`/api/work/notes/${input.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              content: input.content,
              ...(input.tag !== undefined ? { tag: input.tag } : {}),
              ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
            }),
          })
        : jsonFetch('/api/work/notes', {
            method: 'POST',
            body: JSON.stringify({ content: input.content, tag: input.tag ?? null }),
          }),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ['work'] });
      toast.success(input.id ? 'Catatan diperbarui' : 'Catatan kilat tersimpan');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useToggleNotePin(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      jsonFetch(`/api/work/notes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ pinned }),
      }),
    onMutate: async ({ id, pinned }) => {
      await qc.cancelQueries({ queryKey: ['work', date] });
      const prev = qc.getQueryData<WorkPayload>(['work', date]);
      if (prev) {
        qc.setQueryData<WorkPayload>(['work', date], {
          ...prev,
          notes: prev.notes.map((n) => (n.id === id ? { ...n, pinned } : n)),
        });
      }
      return { prev };
    },
    onError: (_error, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['work', date], ctx.prev);
      toast.error('Gagal menyimpan status pin');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['work'] });
    },
  });
}

export function useDeleteNote(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => jsonFetch(`/api/work/notes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work'] });
      toast.success('Catatan dihapus');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// ── Asisten AI ─────────────────────────────────────────────────────────────

export function useAiParse() {
  return useMutation({
    mutationFn: (text: string) =>
      jsonFetch<AiParsedPayload>('/api/work/ai', {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),
    onError: (error: Error) => toast.error(error.message),
  });
}

/** "Terapkan semua" hasil AI: POST tiap tugas & catatan satu per satu. */
export async function applyAiResult(
  parsed: AiParsedPayload,
  dayKey: string
): Promise<{ tasks: number; notes: number }> {
  let okTasks = 0;
  let okNotes = 0;
  for (const task of parsed.tasks) {
    try {
      await jsonFetch('/api/work/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: task.title, dayKey }),
      });
      okTasks++;
    } catch {
      // lanjut item berikutnya — toast akhir melaporkan jumlah sukses.
    }
  }
  for (const note of parsed.notes) {
    try {
      await jsonFetch('/api/work/notes', {
        method: 'POST',
        body: JSON.stringify({ content: note.content }),
      });
      okNotes++;
    } catch {
      // idem.
    }
  }
  return { tasks: okTasks, notes: okNotes };
}
