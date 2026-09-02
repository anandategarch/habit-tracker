// Shared types & constants for habit-master and its sub-components.

export interface Habit {
  id: string;
  name: string;
  icon: string;
  category: string;
  priority: string;
  difficulty: string;
  target: number;
  targetType: string;
  color: string;
  reminder: string | null;
  startDate: string;
  endDate: string | null;
  status: string;
  notes: string | null;
  order: number;
  trackTime: boolean;
  targetTime: string | null;
  trackLastDone: boolean;
  lastDoneInterval: string | null;
  groupId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HabitGroup {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  order: number;
  _count: { habits: number };
}

export type HabitFormData = Omit<Habit, 'id' | 'createdAt' | 'updatedAt'>;

export const TARGET_TYPES = ['daily', 'weekly', 'monthly'] as const;
export const STATUSES = ['active', 'paused', 'archived'] as const;

export const DEFAULT_EMOJIS = ['🎯', '💪', '📚', '🧘', '🏃', '💧', '🍎', '💤', '✍️', '🎨'];

export const GROUP_EMOJIS = ['🌅', '🏃‍♂️', '💪', '📖', '🧘', '💤', '🧹', '🍳', '💼', '📱', '🎯', '📝', '🏠', '💧', '💊', '✨', '🌟'];

export const GROUP_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  archived: 'bg-slate-100 text-slate-500 dark:bg-slate-800/40 dark:text-slate-400',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

import { jakartaDateString } from '@/lib/timezone';

export function emptyForm(): HabitFormData {
  return {
    name: '',
    icon: '🎯',
    category: 'General',
    priority: 'Medium',
    difficulty: 'Medium',
    target: 1,
    targetType: 'daily',
    color: '#22c55e',
    reminder: '',
    startDate: jakartaDateString(),
    endDate: '',
    status: 'active',
    notes: '',
    order: 0,
    trackTime: false,
    targetTime: '',
    trackLastDone: false,
    lastDoneInterval: '',
    groupId: null,
  };
}

export function habitToForm(h: Habit): HabitFormData {
  return {
    name: h.name,
    icon: h.icon,
    category: h.category,
    priority: h.priority,
    difficulty: h.difficulty,
    target: h.target,
    targetType: h.targetType,
    color: h.color,
    reminder: h.reminder ?? '',
    startDate: h.startDate ? h.startDate.split('T')[0] : '',
    endDate: h.endDate ? h.endDate.split('T')[0] : '',
    status: h.status,
    notes: h.notes ?? '',
    order: h.order,
    trackTime: h.trackTime ?? false,
    targetTime: h.targetTime ?? '',
    trackLastDone: h.trackLastDone ?? false,
    lastDoneInterval: h.lastDoneInterval ?? '',
    groupId: h.groupId ?? null,
  };
}
