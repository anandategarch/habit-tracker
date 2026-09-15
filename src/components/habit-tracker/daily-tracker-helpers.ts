// ---------------------------------------------------------------------------
// components/habit-tracker/daily-tracker-helpers.ts — helper lokal tab Tracker.
//
// Semua tanggal logis = hari Jakarta; storage HabitLog/DailyLog.date =
// UTC-midnight. Kunci hari di client = slice(0,10) dari ISO (konvensi
// API-CONTRACT). JANGAN parseISO + format lokal (bug TZ ronde lama).
// ---------------------------------------------------------------------------

import type { HabitLog } from './daily-tracker-types';
// Aritmetika YMD string UTC-safe + kuota hari aman dari lib (implementasi
// bersama — dipakai juga oleh /api/dashboard & lencana milestone).
import {
  computeAvoidStreak,
  computeStreakWithShields,
  shiftYmd,
  SHIELDS_PER_MONTH,
  type StreakWalkOpts,
} from '@/lib/dashboard-helpers';
import { type HabitSchedule } from '@/lib/habit-schedule';
import { jakartaDateString } from '@/lib/timezone';
import { parseVacationIntervals, vacationDayPredicate, type VacationInterval } from '@/lib/habit-vacation';

/** Kunci YMD 'yyyy-MM-dd' dari tanggal log (ISO string UTC-midnight atau Date). */
export function toDateString(date: string | Date): string {
  if (date instanceof Date) return date.toISOString().slice(0, 10);
  return String(date).slice(0, 10);
}

/** YMD JAKARTA dari timestamp asli (string ISO / Date) — BEDA dengan
 *  `toDateString` (potong UTC) yang dipakai untuk kolom `date` log yang
 *  memang dijangkar UTC-noon. startDate/graduatedAt adalah momen NYATA:
 *  kejadian jam 00:00–06:59 Jakarta (17:00–23:59 UTC hari sebelumnya) akan
 *  jatuh ke hari yang salah bila dipotong UTC (kelas bug STREAK-TZ).
 *  Task 39 (#9). */
export function jakartaYmdOf(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  return jakartaDateString(d);
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
//               Task 60-d: hari bersih HARI INI ikut dihitung (sinkron KPI
//               isSuccess — dulu mulai endYmd-1 → off-by-one).
//  - startDate: YMD/ISO mulai habit — batas bawah hitungan.
//  - onVacation: LEGACY — habit sedang libur TANPA interval tercatat → ekor
//               hari tanpa log TIDAK memutus streak (beku).
//  - vacation : Task 60-c — interval liburan tercatat (Habit.vacationIntervals):
//               hari dalam [start..until] NETRAL permanen (tidak putus, tanpa
//               hari aman) — "streak menyala kembali" setelah libur berakhir.
//  - schedule (Task 37): jadwal tampil habit — hari TIDAK terjadwal dilewati
//               (tidak putus, tidak konsumsi hari aman, tidak dihitung).
// Hari ini belum selesai tidak memutus streak (konvensi lama).
//
// Task 36 — HARI AMAN (streak shield): untuk habit normal/amount, hari kosong
// mengonsumsi kuota SHIELDS_PER_MONTH (per bulan kalender, dari
// lib/dashboard-helpers) dan TIDAK memutus rantai. Hari aman tidak menambah
// hitungan streak. Hari sebelum startDate tidak dihitung miss → tidak
// mengonsumsi kuota. Habit 'avoid' tidak memakai hari aman (hari tanpa log
// = hari bersih, bukan bolong).
//
// Task 60-c: walk kini didelegasikan ke lib/dashboard-helpers (satu sumber
// kebenaran bersama server — dulu dua implementasi kembar harus disinkron
// manual lewat komentar Task 39 #1).
// ---------------------------------------------------------------------------
export interface ComputeStreakOptions {
  invert?: boolean;
  startDate?: string | null;
  onVacation?: boolean;
  /** Task 60-c — interval liburan (parse dari habit.vacationIntervals). */
  vacation?: VacationInterval[];
  /** Task 37 — Jadwal Tampil: hari tidak terjadwal dilewati dalam walk. */
  schedule?: HabitSchedule;
}

/** Hasil detail streak + info hari aman (dipakai kartu habit). */
export interface StreakDetail {
  streak: number;
  /** YMD hari kosong yang diampuni hari aman (urut walk mundur). */
  shieldedDays: string[];
  /** Sisa hari aman bulan `endYmd` (untuk chip 🛡 di kartu). */
  shieldsLeftThisMonth: number;
}

export function computeStreakDetail(
  logs: HabitLog[],
  endYmd: string,
  opts: ComputeStreakOptions = {},
): StreakDetail {
  const marks = new Set<string>();
  for (const log of logs) {
    if (log?.completed) marks.add(toDateString(log.date));
  }
  const floor = opts.startDate ? jakartaYmdOf(opts.startDate) : null;
  const sched = opts.schedule;

  // Opsi walk bersama (lib/dashboard-helpers — Task 60-c).
  const walkOpts: StreakWalkOpts = {
    startDate: floor,
    onVacation: opts.onVacation,
    vacationDay: opts.vacation?.length
      ? vacationDayPredicate(opts.vacation, endYmd)
      : undefined,
  };

  // Habit 'avoid': hari tanpa kambuh dihitung berturut sejak habit mulai
  // (Termasuk HARI INI bila bersih — Task 60-d, sinkron isSuccess/KPI).
  if (opts.invert) {
    const streak = computeAvoidStreak(marks, endYmd, sched, walkOpts);
    return { streak, shieldedDays: [], shieldsLeftThisMonth: SHIELDS_PER_MONTH };
  }

  // Habit normal/amount: hari selesai berturut-turut + hari aman (lib).
  const info = computeStreakWithShields(marks, endYmd, SHIELDS_PER_MONTH, sched, walkOpts);
  return {
    streak: info.streak,
    shieldedDays: info.shieldedDays,
    shieldsLeftThisMonth: SHIELDS_PER_MONTH - info.usedThisMonth,
  };
}

/** Interval liburan habit dari bentukan serialisasi API (toleran null). */
export function vacationIntervalsOf(habit: {
  vacationIntervals?: string | null;
}): VacationInterval[] {
  return parseVacationIntervals(habit.vacationIntervals);
}

export function computeStreak(
  logs: HabitLog[],
  endYmd: string,
  opts: ComputeStreakOptions = {},
): number {
  return computeStreakDetail(logs, endYmd, opts).streak;
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
