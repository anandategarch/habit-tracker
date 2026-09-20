'use client';

// ---------------------------------------------------------------------------
// src/components/gym/use-gym-program.ts — query & mutasi PROGRAM LATIHAN
// (Task 75 F4).
//
// * useGymProgram()          : GET /api/gym/program — program aktif + saved.
// * useGymProgramCreate()    : POST — buat + aktifkan (custom atau salinan
//                              preset; server yang menjamin satu-satunya
//                              program aktif lewat transaksi).
// * useGymProgramUpdate()    : PUT — ubah program tersimpan (aktif → live).
// * useGymProgramActivate()  : PATCH { id } — switch program (minggu ke-1 baru).
// * useGymProgramStop()      : PATCH { action: 'stop' } — hentikan (baris tetap).
// * useGymProgramDelete()    : DELETE ?id=… — hapus program tersimpan.
//
// Tanpa patch optimistas: payload program berbentuk agregat mingguan yang
// dihitung server (adherence, strip minggu, minggu ke-N) — mutasi cukup
// invalidasi ['gym-program'] dan biarkan refetch instan (payload ringan,
// query aktif saat tab Gym terbuka / kartu Beranda).
// ---------------------------------------------------------------------------

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { GymProgramDay, GymProgramPayload } from '@/lib/muscle-map';

/** Query program latihan (aktif + tersimpan). */
export function useGymProgram() {
  return useQuery<GymProgramPayload>({
    queryKey: ['gym-program'],
    queryFn: async () => {
      const res = await fetch('/api/gym/program');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'Gagal memuat program latihan');
      }
      return json as GymProgramPayload;
    },
    staleTime: 30_000,
  });
}

export interface ProgramMutationVars {
  name: string;
  emoji: string;
  days: GymProgramDay[];
}

async function postProgramJson(method: 'POST' | 'PUT', body: Record<string, unknown>) {
  const res = await fetch('/api/gym/program', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? 'Gagal menyimpan program');
  }
  return json as { ok: boolean; id: string; name: string };
}

/** Buat + aktifkan program (dipakai builder & "pakai template"). */
export function useGymProgramCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: ProgramMutationVars) =>
      postProgramJson('POST', { name: vars.name, emoji: vars.emoji, days: vars.days }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['gym-program'] });
      toast.success(`Program "${data.name}" aktif — semangat! 💪`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Ubah program tersimpan (aktif → perubahan langsung hidup). */
export function useGymProgramUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: ProgramMutationVars & { id: string }) =>
      postProgramJson('PUT', { id: vars.id, name: vars.name, emoji: vars.emoji, days: vars.days }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['gym-program'] });
      toast.success(`Program "${data.name}" diperbarui`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Aktifkan program tersimpan (switch — minggu ke-1 dimulai ulang). */
export function useGymProgramActivate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; name: string }) => {
      const res = await fetch('/api/gym/program', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: vars.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'Gagal mengaktifkan program');
      }
      return json as { ok: boolean; id: string; name: string };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['gym-program'] });
      toast.success(`Program "${data.name}" aktif — minggu ke-1 dimulai 🔁`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Hentikan program aktif (baris tetap tersimpan). */
export function useGymProgramStop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/gym/program', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'Gagal menghentikan program');
      }
      return json as { ok: boolean; stopped: boolean };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['gym-program'] });
      toast.info(data.stopped ? 'Program dihentikan — latihan bebas kembali' : 'Tidak ada program aktif');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Hapus program tersimpan. */
export function useGymProgramDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; name: string }) => {
      const res = await fetch(`/api/gym/program?id=${encodeURIComponent(vars.id)}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'Gagal menghapus program');
      }
      return json as { ok: boolean; wasActive: boolean };
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ['gym-program'] });
      toast.info(`Program "${vars.name}" dihapus${data.wasActive ? ' (program aktif berakhir)' : ''}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
