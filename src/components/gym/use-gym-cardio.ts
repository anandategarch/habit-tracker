'use client';

// ---------------------------------------------------------------------------
// src/components/gym/use-gym-cardio.ts — query & mutasi KARDIO (Task 76 Bonus).
//
// * useGymCardio()     : GET /api/gym/cardio — payload agregat (entri 30 hari
//                        + statistik minggu + jarak terjauh + berat estimasi).
//                        Query selalu aktif di tab Gym.
// * useGymCardioSave() : POST — catat satu sesi. Tanpa optimistic: payload
//                        agregat server (statistik minggu + PR jarak) disusun
//                        ulang lebih aman lewat invalidasi + refetch instan
//                        (pola use-gym-program).
// * useGymCardioDelete(): DELETE ?id= — hapus sesi (salah catat). Optimistic
//                        ringan: buang baris dari cache, sisanya refetch.
// ---------------------------------------------------------------------------

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  type GymCardioEntry,
  type GymCardioKind,
  type GymCardioPayload,
} from '@/lib/muscle-map';

const KEY = ['gym-cardio'] as const;

export interface GymCardioSaveVars {
  kind: GymCardioKind;
  durationMin: number;
  distanceKm: number | null;
  /** 'yyyy-MM-dd' Jakarta — default hari ini di server. */
  date?: string;
}

/** Query payload kardio (tab Gym). */
export function useGymCardio() {
  return useQuery<GymCardioPayload>({
    queryKey: KEY,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch('/api/gym/cardio');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'Gagal memuat kardio');
      }
      return json as GymCardioPayload;
    },
  });
}

export function useGymCardioSave() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: GymCardioSaveVars): Promise<{ entry: GymCardioEntry }> => {
      const res = await fetch('/api/gym/cardio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'Gagal menyimpan sesi kardio');
      }
      return json as { entry: GymCardioEntry };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGymCardioDelete() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { id: string }) => {
      const res = await fetch(`/api/gym/cardio?id=${encodeURIComponent(vars.id)}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'Gagal menghapus sesi kardio');
      }
      return json as { ok: boolean };
    },
    onSuccess: (_data, vars) => {
      // Optimistic ringan: buang baris daftar; statistik minggu milik server —
      // invalidasi refetch yang menyamakan.
      const prev = qc.getQueryData<GymCardioPayload>(KEY);
      if (prev) {
        qc.setQueryData<GymCardioPayload>(KEY, {
          ...prev,
          entries: prev.entries.filter((e) => e.id !== vars.id),
        });
      }
      qc.invalidateQueries({ queryKey: KEY });
      toast.info('Sesi kardio dihapus');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
