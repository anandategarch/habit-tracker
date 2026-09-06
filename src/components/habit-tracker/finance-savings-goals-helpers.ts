// ---------------------------------------------------------------------------
// Helpers for Savings Goals (Tabungan).
// Extracted from finance-savings-goals.tsx during PHASE-B-2.
//
// Pure module: no React, no hooks, no JSX. Safe to import from server
// contexts (e.g. tests) without pulling in the dialog component tree.
//
// Contents:
//  - Types:        SavingsGoal, AdjustResponse, GoalFormState
//  - Constants:    GOAL_EMOJI_OPTIONS, EMPTY_FORM
//  - Helper:       deadlineInfo (lifted from inside the component as a pure
//                  function; previously trapped at L339-361 of the
//                  finance-savings-goals.tsx component body)
// ---------------------------------------------------------------------------

import { jakartaNowParts, jakartaDateKey } from '@/lib/timezone';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SavingsGoal {
  id: string;
  name: string;
  emoji: string;
  targetAmount: number;
  currentAmount: number;
  sourceName: string | null;
  deadline: string | null;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdjustResponse extends SavingsGoal {
  // Returned by PUT /api/finance/savings-goals/[id] when `delta` is sent.
  // Flags that the goal flipped from incomplete → completed on this call,
  // so the UI fires the celebration 🎉.
  justCompleted?: boolean;
  previousAmount?: number;
}

// ── Form state ─────────────────────────────────────────────────────────────

export interface GoalFormState {
  name: string;
  emoji: string;
  targetAmount: string;
  currentAmount: string;
  sourceName: string; // '' = none
  deadline: string; // '' = none, else yyyy-MM-dd
}

export const EMPTY_FORM: GoalFormState = {
  name: '',
  emoji: '🎯',
  targetAmount: '',
  currentAmount: '',
  sourceName: '',
  deadline: '',
};

// ── Constants ──────────────────────────────────────────────────────────────

// Quick emoji picker options for savings goals — focused on aspiration /
// celebration emojis (vs the general emoji palette used for transactions).
export const GOAL_EMOJI_OPTIONS = [
  '🎯', '🏖️', '✈️', '🏝️', '🏠', '🚗', '🏍️', '🛵', '💍', '🎓',
  '💻', '📱', '🎮', '📚', '🏋️', '⚽', '🎵', '🎬', '🎂', '🎁',
  '💰', '🏦', '📈', '🪙', '💵', '🛡️', '🚸', '👶', '🐕', '🪴',
  '🔥', '⭐', '🏆', '🎉', '💎', '🛍️',
];

// ── Deadline countdown ─────────────────────────────────────────────────────

/**
 * Compute a deadline countdown label for a savings goal.
 *
 * Returns null when the goal has no deadline. Otherwise returns an object
 * with:
 *  - label: human-readable Bahasa Indonesia string ("7h lagi", "Hari ini",
 *           "Lewat 3h")
 *  - urgent: true when 0–7 days remain (rendered red)
 *  - past:   true when the deadline has already passed (rendered muted)
 *
 * Lifted verbatim from the original component body. Timezone handling
 * preserved exactly: today is computed from `jakartaNowParts` (Jakarta
 * wall-clock), and the deadline is converted to a Jakarta date key before
 * being parsed as a local midnight — fixing the BUG-PHASE12 off-by-one
 * that occurred when reading the deadline via the browser's local TZ.
 */
export function deadlineInfo(
  g: SavingsGoal,
): { label: string; urgent: boolean; past: boolean } | null {
  if (!g.deadline) return null;
  const jp = jakartaNowParts();
  // Build today's date at Jakarta midnight for a clean day-diff.
  const todayMs = new Date(jp.year, jp.month - 1, jp.day).getTime();
  // BUG-PHASE12: previously used `dl.getFullYear/getMonth/getDate` which
  // reads the deadline in the BROWSER's local TZ. For a UTC browser, a
  // deadline of "2026-09-15T00:00:00+07:00" (= 2026-09-14T17:00:00Z)
  // would be read as Sep 14, making the countdown off by 1 day. Now we
  // extract the Jakarta date key (yyyy-MM-dd) and parse that as a
  // browser-local midnight — consistent with how `todayMs` is built from
  // Jakarta parts.
  const dlJakartaStr = jakartaDateKey(new Date(g.deadline));
  const [y2, m2, d2] = dlJakartaStr.split('-').map(Number);
  const dlMs = new Date(y2, m2 - 1, d2).getTime();
  const daysLeft = Math.round((dlMs - todayMs) / 86_400_000);
  if (daysLeft < 0) {
    return { label: `Lewat ${Math.abs(daysLeft)}h`, urgent: false, past: true };
  }
  if (daysLeft === 0) return { label: 'Hari ini', urgent: true, past: false };
  if (daysLeft <= 7) return { label: `${daysLeft}h lagi`, urgent: true, past: false };
  return { label: `${daysLeft}h lagi`, urgent: false, past: false };
}
