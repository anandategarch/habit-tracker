'use client';

// ---------------------------------------------------------------------------
// src/components/gym/use-gym.ts — query & mutasi Peta Otot (Task 64).
//
// * useGymMap()    : GET /api/gym (state Muscle Engine turunan).
// * useGymSetup()  : POST /api/gym — habit zona idempoten (7 habit).
// * useGymToggle() : selesaikan/batalkan sesi zona LEWAT PIPA SAH
//                    POST /api/habits/[id]/logs (XP/streak/pohon musim
//                    otomatis mengalir — kalkulasi inti tidak tersentuh),
//                    lalu invalidasi cache baku (resep use-habit-toggle)
//                    + keluarga ['gym'] + trigger animasi pump.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { burstFromElement } from '@/lib/confetti';
import { XP_MAP } from '@/lib/dashboard-helpers';
import { jakartaDateString } from '@/lib/jakarta-date';
import { MISSION_ZONE_DEFS, type GymMapPayload, type GymZonePayload, type MuscleZoneKey } from '@/lib/muscle-map';

export function useGymMap() {
  return useQuery<GymMapPayload>({
    queryKey: ['gym'],
    queryFn: async () => {
      const res = await fetch('/api/gym');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'Gagal memuat Peta Otot');
      }
      return json as GymMapPayload;
    },
    staleTime: 30_000,
  });
}

export function useGymSetup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/gym', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'Gagal menyiapkan Peta Otot');
      }
      return json as { ok: boolean; created: number; total: number };
    },
    onSuccess: (data) => {
      // Habit baru → tracker/dashboard/habit-options ikut menyegarkan.
      qc.invalidateQueries({ queryKey: ['gym'] });
      qc.invalidateQueries({ queryKey: ['habits'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['habit-options'] });
      toast.success(
        data.created > 0
          ? `Peta Otot siap! ${data.created} habit latihan dibuat 💪`
          : 'Peta Otot sudah siap 💪',
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface GymPumpState {
  /** Urutan zona yang sedang pump (Full Body → 6 zona, stagger 0.2s). */
  order: MuscleZoneKey[];
  /** Naik tiap sukses toggle → animasi diputar ulang (key remount). */
  nonce: number;
}

export function useGymToggle() {
  const qc = useQueryClient();
  const [pump, setPump] = useState<GymPumpState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const mutation = useMutation({
    mutationFn: async (vars: {
      zone: GymZonePayload;
      /** 'yyyy-MM-dd' Jakarta (hari yang dilihat — default hari ini). */
      date?: string;
      next: boolean;
      /** Elemen asal untuk confetti (fallback null → tanpa confetti). */
      el?: HTMLElement | null;
    }) => {
      if (!vars.zone.habitId) throw new Error('Habit zona belum terpasang');
      const date = vars.date ?? jakartaDateString();
      const res = await fetch(`/api/habits/${vars.zone.habitId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, completed: vars.next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'Gagal menyimpan sesi');
      }
      return json;
    },
    onSuccess: (_data, vars) => {
      // Invalidasi baku (resep use-habit-toggle) + keluarga gym.
      qc.invalidateQueries({ queryKey: ['gym'] });
      qc.invalidateQueries({ queryKey: ['habits'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['habit-logs-batch'] });
      qc.invalidateQueries({ queryKey: ['daily-logs-month'] });
      qc.invalidateQueries({ queryKey: ['habit-meta'] });

      if (vars.next) {
        const xp = XP_MAP[vars.zone.difficulty] ?? 10;
        toast.success(`Zona ${vars.zone.label} selesai! +${xp} XP 💪`);
        if (vars.el) burstFromElement(vars.el, { count: 20 });
        // Pump: zona tunggal; Full Body → SEMUA zona berjenjang 0.2s (desain #15).
        const order: MuscleZoneKey[] =
          vars.zone.key === 'fullbody'
            ? MISSION_ZONE_DEFS.map((d) => d.key)
            : [vars.zone.key];
        setPump((p) => ({ order, nonce: (p?.nonce ?? 0) + 1 }));
        if (timerRef.current) clearTimeout(timerRef.current);
        // Durasi animasi terpanjang (.72s) + stagger (order×.2s) + buffer.
        timerRef.current = setTimeout(() => setPump(null), 900 + order.length * 200);
      } else {
        toast.info(`Sesi ${vars.zone.label} dibatalkan`);
      }
    },
    onError: (e: Error, vars) => {
      toast.error(vars.next ? `Gagal menandai selesai: ${e.message}` : `Gagal membatalkan: ${e.message}`);
    },
  });

  return { ...mutation, pump };
}
