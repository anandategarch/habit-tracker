'use client';

// hooks/use-habit-options.ts — opsi label habit (kategori/prioritas/difficulty).
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

export interface HabitOptionRow {
  id: string;
  type: string;
  label: string;
  color?: string | null;
  sortOrder: number;
}

async function fetchOptions(type?: string): Promise<HabitOptionRow[]> {
  const url = type ? `/api/habit-options?type=${encodeURIComponent(type)}` : '/api/habit-options';
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = (await res.json()) as { options?: HabitOptionRow[] };
  return json.options ?? [];
}

/** Query opsi; `type` memfilter (category | priority | difficulty). */
export function useHabitOptions(type?: string) {
  const query = useQuery({
    queryKey: ['habit-options', type ?? 'all'],
    queryFn: () => fetchOptions(type),
    staleTime: 60_000,
  });
  return query;
}

/** Mutasi create/update/delete opsi + invalidasi cache. */
export function useHabitOptionMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['habit-options'] });
    void qc.invalidateQueries({ queryKey: ['habits'] });
  };

  const create = useMutation({
    mutationFn: async (payload: { type: string; label: string; color?: string }) => {
      const res = await fetch('/api/habit-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Gagal menambah opsi');
      return res.json();
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async (payload: { id: string; label: string; color?: string }) => {
      const res = await fetch(`/api/habit-options/${payload.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: payload.label, color: payload.color }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Gagal menyimpan opsi');
      return res.json();
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/habit-options/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Gagal menghapus opsi');
      return res.json();
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
