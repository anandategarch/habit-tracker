'use client';

import * as React from 'react';

// ── ProgressRing ─────────────────────────────────────────────────────────
// Shared circular progress ring (animated SVG). Consolidated during the
// CONSOLIDATION task (see worklog.md) from two near-identical implementations
// in `daily-recap-progress-ring.tsx` and `category-explorer.tsx`
// (MiniProgressRing).
//
// The shared component supports BOTH color conventions used by the originals:
//   • `color` (hex string) → sets `stroke` directly on the foreground circle.
//     Used by category-explorer (MiniProgressRing).
//   • `className` (text-primary, text-warning, text-destructive + animation
//     classes like `anim-color-smooth`) → sets the foreground via
//     `currentColor` + text color utility. Used by daily-recap-progress-ring.
//
// Two other ProgressRing implementations were intentionally NOT migrated:
//   • `dashboard-helpers.tsx` — uses `stroke-*` color classes (not text-*),
//     renders a label BELOW the SVG (not centered), embeds a CountUpNumber
//     counter, and applies `anim-ring` CSS vars. Behavior too unique.
//   • `daily-tracker.tsx` — has a `done` flag that swaps the foreground
//     color and center content (Check icon vs % text), plus a drop-shadow
//     filter. Behavior too unique.
// Both are kept local per the task's "preserve all existing behavior" rule.
//
// Props:
//   • progress (0-100)       — required
//   • size                    — default 48
//   • strokeWidth             — default 4
//   • color (hex)             — sets stroke directly; takes precedence over
//                              currentColor-based className color
//   • className               — applied to the foreground circle (text-* color
//                              utilities + animation classes)
//   • label                   — text rendered in the center
//   • children                — alternative to label (custom JSX center)
//   • trackClassName          — applied to the background track circle
//                              (default 'text-muted/30')
//   • isHighlighted           — when true, renders a faint glow ring around
//                              the progress ring. When explicitly false, dims
//                              the foreground to opacity 0.5 (matches the
//                              category-explorer non-dominant-bucket behavior).

export interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
  label?: string;
  children?: React.ReactNode;
  trackClassName?: string;
  isHighlighted?: boolean;
}

export function ProgressRing({
  progress,
  size = 48,
  strokeWidth = 4,
  color,
  className,
  label,
  children,
  trackClassName = 'text-muted/30',
  isHighlighted,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.min(Math.max(progress, 0), 100);
  const offset = circumference - (clampedPct / 100) * circumference;

  // When `isHighlighted` is explicitly set (true OR false), mirror the original
  // category-explorer MiniProgressRing behavior: highlighted → full opacity,
  // non-highlighted → dimmed to 0.5. When undefined (daily-recap call sites),
  // no opacity is applied so the foreground inherits the default 1.
  const foregroundOpacity =
    isHighlighted === undefined ? undefined : isHighlighted ? 1 : 0.5;

  // The foreground stroke: prefer an explicit hex `color`; otherwise fall back
  // to `currentColor` so the text-* utility in `className` can drive the color.
  const foregroundStroke = color || 'currentColor';

  // The glow ring uses the same color source as the foreground so it visually
  // matches the progress arc.
  const glowStroke = color || 'currentColor';
  const glowClassName = color ? undefined : className;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Highlight glow ring (only rendered when isHighlighted=true). */}
        {isHighlighted && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius + 1.5}
            fill="none"
            stroke={glowStroke}
            strokeWidth="1"
            opacity="0.2"
            className={glowClassName}
          />
        )}
        {/* Background track. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={trackClassName}
        />
        {/* Progress arc. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={foregroundStroke}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={className}
          style={foregroundOpacity !== undefined ? { opacity: foregroundOpacity } : undefined}
        />
      </svg>
      {(children || label !== undefined) && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children ?? <span className="text-xs font-medium">{label}</span>}
        </div>
      )}
    </div>
  );
}
