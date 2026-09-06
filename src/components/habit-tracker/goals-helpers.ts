// ---------------------------------------------------------------------------
// Helpers
// Extracted from goals.tsx during PHASE-A-3.
//
// Pure functions + constants only — no React, no hooks. All side-effecting
// handlers (handleSave, handleDelete, toggleMilestone w/ BUG-M16 fix,
// handleCancelGoal w/ BUG-L7 fix) STAY in goals.tsx because they are tightly
// coupled to the query cache + mutation flow.
// ---------------------------------------------------------------------------

import type { GoalFormData, Milestone } from './goals-types';

// ── Constants ────────────────────────────────────────────────────────────────

export const STATUS_STYLES: Record<string, string> = {
  active: 'bg-success/10 text-success dark:bg-success/15 dark:text-success/80',
  completed: 'bg-success/10 text-success dark:bg-success/15 dark:text-success/80',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

export const EMPTY_FORM: GoalFormData = {
  title: '',
  description: '',
  deadline: '',
  priority: 'Medium',
  milestones: [],
};

// ── Pure helpers ─────────────────────────────────────────────────────────────

export function parseMilestones(json: string): Milestone[] {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore
  }
  return [];
}

export function calcProgress(milestones: Milestone[]): number {
  if (milestones.length === 0) return 0;
  const done = milestones.filter((m) => m.done).length;
  return Math.round((done / milestones.length) * 100);
}

/**
 * Map a 0-100 progress value to a Tailwind color class for the Progress bar.
 *   >= 80 → green (success)
 *   >= 50 → lime
 *   >= 25 → warning
 *   <  25 → orange
 */
export function getProgressColor(progress: number): string {
  if (progress >= 80) return '[&>div]:bg-success';
  if (progress >= 50) return '[&>div]:bg-lime-500';
  if (progress >= 25) return '[&>div]:bg-warning';
  return '[&>div]:bg-orange-500';
}
