// Validasi field Meja Kerja (dipakai route /api/work/* — Task 17-a).
import { badRequest } from './api-utils';
import { NOTE_CONTENT_MAX } from '@/components/work/work-types';

export const WORK_TIME_OF_DAY = ['pagi', 'siang', 'sore'] as const;
export const WORK_TASK_STATUS = ['todo', 'jalan', 'nunggu', 'selesai'] as const;

export type WorkTimeOfDay = (typeof WORK_TIME_OF_DAY)[number];
export type WorkTaskStatus = (typeof WORK_TASK_STATUS)[number];

/** Nilai timeOfDay valid (pagi|siang|sore) atau null bila field tidak string. */
export function parseTimeOfDay(v: unknown): WorkTimeOfDay | null {
  if (typeof v !== 'string') return null;
  const found = WORK_TIME_OF_DAY.find((t) => t === v);
  return found ?? null;
}

/** Nilai status tugas valid (todo|jalan|nunggu|selesai) atau null. */
export function parseTaskStatus(v: unknown): WorkTaskStatus | null {
  if (typeof v !== 'string') return null;
  const found = WORK_TASK_STATUS.find((s) => s === v);
  return found ?? null;
}

/** Batas panjang judul/isi supaya DB & UI tetap enak dibaca. */
export const WORK_TITLE_MAX = 200;
export const WORK_NOTES_MAX = 2000;

/** Trim + validasi panjang judul; throw 400 bila kosong/kepanjangan. */
export function requireTitle(v: unknown, label: string): string {
  if (typeof v !== 'string' || !v.trim()) throw badRequest(`${label} wajib diisi`);
  const trimmed = v.trim();
  if (trimmed.length > WORK_TITLE_MAX) {
    throw badRequest(`${label} terlalu panjang (maks ${WORK_TITLE_MAX} karakter)`);
  }
  return trimmed;
}

/** Isi Catatan Meja Kerja (Task 26): multiline + markdown-lite, 5.000 karakter.
 *  Selama ini dibatasi requireTitle (200) — akar keluhan catatan tak bisa panjang. */
export function requireNoteContent(v: unknown, label = 'Isi catatan'): string {
  if (typeof v !== 'string' || !v.trim()) throw badRequest(`${label} wajib diisi`);
  const trimmed = v.trim();
  if (trimmed.length > NOTE_CONTENT_MAX) {
    throw badRequest(`${label} terlalu panjang (maks ${NOTE_CONTENT_MAX.toLocaleString('id-ID')} karakter)`);
  }
  return trimmed;
}

/** Trim + validasi catatan/notes opsional (null bila kosong); throw bila kepanjangan. */
export function cleanOptionalText(v: unknown, label: string): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') throw badRequest(`${label} tidak valid`);
  const trimmed = v.trim();
  if (!trimmed) return null;
  if (trimmed.length > WORK_NOTES_MAX) {
    throw badRequest(`${label} terlalu panjang (maks ${WORK_NOTES_MAX} karakter)`);
  }
  return trimmed;
}
