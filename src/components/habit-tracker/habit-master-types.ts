// components/habit-tracker/habit-master-types.ts — tipe + helper form Habit
// Master. Habit/HabitGroup di-re-export dari daily-tracker-types (bentuk
// kanonik kontrak API); field form mengikuti schema Prisma (emoji, isActive,
// isArchived, vacationUntil — TIDAK ada icon/color/status/order/endDate).

import { jakartaDateString } from '@/lib/timezone';

export type { Habit, HabitGroup } from './daily-tracker-types';

/** Tipe target (kolom disiapkan; UI hanya mendukung 'daily' — BUG-14). */
export const TARGET_TYPES = ['daily', 'weekly', 'monthly'] as const;

/** Status form habit: aktif / dijeda (arsip lewat tombol baris). */
export const STATUSES = ['active', 'paused'] as const;

/** Emoji pilihan untuk picker habit. */
export const DEFAULT_EMOJIS = [
  '🎯', '🧘', '💧', '📚', '🏃', '📓', '🥗', '💪', '😴', '🌅',
  '🚫', '💰', '🧠', '🎧', '🌱', '🦷', '🧹', '☀️', '🚶', '📵',
] as const;

export interface HabitFormData {
  name: string;
  /** Emoji habit (schema: Habit.emoji). */
  icon: string;
  category: string;
  priority: string;
  difficulty: string;
  habitType: 'normal' | 'amount' | 'avoid';
  target: number;
  targetType: string;
  groupId: string | null;
  reminder: string | null;
  status: 'active' | 'paused';
  /** 'yyyy-MM-dd' (Jakarta). */
  startDate: string;
  trackTime: boolean;
  vacationMode: boolean;
  /** 'yyyy-MM-dd' (opsional) → schema Habit.vacationUntil. */
  vacationEnd: string | null;
  notes: string | null;
}

export function emptyForm(): HabitFormData {
  return {
    name: '',
    icon: '🎯',
    category: 'Umum',
    priority: 'Sedang',
    difficulty: 'Sedang',
    habitType: 'normal',
    target: 1,
    targetType: 'daily',
    groupId: null,
    reminder: null,
    status: 'active',
    startDate: jakartaDateString(),
    trackTime: false,
    vacationMode: false,
    vacationEnd: null,
    notes: null,
  };
}

export function habitToForm(h: {
  name: string;
  emoji: string;
  category: string;
  priority: string;
  difficulty: string;
  habitType: 'normal' | 'amount' | 'avoid';
  target: number;
  targetType?: string | null;
  groupId?: string | null;
  reminder?: string | null;
  isActive: boolean;
  startDate: string;
  trackTime: boolean;
  vacationMode: boolean;
  vacationUntil?: string | null;
  notes?: string | null;
}): HabitFormData {
  return {
    name: h.name,
    icon: h.emoji || '🎯',
    category: h.category,
    priority: h.priority,
    difficulty: h.difficulty,
    habitType: h.habitType ?? 'normal',
    target: h.target ?? 1,
    targetType: h.targetType ?? 'daily',
    groupId: h.groupId ?? null,
    reminder: h.reminder ?? null,
    status: h.isActive ? 'active' : 'paused',
    // slice(0,10): startDate ISO → kunci YMD (konvensi kunci hari client).
    startDate: String(h.startDate).slice(0, 10) || jakartaDateString(),
    trackTime: h.trackTime,
    vacationMode: h.vacationMode,
    vacationEnd: h.vacationUntil ? String(h.vacationUntil).slice(0, 10) : null,
    notes: h.notes ?? null,
  };
}

/** Status tampilan habit dari flag schema (isActive/isArchived). */
export function habitStatus(h: Pick<import('./daily-tracker-types').Habit, 'isActive' | 'isArchived'>): 'active' | 'paused' | 'archived' {
  if (h.isArchived) return 'archived';
  return h.isActive ? 'active' : 'paused';
}

export const HABIT_STATUS_LABELS: Record<'active' | 'paused' | 'archived', string> = {
  active: 'Aktif',
  paused: 'Dijeda',
  archived: 'Diarsipkan',
};

export const HABIT_TYPE_LABELS: Record<'normal' | 'amount' | 'avoid', string> = {
  normal: 'Normal',
  avoid: 'Hindari',
  amount: 'Jumlah',
};
