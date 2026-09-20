'use client';

// ---------------------------------------------------------------------------
// src/components/wellness/protein-tracker.tsx — baris protein (Task 73, Fase 2).
//
// Progress ke target harian + chip tambah cepat (+10/+25/+50 g — porsi praktis:
// 1 butir telur ≈ 6–10 g, sepotong dada ayam ≈ 25–30 g, scoop protein ≈ 25 g)
// dan koreksi −10 g. Target otomatis 1,6 g/kg berat tercatat (fallback 60 g)
// — label menjelaskan asal target supaya angka tidak terasa arbitrer.
// ---------------------------------------------------------------------------

import { Drumstick, Minus, Plus } from 'lucide-react';
import {
  progressPct,
  PROTEIN_MAX,
  PROTEIN_QUICK_STEPS,
  PROTEIN_UNDO_STEP,
  type WellnessEntry,
} from '@/lib/wellness';

interface ProteinTrackerProps {
  value: WellnessEntry['proteinGram'];
  targetGram: number;
  /** true bila target diturunkan dari berat badan tercatat. */
  targetFromWeight: boolean;
  onChange: (next: number) => void;
}

export function ProteinTracker({ value, targetGram, targetFromWeight, onChange }: ProteinTrackerProps) {
  const filled = value ?? 0;
  const isRecorded = value != null;
  const pct = progressPct(filled, targetGram);
  const done = isRecorded && filled >= targetGram;

  const bump = (delta: number) => {
    onChange(Math.max(0, Math.min(PROTEIN_MAX, filled + delta)));
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="premium-label flex items-center gap-1.5">
          <Drumstick className="h-3.5 w-3.5 text-[#f49b25]" aria-hidden="true" />
          Protein
        </p>
        <p className="text-[11px] tabular-nums text-muted-foreground">
          {isRecorded ? (
            <span className={done ? 'font-semibold text-[#f49b25]' : undefined}>
              {filled}/{targetGram} g
            </span>
          ) : (
            <span className="text-muted-foreground/70">belum direkam</span>
          )}
        </p>
      </div>

      {/* Progress bar */}
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={`Protein hari ini ${filled} dari ${targetGram} gram`}
        aria-valuenow={filled}
        aria-valuemin={0}
        aria-valuemax={targetGram}
      >
        <div
          className="h-full rounded-full bg-[#f49b25]/85 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Chip tambah cepat + koreksi */}
      <div className="mt-2.5 flex items-center gap-2">
        {PROTEIN_QUICK_STEPS.map((step) => (
          <button
            key={step}
            type="button"
            onClick={() => bump(step)}
            aria-label={`Tambah ${step} gram protein`}
            className="h-11 px-3 rounded-xl text-xs font-semibold tabular-nums text-foreground transition-all active:scale-95 hover:bg-[#f49b25]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            +{step} g
          </button>
        ))}
        <button
          type="button"
          onClick={() => bump(-PROTEIN_UNDO_STEP)}
          aria-label="Kurangi 10 gram protein"
          disabled={filled <= 0}
          className="ml-auto h-11 w-11 grid place-items-center rounded-xl text-muted-foreground transition-all active:scale-90 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {targetFromWeight
          ? 'Target 1,6 g × berat badanmu ⚖️'
          : `Target umum ${targetGram} g — catat berat badan agar target menyesuaikan`}
      </p>
    </div>
  );
}
