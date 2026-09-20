'use client';

// ---------------------------------------------------------------------------
// src/components/gym/gym-status-chip.tsx — chip status zona kecil (Task 64).
//
// Dipakai bersama oleh baris daftar zona (gym-zone-list.tsx) dan header
// sheet detail zona (zone-focus-sheet.tsx). Warna/label dari ZONE_STATUS_META
// (lib/muscle-map-zones.ts) — 6 state zona.
// ---------------------------------------------------------------------------

import { ZONE_STATUS_META, type MuscleZoneStatus } from '@/lib/muscle-map';

export function StatusChip({ status }: { status: MuscleZoneStatus }) {
  const meta = ZONE_STATUS_META[status];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      style={{ borderColor: `${meta.color}55`, color: meta.color, background: `${meta.color}14` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
