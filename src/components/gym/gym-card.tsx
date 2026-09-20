'use client';

// ---------------------------------------------------------------------------
// src/components/gym/gym-card.tsx — kartu gerbang "Peta Otot" di Beranda
// (Task 64; pola kartu-gateway TreeCard Task 55: dock mobile penuh, gerbang
// utama fitur = kartu Beranda → tap membuka tab Gym).
//
// Isi (aset user panel 14 + 01): mini peta depan dengan status zona samar,
// misi minggu "X / 6 zona", tagline. Belum setup → kartu CTA "Aktifkan"
// (POST /api/gym idempoten) lalu langsung membuka tab Gym.
// ---------------------------------------------------------------------------

import { ArrowRight, Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { jakartaDateString } from '@/lib/jakarta-date';
import {
  GYM_TAGLINE,
  zoneStatus,
  zoneVisualFill,
  zoneVisualOpacity,
  pumpPeakFor,
  type MuscleZoneKey,
} from '@/lib/muscle-map';
import { MuscleMap, type MuscleZoneVisual } from './muscle-map';
import { useGymMap, useGymSetup } from './use-gym';

interface GymCardProps {
  onOpen: () => void;
}

export function GymCard({ onOpen }: GymCardProps) {
  // Task 70 (audit 70-d MINOR #7): isError + refetch — error kini eksplisit
  // dengan aksi "Coba lagi" (sebelumnya kartu hilang senyap).
  const { data, isLoading, isError, refetch } = useGymMap();
  const setup = useGymSetup();

  if (isLoading) {
    return (
      // Task 70 (audit 70-d MINOR #7): status sr-only untuk screen reader
      // (diletakkan di LUAR elemen aria-hidden supaya benar-benar terbaca).
      <>
        <div className="mm-panel h-[168px] animate-pulse rounded-2xl" aria-hidden="true" />
        <span className="sr-only" role="status">Memuat peta otot…</span>
      </>
    );
  }
  if (isError || !data) {
    return (
      // Task 70 (audit 70-d MINOR #7): kartu error kecil + Coba lagi.
      <div
        role="alert"
        className="mm-panel flex items-center justify-between gap-3 rounded-2xl p-4"
      >
        <p className="text-xs text-[#a7b8c5]">Gagal memuat peta otot.</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="shrink-0 cursor-pointer text-[#64c9ff] hover:bg-white/5 hover:text-[#64c9ff]"
        >
          Coba Lagi
        </Button>
      </div>
    );
  }

  // CTA — belum ada habit zona.
  if (!data.setupDone) {
    return (
      <div className="mm-panel relative overflow-hidden rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <span className="chip-soft h-10 w-10 shrink-0" aria-hidden="true">
            <Dumbbell className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-[#eef7ff]">Peta Otot — Baru! 💪</h3>
            <p className="mt-0.5 text-xs text-[#a7b8c5]">
              Gym di rumah: 6 zona + Full Body. Selesaikan latihan, lihat ototmu "terlatih".
            </p>
          </div>
        </div>
        <Button
          onClick={() =>
            setup.mutate(undefined, {
              onSuccess: () => onOpen(),
            })
          }
          disabled={setup.isPending}
          className="mt-3 w-full cursor-pointer bg-gradient-to-r from-[#1589ff] to-[#26b8ff] text-white hover:opacity-90"
        >
          <Dumbbell className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {setup.isPending ? 'Menyiapkan…' : 'Aktifkan Peta Otot'}
        </Button>
      </div>
    );
  }

  // Kartu mini peta (status zona minggu berjalan).
  const nowMs = Date.now();
  const todayYmd = data.todayYmd ?? jakartaDateString();
  const visuals: MuscleZoneVisual[] = [...data.zones, ...(data.fullBody ? [data.fullBody] : [])].map(
    (zone) => {
      const status = zoneStatus(zone, nowMs, todayYmd);
      return {
        zone,
        status,
        fill: zoneVisualFill(status, zone.color),
        opacity: zoneVisualOpacity(status, zone.lifetimeSessions),
        peak: pumpPeakFor(zone.difficulty),
      };
    },
  );
  const doneToday = [...data.zones, ...(data.fullBody ? [data.fullBody] : [])].filter((z) => z.doneToday).length;
  const mission = data.mission;
  const missionPct = mission.total > 0 ? Math.round((mission.touched / mission.total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Buka Peta Otot — ${mission.touched} dari ${mission.total} zona tersentuh minggu ini${doneToday > 0 ? `, ${doneToday} selesai hari ini` : ''}`}
      className={cn(
        'mm-panel group relative w-full cursor-pointer rounded-2xl p-4 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
      )}
    >
      <div className="flex items-center gap-4">
        <div className="w-[72px] shrink-0" aria-hidden="true">
          <MuscleMap
            view="front"
            visuals={visuals}
            pumpOrder={[] as MuscleZoneKey[]}
            pumpNonce={0}
            interactive={false}
          />
        </div>
        <div className="min-w-0 flex-1">
          {/* Task 70 (audit 70-d MINOR #6): h3 di dalam <button> tidak valid
              (heading interaktif) — diganti span dengan class sama. */}
          <span className="flex items-center gap-2 text-sm font-bold text-[#eef7ff]">
            Peta Otot
            <span className="rounded-full bg-[#092238] px-2 py-0.5 text-[10px] font-semibold text-[#64c9ff]">
              {mission.touched} / {mission.total} zona
            </span>
          </span>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#0a1b29]"
            role="progressbar"
            aria-valuenow={missionPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Misi zona minggu ini: ${mission.touched} dari ${mission.total}`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#64e7a0] to-[#13d8bc]"
              style={{ width: `${missionPct}%` }}
            />
          </div>
          <p className="mt-2 truncate text-[11px] text-[#a7b8c5]">
            {GYM_TAGLINE}
          </p>
        </div>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-[#b9d5e4] transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
    </button>
  );
}
