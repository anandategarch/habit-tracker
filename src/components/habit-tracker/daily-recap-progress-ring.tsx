'use client';

// ── Progress Ring (circular progress, Apple Watch style) ──────────────────
// Extracted from daily-recap.tsx during SPLIT-PHASE2-UI.
//
// NOTE: SPLIT-SCAN-UI-1 noted there are 4 copies of ProgressRing across the
// codebase (daily-recap, daily-tracker, dashboard, category-explorer). The
// plan was for Agent SPLIT-PHASE1 to unify them into ui/progress-ring.tsx,
// but that shared file does not exist yet. This file is the daily-recap
// local copy — when the shared ui/progress-ring.tsx is created, this file
// can be replaced with a re-export.

import { cn } from '@/lib/utils';

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
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.min(Math.max(percentage, 0), 100);
  const offset = circumference - (clampedPct / 100) * circumference;

  const colorClass =
    status === 'over' ? 'text-destructive'
    : status === 'nearing' ? 'text-warning'
    : status === 'on_track' ? 'text-primary'
    : 'text-success';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn('anim-color-smooth', colorClass)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
