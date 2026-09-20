// ---------------------------------------------------------------------------
// src/components/work/work-board-shared.ts — konstanta & tipe bersama sub-tab
// "Papan" (pecahan Task 71-e dari work-board.tsx): definisi kolom kanban,
// tabel geser cepat, prefiks id drag rutinitas, dan meta waktu Pagi/Siang/Sore.
// ---------------------------------------------------------------------------
import type { WorkRoutineItem, WorkTaskItem, WorkTaskStatus } from './work-types';

// Urutan kolom papan (status penyimpanan DB, bukan urutan visual bebas).
export const COLUMN_DEFS: { id: WorkTaskStatus; label: string; tone: string; dot: string }[] = [
  { id: 'todo', label: 'Belum', tone: 'text-muted-foreground', dot: 'bg-muted-foreground/40' },
  { id: 'jalan', label: 'Jalan', tone: 'text-primary', dot: 'bg-primary' },
  { id: 'nunggu', label: 'Nunggu', tone: 'text-warning dark:text-warning/80', dot: 'bg-warning' },
  { id: 'selesai', label: 'Selesai', tone: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
];

/** Urutan "geser cepat": todo → jalan → selesai → todo; nunggu → selesai. */
export const QUICK_NEXT: Record<string, string> = {
  todo: 'jalan',
  jalan: 'selesai',
  nunggu: 'selesai',
  selesai: 'todo',
};
export const QUICK_LABEL: Record<string, string> = {
  jalan: 'Jalan',
  selesai: 'Selesai',
  todo: 'Belum',
  nunggu: 'Nunggu',
};

// ── Rutinitas di papan (Task 22) ─────────────────────────────────────────────
// Kartu rutinitas = warga kelas satu papan: belum dicentang → kolom Belum,
// dicentang hari ini → kolom Selesai. ID sortable diberi prefiks supaya tidak
// mungkin bertabrakan dengan id tugas.

export const ROUTINE_PREFIX = 'routine:';
export const routineDragId = (r: WorkRoutineItem) => `${ROUTINE_PREFIX}${r.id}`;

export const ROUTINE_TIME_ORDER: Record<string, number> = { pagi: 0, siang: 1, sore: 2 };
export const ROUTINE_TIME_META: Record<string, { label: string; dot: string; text: string }> = {
  pagi: { label: 'Pagi', dot: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400' },
  siang: { label: 'Siang', dot: 'bg-primary', text: 'text-primary' },
  sore: { label: 'Sore', dot: 'bg-rose-400', text: 'text-rose-500 dark:text-rose-400' },
};

/** Item papan: kartu rutinitas atau kartu tugas lepas. */
export type BoardItem = { kind: 'routine'; routine: WorkRoutineItem } | { kind: 'task'; task: WorkTaskItem };
