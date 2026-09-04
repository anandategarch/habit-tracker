// ── Helpers ──────────────────────────────────────────────────────────────
// Extracted from daily-recap.tsx during SPLIT-PHASE2-UI.
//
// formatTxTime + formatDateShort were consolidated into `@/lib/finance-helpers`
// during the CONSOLIDATION task (see worklog.md) — both helpers had identical
// implementations in daily-recap-helpers.ts and category-explorer.tsx.

import { formatRupiah, compactRupiah } from './finance-types';
import { formatTxTime, formatDateShort } from '@/lib/finance-helpers';

// Re-export so existing call sites that import from this module keep working.
export { formatTxTime, formatDateShort };

// Axis labels for the 48-bucket (30-min) heatmap.
// With 48 bars, we label every 6 hours (5 labels): '00', '06', '12', '18', '24'.
// '24' at the right edge represents end-of-day (23:30–24:00 bucket).
// Using `justify-between`, these 5 labels align to: bar 0, bar 12, bar 24,
// bar 36, bar 47 — which is exactly 00:00, 06:00, 12:00, 18:00, 24:00.
export const HOUR_LABELS = ['00', '06', '12', '18', '24'];

/**
 * Format a 30-min bucket index (0-47) as "HH.MM" for the heatmap tooltip.
 *   bucket 0  → "00.00"  (00:00–00:29)
 *   bucket 1  → "00.30"  (00:30–00:59)
 *   bucket 16 → "08.00"  (08:00–08:29)
 *   bucket 17 → "08.30"  (08:30–08:59)  ← a 08.30 coffee lands here
 *   bucket 47 → "23.30"  (23:30–23:59)
 * Uses dot separator (Indonesian format) to match formatTxTime().
 */
export function formatSlotLabel(bucket: number): string {
  const hour = Math.floor(bucket / 2);
  const minute = bucket % 2 === 0 ? 0 : 30;
  return `${String(hour).padStart(2, '0')}.${String(minute).padStart(2, '0')}`;
}

/** Format a YYYY-MM-DD date as "DD-Www" (e.g. "31-Mon", "30-Sun") for chart axis labels.
 *  Uses Intl.DateTimeFormat with explicit timezone to ensure consistent
 *  weekday calculation regardless of the server/browser timezone. */
export function formatDayMonthLabel(d: string): string {
  const [y, m, day] = d.split('-');
  // Construct a UTC date from the YMD components, then format with
  // en-US locale to get the English weekday abbreviation.
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(day)));
  const dayNum = date.getUTCDate();
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
  }).format(date);
  return `${dayNum}-${weekday}`;
}

/**
 * Compact rupiah that handles 0 gracefully and disambiguates small amounts.
 * - 0 → "0"
 * - < 1.000 → full format ("Rp 500") — previously returned bare "500" which
 *   was ambiguous next to "50k" (could be read as 500 thousand).
 * - ≥ 1.000 → compact ("50k", "1.2jt")
 */
export function compactRupiahSafe(n: number): string {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs < 1000) return formatRupiah(n);
  return compactRupiah(n);
}

// ── Smooth curve helper (Catmull-Rom → cubic Bezier) ────────────────────
// Converts an array of points into a smooth SVG path using the Catmull-Rom
// spline algorithm. Each segment between two points becomes a cubic Bezier
// curve whose control points are derived from the neighboring points,
// producing a continuous, natural-looking line with no sharp angles.

export function catmullRomPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i++) {
    // p0 = previous point (or clamp to p1 at the start)
    // p1 = current point (segment start)
    // p2 = next point (segment end)
    // p3 = point after next (or clamp to p2 at the end)
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    // Catmull-Rom → Bezier control points (tension factor 1/6)
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return path;
}
