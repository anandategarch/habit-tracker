'use client';

// ---------------------------------------------------------------------------
// src/components/gym/use-gym-sets.ts — query & mutasi JURNAL SET (Task 74 F3).
//
// * useGymZoneSets(zone) : GET /api/gym/sets?zone=… — hanya aktif saat sheet
//                          zona terbuka (enabled = zone != null), cache
//                          per-zona ['gym-sets', zone].
// * useGymSetSave()      : POST — catat/koreksi satu gerakan. Perayaan PR
//                          (toast + confetti + getar) DIPANGGIL PEMANGGIL
//                          lewat onSuccess (butuh elemen jangkar & nama zona),
//                          hook hanya menjaga data + invalidasi.
// * useGymSetDelete()    : DELETE ?id=… — hapus catatan (koreksi salah catat).
//
// Patch optimistas HATI-HATI: payload klien hanya melihat jendela 30 hari,
// sedangkan PR sepanjang masa dihitung server dari SEMUA baris. Maka PR
// TIDAK dibangun ulang dari subset — hanya entri (nameKey, unit) yang baru
// saja LULUS PR yang dinaikkan (tidak mungkin regresi); sisanya biarkan
// refetch segera yang menyamakan (query sheet aktif → refetch instan).
// ---------------------------------------------------------------------------

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  SET_LOG_PR_MAX,
  type GymExerciseUnit,
  type GymSetLogRow,
  type GymSetSaveResult,
  type GymZoneSetsPayload,
  type MuscleZoneKey,
} from '@/lib/muscle-map';

export interface GymSetSaveVars {
  zone: MuscleZoneKey;
  zoneLabel: string;
  exercise: string;
  sets: number;
  amount: number;
  unit: GymExerciseUnit;
  /** 'yyyy-MM-dd' Jakarta — default hari ini di server. */
  date?: string;
}

/** Query jurnal set satu zona — aktif hanya saat zona difokuskan. */
export function useGymZoneSets(zone: MuscleZoneKey | null) {
  return useQuery<GymZoneSetsPayload>({
    queryKey: ['gym-sets', zone],
    enabled: zone !== null,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch(`/api/gym/sets?zone=${encodeURIComponent(zone as string)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'Gagal memuat jurnal set');
      }
      return json as GymZoneSetsPayload;
    },
  });
}

/** Terbaru dulu: dayKey desc, tie-break createdAt desc (sama dengan lib). */
function byNewestFirst(a: GymSetLogRow, b: GymSetLogRow): number {
  if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? 1 : -1;
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
}

export function useGymSetSave() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: GymSetSaveVars): Promise<GymSetSaveResult> => {
      const res = await fetch('/api/gym/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zone: vars.zone,
          exercise: vars.exercise,
          sets: vars.sets,
          amount: vars.amount,
          unit: vars.unit,
          date: vars.date,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'Gagal menyimpan catatan');
      }
      return json as GymSetSaveResult;
    },
    onSuccess: (data) => {
      const key = ['gym-sets', data.log.zone] as const;
      const prev = qc.getQueryData<GymZoneSetsPayload>(key);
      if (prev) {
        // 1) Daftar riwayat: ganti baris hari sama / sisipkan baru, urut ulang.
        const withoutRow = prev.logs.filter((r) => r.id !== data.log.id);
        const logs = [data.log, ...withoutRow].sort(byNewestFirst);
        // 2) PR: HANYA entri yang barusan lulus PR dinaikkan (aman regresi —
        //    rekor lain termasuk >30 hari tidak tersentuh).
        let prs = prev.prs;
        if (data.isPr) {
          const { nameKey, exercise, unit, amount, sets, dayKey } = data.log;
          const existing = prs.find((p) => p.nameKey === nameKey && p.unit === unit);
          const totalLogs = withoutRow.filter((r) => r.nameKey === nameKey).length + 1;
          const updated = existing
            ? prs.map((p) =>
                p.nameKey === nameKey && p.unit === unit
                  ? { ...p, exercise, bestAmount: amount, bestSets: sets, bestDayKey: dayKey, totalLogs }
                  : p,
              )
            : [
                ...prs,
                { nameKey, exercise, unit, bestAmount: amount, bestSets: sets, bestDayKey: dayKey, totalLogs },
              ];
          prs = updated
            .sort((a, b) => b.bestAmount - a.bestAmount || a.exercise.localeCompare(b.exercise))
            .slice(0, SET_LOG_PR_MAX);
        }
        qc.setQueryData<GymZoneSetsPayload>(key, { ...prev, logs, prs });
      }
      // Refetch segera: server = sumber kebenaran PR (semua waktu).
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGymSetDelete() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { id: string; zone: MuscleZoneKey }) => {
      const res = await fetch(`/api/gym/sets?id=${encodeURIComponent(vars.id)}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'Gagal menghapus catatan');
      }
      return json as { ok: boolean };
    },
    onSuccess: (_data, vars) => {
      const key = ['gym-sets', vars.zone] as const;
      const prev = qc.getQueryData<GymZoneSetsPayload>(key);
      if (prev) {
        // Hanya buang barisnya; PR dibiarkan bagi refetch segera (PR sejatinya
        // tidak bisa dihitung ulang dari jendela 30 hari klien).
        qc.setQueryData<GymZoneSetsPayload>(key, {
          ...prev,
          logs: prev.logs.filter((r) => r.id !== vars.id),
        });
      }
      qc.invalidateQueries({ queryKey: key });
      toast.info('Catatan dihapus');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
