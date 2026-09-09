// ---------------------------------------------------------------------------
// src/components/work/work-types.ts — tipe payload API Meja Kerja (Task 17-a).
// Bentuk field identik dengan respons JSON route /api/work*.
// ---------------------------------------------------------------------------

export type WorkTimeOfDay = 'pagi' | 'siang' | 'sore';
export type WorkTaskStatus = 'todo' | 'jalan' | 'nunggu' | 'selesai';

export const WORK_TIME_OF_DAYS: WorkTimeOfDay[] = ['pagi', 'siang', 'sore'];

export const WORK_TASK_STATUSES: { value: WorkTaskStatus; label: string }[] = [
  { value: 'todo', label: 'Belum' },
  { value: 'jalan', label: 'Jalan' },
  { value: 'nunggu', label: 'Nunggu' },
  { value: 'selesai', label: 'Selesai' },
];

export const WORK_TIME_LABELS: Record<WorkTimeOfDay, string> = {
  pagi: 'Pagi',
  siang: 'Siang',
  sore: 'Sore',
};

export interface WorkRoutineItem {
  id: string;
  title: string;
  timeOfDay: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  doneToday: boolean;
  doneAt: string | null;
}

export interface WorkTaskItem {
  id: string;
  title: string;
  notes: string | null;
  status: string;
  dayKey: string | null;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  overdue: boolean;
  kapanSaja: boolean;
}

export interface WorkNoteItem {
  id: string;
  content: string;
  tag: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkStats {
  rutinAktif: number;
  rutinSelesai: number;
  tugasTodo: number;
  tugasJalan: number;
  tugasNunggu: number;
  tugasSelesai: number;
}

export interface WorkPayload {
  date: string;
  routines: WorkRoutineItem[];
  tasks: WorkTaskItem[];
  notes: WorkNoteItem[];
  stats: WorkStats;
}

export interface WorkSearchResult {
  q: string;
  tasks: WorkTaskItem[];
  notes: WorkNoteItem[];
}

export interface AiParsedPayload {
  tasks: { title: string }[];
  notes: { content: string }[];
  summary: string;
}

/** Tugas dibuat hari ini (badge BARU) — createdAt berada pada dayKey "today". */
export function isTaskNew(task: WorkTaskItem, today: string): boolean {
  return task.createdAt.slice(0, 10) === today;
}
