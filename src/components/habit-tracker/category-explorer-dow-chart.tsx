// ---------------------------------------------------------------------------
// DowLineChart — smooth SVG line/area chart for day-of-week pattern.
// Extracted from category-explorer.tsx during SPLIT-PHASE3.
//
// Custom SVG chart — no Recharts overhead. Shows 7 data points with
// smooth Catmull-Rom curve, gradient area fill, nodes with amount labels,
// and highlighted top day.
// ---------------------------------------------------------------------------

'use client';

import { compactRupiahSafe } from './category-explorer-helpers';

export function DowLineChart({
  data,
  topIdx,
  color,
}: {
  data: Array<{ day: string; total: number; count: number }>;
  topIdx: number;
  color: string;
}) {
  if (data.length === 0) return null;

  // Use a wide viewBox so the chart scales proportionally on all screens.
  // Wider viewBox (340) gives more horizontal room for 7 labels.
  // Padding left/right (28) ensures amount labels at the first/last nodes
  // don't overflow the SVG bounds on narrow mobile screens.
  const W = 340, H = 120;
  const padding = { top: 24, bottom: 22, left: 28, right: 28 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;
  const step = chartW / (data.length - 1 || 1);
  const maxVal = Math.max(...data.map((d) => d.total), 1);

  const points = data.map((d, i) => ({
    x: padding.left + i * step,
    y: padding.top + chartH - (d.total / maxVal) * chartH,
    ...d,
  }));

  // Catmull-Rom → Bezier for smooth curve
  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  const areaPath = `${path} L ${points[points.length - 1].x.toFixed(1)} ${padding.top + chartH} L ${points[0].x.toFixed(1)} ${padding.top + chartH} Z`;
  const gradId = `dow-grad-${color.replace('#', '')}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-hidden" style={{ height: 'auto', maxHeight: '130px' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path d={areaPath} fill={`url(#${gradId})`} />
      {/* Smooth line */}
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {/* Nodes + labels */}
      {points.map((p, i) => {
        const isTop = i === topIdx && p.total > 0;
        return (
          <g key={i}>
            {/* Highlight area for top day */}
            {isTop && (
              <circle cx={p.x} cy={p.y} r="14" fill={color} opacity="0.08" />
            )}
            {/* Node */}
            <circle
              cx={p.x}
              cy={p.y}
              r={isTop ? 4.5 : 3}
              fill={isTop ? color : 'var(--card)'}
              stroke={color}
              strokeWidth={isTop ? 2 : 1.5}
            />
            {/* Amount label above node */}
            {p.total > 0 && (
              <text
                x={p.x}
                y={p.y - 10}
                textAnchor="middle"
                fontSize="10"
                fontWeight={isTop ? '700' : '500'}
                fill={isTop ? color : 'currentColor'}
                className={isTop ? '' : 'text-muted-foreground'}
              >
                {compactRupiahSafe(p.total)}
              </text>
            )}
            {/* Day label below */}
            <text
              x={p.x}
              y={H - 5}
              textAnchor="middle"
              fontSize="11"
              fontWeight={isTop ? '700' : '400'}
              fill={isTop ? 'currentColor' : 'currentColor'}
              className={isTop ? 'text-foreground font-bold' : 'text-muted-foreground'}
            >
              {p.day}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
