'use client';

// ---------------------------------------------------------------------------
// src/components/gym/zone-pr-list.tsx — seksi "Rekor Pribadi" di Zone Focus
// Sheet (Task 74 F3): PR per gerakan (amount terkuat satu set, per satuan)
// turunan murni dari seluruh jurnal set zona. Kosong → seksi tidak tampil
// (sheet zona tanpa catatan tetap ramping).
// ---------------------------------------------------------------------------

import { Trophy } from 'lucide-react';
import type { GymExercisePr, MuscleZoneKey } from '@/lib/muscle-map';
import { formatDayKey } from './set-log-format';

export function ZonePrList({
  zoneKey,
  prs,
  todayYmd,
}: {
  zoneKey: MuscleZoneKey;
  prs: GymExercisePr[];
  todayYmd: string;
}) {
  if (prs.length === 0) return null;

  return (
    <section aria-label={`Rekor pribadi zona ${zoneKey}`}>
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Trophy className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
        Rekor Pribadi
      </h3>
      {/* Task 70 (audit 70-d MINOR #10): custom-scrollbar pada daftar panjang. */}
      <ul className="custom-scrollbar mt-2 max-h-44 space-y-1.5 overflow-y-auto pr-0.5">
        {prs.map((pr) => (
          <li
            key={`${pr.nameKey}-${pr.unit}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-1.5"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{pr.exercise}</p>
              <p className="text-[10px] text-muted-foreground">
                {pr.bestSets} set · {formatDayKey(pr.bestDayKey, todayYmd)}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
              {pr.bestAmount} {pr.unit}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Rekor = jumlah terkuat dalam satu set, per satuan gerakan.
      </p>
    </section>
  );
}
