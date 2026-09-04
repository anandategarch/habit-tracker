'use client';

// ── Sparkline (premium fintech line chart) ────────────────────────────────
// Extracted from daily-recap.tsx during SPLIT-PHASE2-UI.
// FIX-COLOR-P2: was "vibrant blue→purple gradient stroke (#5B5FFB → #7C6CFF)"
// — replaced with theme-following var(--chart-1) (defaults to emerald-500).
// Smooth curved line with a soft translucent area fill (12% opacity) with subtle
// Gaussian blur beneath. Minimalist — only the "today" point is highlighted
// with a soft glow halo + background ring.

import { cn } from '@/lib/utils';
import { catmullRomPath, formatDayMonthLabel } from './daily-recap-helpers';

export function MiniSparkline({ data }: { data: Array<{ date: string; amount: number; isToday: boolean }> }) {
  if (data.length === 0) return null;
  const values = data.map((d) => d.amount);
  const max = Math.max(...values, 1);
  const hasAnyData = values.some((v) => v > 0);

  // Wide viewBox (300×48) keeps horizontal stretch low on most screens.
  const W = 300, H = 48;
  const step = W / (data.length - 1 || 1);
  const points = data.map((d, i) => {
    const x = i * step;
    // If no data at all, draw flat line at bottom (not top).
    const y = hasAnyData ? H - (d.amount / max) * (H - 12) - 6 : H - 6;
    return { x, y, ...d };
  });

  const linePath = catmullRomPath(points);
  const areaPath = `${linePath} L ${W} ${H} L 0 ${H} Z`;

  // Find the today point (for the glowing highlight)
  const todayPoint = points.find((p) => p.isToday);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12" preserveAspectRatio="none">
        <defs>
          {/* FIX-COLOR-P2: was #5B5FFB → #7C6CFF (blue→purple). Now uses var(--chart-1)
              which defaults to emerald-500 and follows the user's chosen theme. */}
          {/* Horizontal gradient for stroke */}
          <linearGradient id="spark-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--chart-1)" />
            <stop offset="100%" stopColor="var(--chart-1)" />
          </linearGradient>
          {/* Vertical gradient for area fill: 15% opacity → 0% (top → bottom) */}
          <linearGradient id="spark-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.15" />
            <stop offset="50%" stopColor="var(--chart-1)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
          </linearGradient>
          {/* REMOVED: feGaussianBlur filters — SVG blur is extremely GPU-
              expensive and was the #1 cause of "lag when data finishes
              loading". The blur on a 12% opacity fill was barely visible
              but cost ~5-15ms per frame on mid-range devices. The gradient
              fill alone provides sufficient visual depth. */}
        </defs>

        {/* Area fill beneath the line (no blur — gradient only) */}
        {hasAnyData && (
          <path
            d={areaPath}
            fill="url(#spark-area)"
          />
        )}

        {/* Smooth curved line with theme-following gradient */}
        <path
          d={linePath}
          fill="none"
          stroke="url(#spark-stroke)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Today point: simple 2-layer dot (no blur glow) */}
        {hasAnyData && todayPoint && (
          <g>
            {/* Outer halo — semi-transparent circle (no blur filter) */}
            <circle
              cx={todayPoint.x}
              cy={todayPoint.y}
              r="5"
              fill="var(--chart-1)"
              opacity="0.2"
            />
            {/* Background ring (matches card bg — creates cutout from the line) */}
            <circle
              cx={todayPoint.x}
              cy={todayPoint.y}
              r="3.5"
              className="text-background"
              fill="currentColor"
            />
            {/* Inner solid dot */}
            <circle
              cx={todayPoint.x}
              cy={todayPoint.y}
              r="2.5"
              fill="var(--chart-1)"
            />
          </g>
        )}
      </svg>

      {/* Date labels below the chart — one per data point, evenly spaced.
          Uses a flex row with each cell taking 1/N width so labels align
          exactly under each chart point. Center-aligned text. Today's label
          is highlighted (bold + colored) to match the highlighted dot above. */}
      <div className="flex mt-1">
        {data.map((d, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 text-center text-[11px] tabular-nums leading-tight',
              d.isToday
                ? 'font-bold text-primary'
                : 'text-muted-foreground'
            )}
          >
            {formatDayMonthLabel(d.date)}
          </div>
        ))}
      </div>
    </div>
  );
}
