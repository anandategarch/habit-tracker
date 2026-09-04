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
// ---------------------------------------------------------------------------

'use client';

import { Check } from 'lucide-react';

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
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, progress));
  const offset = c * (1 - pct / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
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
          stroke={done ? primaryColor : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
          style={{
            filter: done ? 'drop-shadow(0 0 4px rgba(34,197,94,0.5))' : 'none',
          }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        {done ? (
          <Check className="h-5 w-5 text-primary animate-[ringPop_0.4s_ease]" strokeWidth={3} />
        ) : (
          <span className="text-[11px] font-bold tabular-nums text-muted-foreground">
            {Math.round(pct)}%
          </span>
        )}
      </span>
    </div>
  );
}
