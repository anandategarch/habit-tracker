'use client';

// ---------------------------------------------------------------------------
// src/components/wellness/water-tracker.tsx — baris hidrasi (Task 73, Fase 2).
//
// Interaksi "tap gelas ke-n": isi sampai n. Tap gelas TERAKHIR yang aktif →
// turun satu (koreksi cepat tanpa tombol minus terpisah). 44px target sentuh.
// nilai null (belum direkam) tampil abu; tap pertama langsung merekam.
// ---------------------------------------------------------------------------

import { GlassWater, Plus } from 'lucide-react';
import { formatLitersId, WATER_ML_PER_GLASS, type WellnessEntry } from '@/lib/wellness';

interface WaterTrackerProps {
  value: WellnessEntry['waterGlasses'];
  target: number;
  onChange: (next: number) => void;
}

export function WaterTracker({ value, target, onChange }: WaterTrackerProps) {
  const filled = value ?? 0;
  const isRecorded = value != null;
  const pct = Math.min(100, Math.round((filled / target) * 100));
  const done = isRecorded && filled >= target;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="premium-label flex items-center gap-1.5">
          <GlassWater className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Air
        </p>
        <p className="text-[11px] tabular-nums text-muted-foreground">
          {isRecorded ? (
            <span className={done ? 'font-semibold text-primary' : undefined}>
              {filled}/{target} gelas · {formatLitersId(filled)}
            </span>
          ) : (
            <span className="text-muted-foreground/70">belum direkam</span>
          )}
        </p>
      </div>

      {/* Deret gelas tap-to-fill (maks tampil = target; lebih → angka label). */}
      <div
        className="flex items-center gap-1.5"
        role="group"
        aria-label={`Jumlah gelas air hari ini: ${filled} dari ${target}`}
      >
        {Array.from({ length: target }, (_, i) => {
          const n = i + 1;
          const active = filled >= n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(filled === n ? n - 1 : n)}
              aria-label={`Isi air sampai ${n} gelas`}
              aria-pressed={active}
              className={
                'h-11 w-9 grid place-items-center rounded-xl transition-all active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ' +
                (active
                  ? 'bg-primary/20 text-primary ring-1 ring-primary/50'
                  : 'text-muted-foreground/30 hover:bg-muted hover:text-muted-foreground/80')
              }
            >
              <GlassWater className="h-5 w-5" aria-hidden="true" />
            </button>
          );
        })}
        {filled > target && (
          <span className="ml-1 flex h-11 items-center gap-0.5 rounded-xl bg-primary/10 px-2 text-xs font-semibold text-primary tabular-nums">
            <Plus className="h-3 w-3" aria-hidden="true" />
            {filled - target}
          </span>
        )}
      </div>

      {/* Catatan mini: kapasitas ml target + capaian penuh. */}
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {done
          ? `Target tercapai 🎉 — ${(target * WATER_ML_PER_GLASS) / 1000} L hari ini.`
          : `1 gelas ≈ ${WATER_ML_PER_GLASS} ml · target ${(target * WATER_ML_PER_GLASS) / 1000} L (${pct}%)`}
      </p>
    </div>
  );
}
