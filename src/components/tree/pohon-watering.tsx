'use client';

// components/tree/pohon-watering.tsx — ③ PENYIRAMAN tab Pohon.
//
// Diekstraksi dari pohon-screen.tsx saat SPLIT god-file (Task 71-g) —
// JSX/aria identik. Tetes hari ini x/y (maks 10 digambar, sisanya angka),
// tombol "Siram Sekarang" (animasi + toast via use-pohon-play di akar) dan
// tombol "Rutinitas" (openTrackerDate hari ini).

import { ArrowUpRight, Droplet, Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MAX_DROPLETS } from './pohon-content';

export interface PohonWateringProps {
  todayTotal: number;
  todayDone: number;
  allWatered: boolean;
  /** Animasi penyiraman sedang berjalan (tombol ter-disable). */
  watering: boolean;
  onWater: () => void;
  /** Buka tracker grid hari ini (openTrackerDate(todayStr)). */
  onOpenRoutine: () => void;
}

export function PohonWatering({
  todayTotal,
  todayDone,
  allWatered,
  watering,
  onWater,
  onOpenRoutine,
}: PohonWateringProps) {
  return (
    <section className="rounded-2xl border border-teal-900/50 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-foreground">Siram Pohonmu</h2>
        {allWatered && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#63E6BE]/30 bg-[#63E6BE]/10 px-2.5 py-1 text-[11px] font-semibold text-[#7DD3C8]">
            <Droplets className="h-3 w-3" aria-hidden="true" />
            Kenyang hari ini ✓
          </span>
        )}
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        Setiap rutinitas yang selesai hari ini = satu tetes air untuk pohonmu.
      </p>

      {/* Tetes hari ini — x/y (maks tampil 10, sisanya angka) */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: Math.min(todayTotal, MAX_DROPLETS) }, (_, i) => (
          <Droplet
            key={i}
            className={cn(
              'h-4.5 w-4.5 transition-colors',
              i < todayDone
                ? 'fill-[#63E6BE]/30 text-[#63E6BE]'
                : 'text-muted-foreground/35',
            )}
            strokeWidth={2}
          />
        ))}
        {todayTotal > MAX_DROPLETS && (
          <span className="text-[11px] font-bold tabular-nums text-[#63E6BE]">
            {todayDone}/{todayTotal}
          </span>
        )}
      </div>
      <p className="sr-only">
        {todayTotal === 0
          ? 'Belum ada rutinitas hari ini.'
          : `${todayDone} dari ${todayTotal} rutinitas hari ini selesai.`}
      </p>

      <div className="mt-3.5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onWater}
          disabled={watering}
          className={cn(
            'inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all',
            'bg-gradient-to-r from-[#63E6BE] to-[#1E9B72] text-[#04120E]',
            'shadow-[0_10px_24px_-10px_rgba(30,155,114,0.55)] hover:brightness-110',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63E6BE]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            'active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none',
          )}
        >
          <Droplets className="h-4 w-4" aria-hidden="true" />
          {watering ? 'Menyiram…' : 'Siram Sekarang'}
        </button>
        <button
          type="button"
          onClick={onOpenRoutine}
          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-teal-900/50 px-4 py-2.5 text-[13px] font-semibold text-[#63E6BE] transition-colors hover:bg-[#63E6BE]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63E6BE]/60"
        >
          Rutinitas
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
