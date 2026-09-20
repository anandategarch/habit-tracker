// ---------------------------------------------------------------------------
// src/components/wellness/weight-sparkline.tsx — sparkline mini riwayat berat
// 30 hari (Task 73, Fase 2). Presentasi murni: polyline + titik terakhir.
// 0 titik → null; 1 titik → titik tengah (garis belum bermakna).
// ---------------------------------------------------------------------------

import type { WeightPoint } from '@/lib/wellness';

const W = 96;
const H = 28;
const PAD = 3;

export function WeightSparkline({ points }: { points: WeightPoint[] }) {
  if (points.length === 0) return null;

  if (points.length === 1) {
    return (
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        aria-hidden="true"
        className="text-primary/70"
      >
        <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
        <circle cx={W / 2} cy={H / 2} r="2.5" fill="currentColor" />
      </svg>
    );
  }

  const values = points.map((p) => p.weightKg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1; // datar sempurna → span 1 agar tidak div-by-zero
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => PAD + (1 - (v - min) / span) * (H - 2 * PAD);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.weightKg).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
      className="text-primary"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
      <circle cx={x(points.length - 1)} cy={y(last.weightKg)} r="2.6" fill="currentColor" />
    </svg>
  );
}
