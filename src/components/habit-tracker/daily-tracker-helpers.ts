// ---------------------------------------------------------------------------
// components/habit-tracker/daily-tracker-helpers.ts — helper lokal tab Tracker.
//
// Semua tanggal logis = hari Jakarta; storage HabitLog/DailyLog.date =
// UTC-midnight. Kunci hari di client = slice(0,10) dari ISO (konvensi
// API-CONTRACT). JANGAN parseISO + format lokal (bug TZ ronde lama).
// ---------------------------------------------------------------------------

import type { HabitLog } from './daily-tracker-types';
// Aritmetika YMD string UTC-safe dari lib (satu implementasi bersama).
import { shiftYmd } from '@/lib/dashboard-helpers';

/** Kunci YMD 'yyyy-MM-dd' dari tanggal log (ISO string UTC-midnight atau Date). */
export function toDateString(date: string | Date): string {
  if (date instanceof Date) return date.toISOString().slice(0, 10);
  return String(date).slice(0, 10);
}

/** Alias kontrak parent: geser YMD sebanyak `delta` hari (string-safe, TZ-proof). */
export { shiftYmd as shiftYmdKey };

/**
 * Kunci bulan sebelumnya ('yyyy-MM' digeser -1 bulan; Januari → Desember
 * tahun lalu). M4-fix: dipakai tracker untuk mengambil log bulan sebelumnya
 * agar streak & jendela 7 hari flip-card tidak terpotong batas bulan.
 */
export function prevMonthKey(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return month;
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/**
 * Normalisasi payload /api/habits/batch-logs → map habitId → logs.
 * Kontrak API: { logs: HabitLog[] } (flat). Toleransi bentuk lama demi
 * robustness: array mentah, atau record habitId → logs.
 */
export function groupBatchLogs(json: unknown): Record<string, HabitLog[]> {
  let flat: HabitLog[] = [];
  if (Array.isArray(json)) {
    flat = json as HabitLog[];
  } else if (
    json &&
    typeof json === 'object' &&
    Array.isArray((json as { logs?: HabitLog[] }).logs)
  ) {
    flat = (json as { logs: HabitLog[] }).logs;
  } else if (json && typeof json === 'object') {
    flat = Object.values(json as Record<string, HabitLog[]>).flat();
  }
  const grouped: Record<string, HabitLog[]> = {};
  for (const log of flat) {
    if (log?.habitId) {
      (grouped[log.habitId] ||= []).push(log);
    }
  }
  return grouped;
}

/**
 * Waktu 'HH.mm' Jakarta dari completedAt (ISO dengan offset +07:00).
 * Intl dengan timeZone eksplisit — benar di browser TZ mana pun.
 */
export function formatJakartaTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

// ---------------------------------------------------------------------------
// computeStreak — streak harian dari log bulan berjalan (month cache).
// Opsi:
//  - invert   : habit 'avoid' → streak = hari berturut-turut TANPA kambuh
//               (log completed = kambuh), dibatasi startDate habit.
//  - startDate: YMD/ISO mulai habit — batas bawah hitungan.
//  - onVacation: habit sedang libur → ekor hari tanpa log TIDAK memutus
//               streak (jalan mundur sampai log selesai terakhir).
// Hari ini belum selesai tidak memutus streak (konvensi lama).
// ---------------------------------------------------------------------------
export interface ComputeStreakOptions {
  invert?: boolean;
  startDate?: string | null;
  onVacation?: boolean;
}

const STREAK_HARD_CAP = 4_000; // pengaman loop (± 11 tahun)

export function computeStreak(
  logs: HabitLog[],
  endYmd: string,
  opts: ComputeStreakOptions = {},
): number {
  const marks = new Set<string>();
  for (const log of logs) {
    if (log?.completed) marks.add(toDateString(log.date));
  }
  const floor = opts.startDate ? toDateString(opts.startDate) : null;

  // Habit 'avoid': hari tanpa kambuh dihitung berturut sejak habit mulai.
  if (opts.invert) {
    if (marks.has(endYmd)) return 0; // kambuh hari ini → streak putus
    let cursor = shiftYmd(endYmd, -1);
    let streak = 0;
    let guard = 0;
    while (!marks.has(cursor) && guard < STREAK_HARD_CAP) {
      if (floor && cursor < floor) break; // sebelum habit ada
      streak += 1;
      cursor = shiftYmd(cursor, -1);
      guard += 1;
    }
    return streak;
  }

  // Habit normal/amount: hari selesai berturut-turut.
  let cursor = endYmd;
  if (!marks.has(cursor)) {
    if (opts.onVacation) {
      // Mode libur: lompati ekor hari kosong sampai log selesai terakhir.
      let guard = 0;
      while (!marks.has(cursor) && guard < STREAK_HARD_CAP) {
        if (floor && cursor < floor) return 0;
        cursor = shiftYmd(cursor, -1);
        guard += 1;
      }
    } else {
      // Hari ini belum selesai → mulai dari kemarin (belum putus).
      cursor = shiftYmd(cursor, -1);
    }
  }
  let streak = 0;
  let guard = 0;
  while (marks.has(cursor) && guard < STREAK_HARD_CAP) {
    streak += 1;
    cursor = shiftYmd(cursor, -1);
    guard += 1;
  }
  return streak;
}

// ---------------------------------------------------------------------------
// saveDailyLog — simpan sebagian field DailyLog (upsert per tanggal).
// Kontrak API: PUT /api/daily-logs (partial-safe). Fallback POST bila route
// menolak method PUT (405/501) supaya kompatibel selama API agent lain
// masih menulis route.
// ---------------------------------------------------------------------------
export interface DailyLogPatch {
  date: string;
  mood?: number;
  energy?: number;
  sleep?: number;
  notes?: string;
}

export async function saveDailyLog(
  patch: DailyLogPatch,
  opts?: { keepalive?: boolean },
): Promise<Response> {
  const init: RequestInit = {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
    keepalive: opts?.keepalive,
  };
  let res = await fetch('/api/daily-logs', init);
  if (res.status === 405 || res.status === 501) {
    res = await fetch('/api/daily-logs', { ...init, method: 'POST' });
  }
  return res;
}

/** Bentukkan jam 'HH:mm' dari komponen jam/menit. */
export function padTime(hour: number, minute: number): string {
  const h = String(hour).padStart(2, '0');
  const m = String(minute).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Bersihkan HTML lama (era TipTap pada DailyLog.notes) menjadi teks polos.
 * Dipakai parent sebelum nilai masuk ke textarea catatan (RichNotesEditor
 * kini sepenuhnya controlled). Teks polos lolos apa adanya.
 */
export function htmlToPlainText(input: string): string {
  if (!input) return '';
  if (!input.includes('<')) return input;
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
