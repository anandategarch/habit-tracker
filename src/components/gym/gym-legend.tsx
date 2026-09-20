'use client';

// ---------------------------------------------------------------------------
// src/components/gym/gym-legend.tsx — legenda status zona (panel 04, Task 64).
//
// 6 titik warna + label state zona (Belum Dilatih … Balanced) di bawah
// siluet peta otot (dipakai gym-map-panel.tsx). Warna ZONE_STATUS_META.
// ---------------------------------------------------------------------------

import { ZONE_STATUS_META, type MuscleZoneStatus } from '@/lib/muscle-map';

export function GymLegend() {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1.5">
      {(Object.keys(ZONE_STATUS_META) as MuscleZoneStatus[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5 text-[10px] text-[#a7b8c5]">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: ZONE_STATUS_META[s].color }}
            aria-hidden="true"
          />
          {ZONE_STATUS_META[s].label}
        </span>
      ))}
    </div>
  );
}
