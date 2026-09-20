'use client';

// ---------------------------------------------------------------------------
// src/components/gym/gym-weekly-mission.tsx — panel 11: Weekly Mission
// "X / 6 zona" + skor keseimbangan + banner Balanced Week (Task 64 V2,
// dipecah Task 71 dari gym-screen.tsx).
//
// Bar progres aksesibel + chip zona (warna zona menyala bila tersentuh
// minggu ini) + perayaan "Balanced Week! 🏆" / sisa 1 zona.
// ---------------------------------------------------------------------------

import { Check, Sparkles, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollReveal } from '@/components/habit-tracker/scroll-reveal';
import type { GymMissionPayload, GymZonePayload } from '@/lib/muscle-map';

export function GymWeeklyMission({
  mission,
  balanceScore,
  zones,
}: {
  mission: GymMissionPayload;
  balanceScore: number;
  /** 6 zona utama (tanpa Full Body) — urutan def. */
  zones: GymZonePayload[];
}) {
  const missionPct = mission.total > 0 ? Math.round((mission.touched / mission.total) * 100) : 0;

  return (
    <ScrollReveal className="rounded-2xl border border-border/70 bg-card/60 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Misi Minggu Ini</h2>
        <p className="text-xs font-medium text-muted-foreground">
          {mission.touched} / {mission.total} zona
          <span className="mx-1.5" aria-hidden="true">·</span>
          Keseimbangan {balanceScore}/100
        </p>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={missionPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Misi zona minggu ini: ${mission.touched} dari ${mission.total}`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#64e7a0] to-[#13d8bc] transition-[width] duration-500"
          style={{ width: `${missionPct}%` }}
        />
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {zones.map((z) => {
          const done = z.sessionsThisWeek >= 1;
          return (
            <li key={z.key} className="flex items-center gap-2 text-sm">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: done ? z.color : '#3f4a55' }}
                aria-hidden="true"
              />
              <span className={cn('truncate', done ? 'text-foreground' : 'text-muted-foreground')}>
                {z.label}
              </span>
              {done ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-label="tersentuh" />
              ) : (
                <span className="sr-only">belum tersentuh</span>
              )}
            </li>
          );
        })}
      </ul>

      {mission.balancedWeek ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
          <Trophy className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">Balanced Week! 🏆</p>
            <p className="text-xs text-muted-foreground">
              Semua zona tersentuh minggu ini — tubuhmu seimbang.
            </p>
          </div>
        </div>
      ) : mission.touched >= mission.total - 1 && mission.total > 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Tinggal 1 zona lagi untuk Balanced Week!
        </p>
      ) : null}
    </ScrollReveal>
  );
}
