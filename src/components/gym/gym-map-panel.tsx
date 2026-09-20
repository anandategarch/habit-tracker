'use client';

// ---------------------------------------------------------------------------
// src/components/gym/gym-map-panel.tsx — panel 01 kiri: siluet peta otot
// + toggle Depan/Belakang + legenda status (Task 64, dipecah Task 71).
//
// Aset desain user (upload/peta-otot/ panel 01 + 04):
//   * tablist "Pandangan tubuh" — Task 70 (audit 70-d MINOR #4 + MAJOR #2):
//     tab ARIA lengkap (id + aria-controls + arrow-key kiri/kanan) dan
//     min-h 44px touch target;
//   * tabpanel berisi <MuscleMap> (pump/glow Opsi A — Task 69/70);
//   * legenda 6 state zona + disclaimer.
// ---------------------------------------------------------------------------

import { cn } from '@/lib/utils';
import { MUSCLE_MAP_DISCLAIMER, type MuscleZoneKey } from '@/lib/muscle-map';
import { MuscleMap, type MuscleZoneVisual } from './muscle-map';
import { GymLegend } from './gym-legend';
import { ScrollReveal } from '@/components/habit-tracker/scroll-reveal';

export type BodyView = 'front' | 'back';

export function GymMapPanel({
  view,
  onViewChange,
  visuals,
  pumpOrder,
  pumpNonce,
  onSelectZone,
}: {
  view: BodyView;
  onViewChange: (view: BodyView) => void;
  visuals: MuscleZoneVisual[];
  pumpOrder: MuscleZoneKey[];
  pumpNonce: number;
  onSelectZone: (key: MuscleZoneKey) => void;
}) {
  return (
    <ScrollReveal className="mm-panel relative overflow-hidden rounded-2xl p-4">
      {/* Toggle Depan/Belakang (aset 01/08).
          Task 70 (audit 70-d MINOR #4 + MAJOR #2): tab ARIA lengkap
          (id + aria-controls + arrow-key) dan min-h 44px touch target. */}
      <div
        className="mx-auto flex w-fit rounded-full bg-[#092238] p-1"
        role="tablist"
        aria-label="Pandangan tubuh"
        onKeyDown={(e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault();
          const next: BodyView = view === 'front' ? 'back' : 'front';
          onViewChange(next);
          document.getElementById(`mm-tab-${next}`)?.focus();
        }}
      >
        {(['front', 'back'] as BodyView[]).map((v) => (
          <button
            key={v}
            id={`mm-tab-${v}`}
            type="button"
            role="tab"
            aria-selected={view === v}
            aria-controls="mm-map-panel"
            onClick={() => onViewChange(v)}
            className={cn(
              'min-h-[44px] cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              view === v
                ? 'bg-gradient-to-r from-[#1589ff] to-[#26b8ff] text-white shadow'
                : 'text-[#a7b8c5] hover:text-[#eef7ff]',
            )}
          >
            {v === 'front' ? 'Depan' : 'Belakang'}
          </button>
        ))}
      </div>

      <div
        className="mx-auto mt-2 max-w-[210px]"
        role="tabpanel"
        id="mm-map-panel"
        aria-labelledby={`mm-tab-${view}`}
      >
        <MuscleMap
          view={view}
          visuals={visuals}
          pumpOrder={pumpOrder}
          pumpNonce={pumpNonce}
          onSelectZone={(key) => onSelectZone(key)}
          ariaLabel={`Peta otot tampak ${view === 'front' ? 'depan' : 'belakang'} — ketuk zona untuk detail`}
        />
      </div>

      {/* Legenda status (panel 04). */}
      <GymLegend />

      <p className="mt-3 text-center text-[10px] text-[#7a8893]">{MUSCLE_MAP_DISCLAIMER}</p>
    </ScrollReveal>
  );
}
