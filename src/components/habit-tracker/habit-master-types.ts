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
  /** Task 36 — Target Lulus (jumlah hari menuju wisuda; null = selamanya). */
  targetDays: number | null;
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

/** Opsi Target Lulus (hari) — preset umum kebiasaan (21/30 hari dsb.). */
export const TARGET_DAYS_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Tanpa target (selamanya)' },
  { value: 7, label: '7 hari — seminggu' },
  { value: 21, label: '21 hari — 3 minggu' },
  { value: 30, label: '30 hari — sebulan' },
  { value: 60, label: '60 hari — 2 bulan' },
  { value: 90, label: '90 hari — 3 bulan' },
  { value: 365, label: '365 hari — setahun' },
];

export function emptyForm(): HabitFormData {
  return {
    name: '',
    icon: '🎯',
    category: 'Umum',
    priority: 'Sedang',
    difficulty: 'Sedang',
    habitType: 'normal',
    target: 1,
    targetDays: null,
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
  targetDays?: number | null;
  graduatedAt?: string | null;
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
    // Task 36: habit 'avoid' tidak punya garis finis — form memaksa null.
    targetDays: h.habitType === 'avoid' ? null : h.targetDays ?? null,
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

/** Status tampilan habit dari flag schema (isActive/isArchived/graduatedAt). */
export function habitStatus(h: Pick<import('./daily-tracker-types').Habit, 'isActive' | 'isArchived' | 'graduatedAt'>): 'active' | 'paused' | 'archived' | 'graduated' {
  if (h.isArchived) return 'archived';
  // Task 36: wisuda di atas dijeda — habit lulus tetap aktif di schema
  // (XP terjaga), tapi status tampilannya "Lulus".
  if (h.graduatedAt) return 'graduated';
  return h.isActive ? 'active' : 'paused';
}

export const HABIT_STATUS_LABELS: Record<'active' | 'paused' | 'archived' | 'graduated', string> = {
  active: 'Aktif',
  paused: 'Dijeda',
  archived: 'Diarsipkan',
  graduated: 'Lulus',
};

export const HABIT_TYPE_LABELS: Record<'normal' | 'amount' | 'avoid', string> = {
  normal: 'Normal',
  avoid: 'Hindari',
  amount: 'Jumlah',
};
