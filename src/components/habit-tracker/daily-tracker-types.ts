// components/habit-tracker/daily-tracker-types.ts — bentuk serialisasi API habit.
// Date dikirim sebagai string ISO oleh API (client memakai slice(0,10) sebagai kunci YMD).

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  category: string;
  priority: string;
  difficulty: string;
  habitType: 'normal' | 'amount' | 'avoid';
  target: number;
  unit?: string | null;
  targetType?: string | null;
  /** Task 36 — Target Lulus: jumlah hari selesai menuju wisuda (null = tanpa target). */
  targetDays?: number | null;
  /** Task 36 — tanggal lulus ISO (null = belum lulus). */
  graduatedAt?: string | null;
  /** Task 37 — Jadwal Tampil (JSON {kind:'weekly',days}|{kind:'monthly',dates}; null = setiap hari). */
  scheduleJson?: string | null;
  reminder?: string | null;
  notes?: string | null;
  trackTime: boolean;
  groupId?: string | null;
  /** CONNECTED-APP (Task 49) — tujuan yang didukung habit ini (null = bebas). */
  goalId?: string | null;
  sortOrder: number;
  isActive: boolean;
  isArchived: boolean;
  vacationMode: boolean;
  vacationUntil?: string | null;
  /** Task 60-c — JSON interval liburan [{s,u}] (lihat lib/habit-vacation):
   *  hari dalam interval = NETRAL permanen bagi streak. null = habit lama. */
  vacationIntervals?: string | null;
  startDate: string;
  createdAt?: string;
  updatedAt?: string;
  /** Jumlah log selesai all-time (dihitung API /api/habits — Gelombang 1). */
  completedLogCount?: number;
  /** Task 62+ — zona Peta Otot ('dada'|'punggung'|…|'fullbody'; null/absen =
   *  habit biasa). GET /api/habits mengirim kolom ini (findMany tanpa select).
   *  Audit 77-e: dipakai toggle Tracker untuk menyegarkan query gym. */
  muscleZone?: string | null;
}

export interface HabitLog {
  id: string;
  habitId: string;
  /** ISO UTC-midnight; kunci hari = slice(0,10). */
  date: string;
  completed: boolean;
  value: number;
  completedAt?: string | null;
  notes?: string | null;
}

export interface DailyLog {
  id: string;
  /** ISO UTC-midnight; kunci hari = slice(0,10). */
  date: string;
  mood: number;
  energy: number;
  sleep: number;
  notes?: string | null;
  updatedAt?: string;
}

export interface HabitOption {
  id: string;
  type: string;
  label: string;
  color?: string | null;
  sortOrder: number;
}

export interface HabitGroup {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}
