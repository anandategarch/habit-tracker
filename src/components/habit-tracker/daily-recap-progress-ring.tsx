'use client';

// ── Progress Ring (circular progress, Apple Watch style) ──────────────────
// Extracted from daily-recap.tsx during SPLIT-PHASE2-UI.
//
// CONSOLIDATION task: the SVG implementation has been moved to the shared
// `@/components/ui/progress-ring` module. This file is now a thin adapter
// that maps the daily-recap `status` enum → a foreground text-color utility
// class (consumed by the shared component via currentColor) and forwards the
// rest of the props. Call sites in `daily-recap.tsx` are unchanged.

import { cn } from '@/lib/utils';
import { ProgressRing as SharedProgressRing } from '@/components/ui/progress-ring';

// Maps the budget status returned by /api/finance/daily-recap to a foreground
// color utility class. The shared ProgressRing uses `stroke="currentColor"`
// for the foreground when no hex `color` prop is supplied, so a text-* class
// on `className` is sufficient to colorize the ring.
const STATUS_CLASS: Record<string, string> = {
  over: 'text-destructive',
  nearing: 'text-warning',
  on_track: 'text-primary',
  // 'under' (and any unknown status) — green "all good" state.
  under: 'text-success',
};

export function ProgressRing({
  percentage,
  size = 56,
  strokeWidth = 5,
  status = 'under',
  children,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  status?: string;
  children?: React.ReactNode;
}) {
  return (
    <SharedProgressRing
      progress={percentage}
      size={size}
      strokeWidth={strokeWidth}
      trackClassName="text-muted/30"
      // `anim-color-smooth` matches the original daily-recap foreground
      // animation class for smooth color transitions when status changes.
      className={cn('anim-color-smooth', STATUS_CLASS[status] || STATUS_CLASS.under)}
    >
      {children}
    </SharedProgressRing>
  );
}
