'use client';

// components/habit-tracker/finance-savings-helpers.ts — helper & konstanta
// target tabungan (diekstrak verbatim dari finance-savings-goals.tsx, Task
// 71-i; dipakai root, kartu goal, dan form dialog).

import { MONTHS_ID } from '@/lib/finance-helpers';
import type { SavingsGoal } from './finance-types';

export interface GoalFormState {
  id: string | null;
  name: string;
  emoji: string;
  targetAmount: string;
  currentAmount: string;
  deadline: string;
}

export const GOAL_EMOJI_CHOICES = ['🎯', '💰', '🏠', '✈️', '📱', '🚗', '🎓', '💍', '🎁', '🐷'];

export const QUICK_CHIPS: Array<{ label: string; delta: number }> = [
  { label: '+Rp50rb', delta: 50_000 },
  { label: '+Rp100rb', delta: 100_000 },
];

export function emptyGoalForm(): GoalFormState {
  return { id: null, name: '', emoji: '🎯', targetAmount: '', currentAmount: '', deadline: '' };
}

export function goalPct(goal: SavingsGoal): number {
  const target = goal.targetAmount ?? 0;
  if (target <= 0) return 0;
  return Math.min(100, Math.round(((goal.currentAmount ?? 0) / target) * 100));
}

export function isComplete(goal: SavingsGoal): boolean {
  return goal.targetAmount > 0 && (goal.currentAmount ?? 0) >= goal.targetAmount;
}

/** 'yyyy-MM-dd' → '5 Sep 2026' (komponen YMD — bukan TZ browser). */
export function formatYMD(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return `${d} ${MONTHS_ID[m - 1]} ${y}`;
}
