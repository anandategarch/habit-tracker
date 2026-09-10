// ---------------------------------------------------------------------------
// src/components/work/work-types.ts — tipe payload API Meja Kerja (Task 17-a).
// Bentuk field identik dengan respons JSON route /api/work*.
// ---------------------------------------------------------------------------
import { jakartaDateString } from '@/lib/timezone';

export type WorkTimeOfDay = 'pagi' | 'siang' | 'sore';
export type WorkTaskStatus = 'todo' | 'jalan' | 'nunggu' | 'selesai';

/** Task 26 (Fase 1+2 riset catatan): kapasitas isi Catatan Meja Kerja. */
export const NOTE_CONTENT_MAX = 5000;

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
  /** Fase 2: Mode Libur aktif untuk tanggal payload ini. */
  holiday: boolean;
}

export interface WorkSearchResult {
  q: string;
  tasks: WorkTaskItem[];
  notes: WorkNoteItem[];
}

/** Fase 2 (Task 19): payload Papan Tugas + Arsip dari /api/work/board. */
export interface WorkBoardPayload {
  date: string;
  /** Semua tugas terbuka (overdue / kapan saja / hari ini / depan). */
  tasks: WorkTaskItem[];
  /** Tugas selesai HARI INI (kolom Selesai di papan). */
  doneToday: WorkTaskItem[];
  /** Tugas selesai dari hari sebelumnya (maks 30 terbaru). */
  archive: WorkTaskItem[];
  stats: {
    todo: number;
    jalan: number;
    nunggu: number;
    selesaiHariIni: number;
    arsip: number;
  };
  holiday: boolean;
}

export interface AiParsedPayload {
  tasks: { title: string }[];
  notes: { content: string }[];
  summary: string;
}

/** Tugas dibuat hari ini (badge BARU) — createdAt dikonversi ke tanggal Jakarta
 *  dulu (bukan slice UTC mentah) supaya tugas yang dibuat 00:00–06:59 pagi
 *  WIB tetap dihitung "baru" (UTC masih tanggal kemarin di jam segitu). */
export function isTaskNew(task: WorkTaskItem, today: string): boolean {
  try {
    return jakartaDateString(new Date(task.createdAt)) === today;
  } catch {
    return task.createdAt.slice(0, 10) === today;
  }
}
