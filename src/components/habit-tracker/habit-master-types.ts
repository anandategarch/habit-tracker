// components/habit-tracker/habit-master-types.ts — tipe + helper form Habit
// Master. Habit/HabitGroup di-re-export dari daily-tracker-types (bentuk
// kanonik kontrak API); field form mengikuti schema Prisma (emoji, isActive,
// isArchived, vacationUntil — TIDAK ada icon/color/status/order/endDate).

import { jakartaDateString } from '@/lib/timezone';
import { parseSchedule } from '@/lib/habit-schedule';

/** BUGHUNT-47 (47-c #6): YMD jam-dinding JAKARTA dari nilai tanggal apa pun
 *  (Date / ISO string). slice(0,10) lama membaca komponen UTC — startDate
 *  default Prisma now() (jam 00:00–06:59 Jakarta = hari UTC sebelumnya)
 *  menampilkan tanggal mulai satu hari lebih awal di form, dan menekan
 *  Simpan menuliskan nilai salah itu permanen. */
function jakartaYmdOrNull(v: string | Date | null | undefined): string | null {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return jakartaDateString(d);
}

export type { Habit, HabitGroup } from './daily-tracker-types';

/** Task 37 — jenis jadwal tampil habit. */
export type ScheduleKind = 'daily' | 'weekly' | 'monthly';

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
  /** Task 37 — Jadwal Tampil: habit mingguan/bulanan hanya muncul di hari
   * terjadwalnya (disimpan sebagai JSON di kolom Habit.scheduleJson). */
  scheduleKind: ScheduleKind;
  /** Hari terpilih untuk jadwal mingguan (0=Minggu..6=Sabtu). */
  scheduleDays: number[];
  /** Tanggal terpilih untuk jadwal bulanan (1..31). */
  scheduleDates: number[];
  targetType: string;
  groupId: string | null;
  /** CONNECTED-APP (Task 49) — tujuan yang didukung habit (null = bebas). */
  goalId: string | null;
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
    scheduleKind: 'daily',
    scheduleDays: [],
    scheduleDates: [],
    targetType: 'daily',
    groupId: null,
    goalId: null,
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
  scheduleJson?: string | null;
  targetType?: string | null;
  groupId?: string | null;
  goalId?: string | null;
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
    // Task 37: jadwal tampil → field form (parse toleran; rusak = daily).
    ...((): { scheduleKind: ScheduleKind; scheduleDays: number[]; scheduleDates: number[] } => {
      const sched = parseSchedule(h.scheduleJson);
      return {
        scheduleKind: sched.kind,
        scheduleDays: sched.kind === 'weekly' ? sched.days : [],
        scheduleDates: sched.kind === 'monthly' ? sched.dates : [],
      };
    })(),
    targetType: h.targetType ?? 'daily',
    groupId: h.groupId ?? null,
    goalId: h.goalId ?? null,
    reminder: h.reminder ?? null,
    status: h.isActive ? 'active' : 'paused',
    // BUGHUNT-47 (47-c #6): baca tanggal mulai sebagai hari Jakarta (bukan
    // slice UTC — lihat jakartaYmdOrNull di atas).
    startDate: jakartaYmdOrNull(h.startDate) ?? jakartaDateString(),
    trackTime: h.trackTime,
    vacationMode: h.vacationMode,
    vacationEnd: jakartaYmdOrNull(h.vacationUntil),
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
