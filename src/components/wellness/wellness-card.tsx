'use client';

// ---------------------------------------------------------------------------
// src/components/wellness/wellness-card.tsx — kartu TUBUH & GIZI (Task 73,
// Fase 2 "Gym Cerdas"): air + protein + berat badan ringan di Beranda,
// persis setelah kartu Check-in Harian (REFLECT → bahan bakar tubuh).
//
// Data: GET /api/wellness (query key ['wellness', tanggal] — cache terbagih).
// Tulis: PUT /api/wellness PARTIAL (FIFO promise-chain — pola DailyCheckInCard
// supaya tap beruntun tidak saling menimpa), optimistic via setQueryData +
// applyTodayPatch (hitungan murni SAMA dengan server → refetch tanpa flicker),
// rollback snapshot + toast bila gagal.
// ---------------------------------------------------------------------------

import { useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  applyTodayPatch,
  type WellnessPayload,
  type WellnessPatch,
} from '@/lib/wellness';
import { WaterTracker } from './water-tracker';
import { ProteinTracker } from './protein-tracker';
import { WeightTracker } from './weight-tracker';

export function WellnessCard({ date }: { date: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery<WellnessPayload>({
    queryKey: ['wellness', date],
    queryFn: async () => {
      const res = await fetch('/api/wellness');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as WellnessPayload;
    },
    staleTime: 15_000,
  });

  // Promise-chain FIFO untuk semua penyimpanan (pola DailyCheckInCard):
  // tap air → protein → berat beruntun dikirim berurutan, bukan paralel.
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  const applyPatch = useCallback(
    (patch: Omit<WellnessPatch, 'date'>) => {
      // Optimistic: perbarui cache SEKARANG dengan hitungan murni yang sama
      // dengan server (applyTodayPatch). Snapshot untuk rollback.
      const snapshot = queryClient.getQueryData<WellnessPayload>(['wellness', date]);
      if (snapshot) {
        queryClient.setQueryData(['wellness', date], applyTodayPatch(snapshot, patch));
      }
      saveChainRef.current = saveChainRef.current
        .then(async () => {
          const res = await fetch('/api/wellness', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, ...patch } satisfies WellnessPatch),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        })
        .then(() => {
          // Server jadi sumber kebenaran (weekly avg, dsb. ikut disegarkan).
          void queryClient.invalidateQueries({ queryKey: ['wellness'] });
          // Audit 77-e: berat terakhir DIPAKAI lintas-fitur — estimasi kkal
          // kardio (['gym-cardio']) dan hint berat foto progres
          // (['gym-photos']). Segarkan konsumennya hanya saat patch ini
          // menyentuh berat (tap air/protein tak memicu refetch ekstra).
          if (patch.weightKg !== undefined) {
            void queryClient.invalidateQueries({ queryKey: ['gym-cardio'] });
            void queryClient.invalidateQueries({ queryKey: ['gym-photos'] });
          }
        })
        .catch(() => {
          toast.error('Gagal menyimpan — coba lagi');
          if (snapshot) queryClient.setQueryData(['wellness', date], snapshot);
        });
    },
    [date, queryClient],
  );

  return (
    <section
      className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 premium-fade-up"
      aria-label="Tubuh dan gizi harian"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold leading-snug">
            Bahan bakar &amp; tubuhmu
          </h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Air, protein, dan berat — catat sekejap, tren terlihat sendiri
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
          ✨ Baru
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-9 rounded-xl" />
            <div className="flex gap-1.5">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-11 w-9 rounded-xl" />
              ))}
            </div>
          </div>
          <Skeleton className="h-2.5 w-full rounded-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : isError || !data ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">Gagal memuat Tubuh &amp; Gizi</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-border/70 px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Coba Lagi
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <WaterTracker
            value={data.today.waterGlasses}
            target={data.targets.waterGlasses}
            onChange={(next) => applyPatch({ waterGlasses: next })}
          />

          <div className="border-t border-border/60" />

          <ProteinTracker
            value={data.today.proteinGram}
            targetGram={data.targets.proteinGram}
            targetFromWeight={data.targets.proteinFromWeight}
            onChange={(next) => applyPatch({ proteinGram: next })}
          />

          <div className="border-t border-border/60" />

          <WeightTracker
            todayValue={data.today.weightKg}
            latestKg={data.weight.latestKg}
            latestYmd={data.weight.latestYmd}
            delta7Kg={data.weight.delta7Kg}
            trend={data.weight.trend}
            onSave={(kg) => applyPatch({ weightKg: kg })}
          />

          {/* Ringkasan 7 hari (server-side, muncul setelah ada catatan). */}
          {(data.weekly.avgWater7 != null || data.weekly.avgProtein7 != null) && (
            <p className="border-t border-border/60 pt-3 text-[11px] leading-relaxed text-muted-foreground">
              Rata 7 hari:
              {data.weekly.avgWater7 != null && (
                <> 💧 {data.weekly.avgWater7.toLocaleString('id-ID')} gelas</>
              )}
              {data.weekly.avgWater7 != null && data.weekly.avgProtein7 != null && <> ·</>}
              {data.weekly.avgProtein7 != null && (
                <> 🍗 {data.weekly.avgProtein7} g protein</>
              )}
              {data.weekly.waterGoalDays7 > 0 && (
                <> · 🎯 {data.weekly.waterGoalDays7}× target air penuh</>
              )}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
