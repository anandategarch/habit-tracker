'use client';

// ---------------------------------------------------------------------------
// src/components/gym/readiness-ring.tsx — ring skor kesiapan (Task 72 F1).
//
// Komponen presentasi murni: lingkaran SVG progres (skor/100) berwarna tier,
// angka skor besar di tengah + label tier. Tanpa state, tanpa I/O.
// ---------------------------------------------------------------------------

import { READINESS_TIER_META, type GymReadinessTier } from '@/lib/muscle-map';

const R = 42;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function ReadinessRing({
  score,
  tier,
  size = 96,
}: {
  score: number;
  tier: GymReadinessTier;
  /** Ukuran tampilan px (SVG viewBox tetap 100 — responsif). */
  size?: number;
}) {
  const meta = READINESS_TIER_META[tier];
  const clamped = Math.max(0, Math.min(100, score));
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Kesiapan latihan ${clamped} dari 100 — ${meta.label}`}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/40" />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke={meta.color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold leading-none tabular-nums">{clamped}</span>
        <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          {meta.emoji} {meta.label}
        </span>
      </span>
    </div>
  );
}
