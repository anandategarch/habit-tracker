// ---------------------------------------------------------------------------
// ProgressRing — circular animated progress indicator
// Extracted from daily-tracker.tsx during SPLIT-PHASE3.
//
// NOTE: A shared `src/components/ui/progress-ring.tsx` does not yet exist
// (SPLIT-PHASE1 chose to keep the 4 ProgressRing copies separate because
// their prop APIs differ: dashboard uses label+CountUpNumber+anim-ring,
// daily-tracker uses hex color+done flag, daily-recap uses status
// under/over+children, category-explorer uses MiniProgressRing+isHighlighted).
// When a shared version lands, this file can be replaced with a 1-line
// re-export. See also daily-recap-progress-ring.tsx (parallel copy).
//
// PREMIUM REDESIGN (Rutina Aurora / Task 2-b): gradient stroke via an SVG
// <linearGradient> def (unique id per instance so multiple rings on the page
// never cross-reference), thicker 5px stroke with rounded linecap, and a soft
// color-matched glow (CSS drop-shadow). Props/API unchanged.
// ---------------------------------------------------------------------------

'use client';

import { useId } from 'react';
import { Check } from 'lucide-react';

/** Mix a hex color toward white by `t` (0–1). Falls back to the input when
 *  the string is not a 6-digit hex (all callers pass hex from
 *  useThemeColor / CATEGORY_STYLES, but be defensive anyway). */
function mixWhite(hex: string, t: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 255) * (1 - t) + 255 * t);
  const g = Math.round(((n >> 8) & 255) * (1 - t) + 255 * t);
  const b = Math.round((n & 255) * (1 - t) + 255 * t);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** hex → rgba() string (for the drop-shadow glow). */
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return `rgba(13, 148, 136, ${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function ProgressRing({
  progress,
  color,
  done,
  size = 52,
  primaryColor,
}: {
  progress: number;
  color: string;
  done: boolean;
  size?: number;
  primaryColor: string;
}) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, progress));
  const offset = c * (1 - pct / 100);

  // Unique gradient id — React's useId contains ":" characters which are
  // invalid in SVG url() references on some browsers, so strip them.
  const gradientId = `ring-grad-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const main = done ? primaryColor : color;
  const light = mixWhite(main, 0.45);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor={light} />
            <stop offset="100%" stopColor={main} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="oklch(0.91 0.004 120)"
          strokeWidth={stroke}
          className="dark:stroke-white/10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
          style={{
            // Soft premium glow under the progress arc — only when there is
            // something drawn (progress > 0), otherwise the filter is wasted.
            filter:
              pct > 0
                ? `drop-shadow(0 0 3px ${hexToRgba(main, 0.55)})`
                : undefined,
          }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        {done ? (
          <Check
            className="h-5 w-5 text-primary drop-shadow-sm animate-[ringPop_0.4s_ease]"
            strokeWidth={3}
          />
        ) : (
          <span className="text-[11px] font-bold tabular-nums text-muted-foreground">
            {Math.round(pct)}%
          </span>
        )}
      </span>
    </div>
  );
}
