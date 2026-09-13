// lib/dashboard-helpers.ts — XP, level, streak, agregasi dashboard/tracker.
// Level memakai XP TOTAL all-time (fix Gelombang 1 — dulu todayXP reset harian).
import type { Habit, HabitLog } from '@/components/habit-tracker/daily-tracker-types';
import {
  isScheduledOn,
  parseSchedule,
  type HabitSchedule,
} from '@/lib/habit-schedule';

/** Bobot XP per difficulty habit.
 *
 * M1-fix: label Indonesia (Mudah/Sedang/Sulit — dipakai seed & habit-options)
 * kini setara dengan label Inggris. Sebelumnya habit ber-difficulty Indonesia
 * jatuh ke default 10 → XP tracker ≠ XP dashboard (contoh runtime:
 * tracker 1280 vs dashboard 1315). Selaras dengan XP_WEIGHTS di
 * app/api/_lib/api-utils (sumber bobot /api/dashboard).
 */
export const XP_MAP: Record<string, number> = {
  Easy: 5,
  Medium: 10,
  Hard: 20,
  Mudah: 5,
  Sedang: 10,
  Sulit: 20,
};

export function xpForHabit(habit: Pick<Habit, 'difficulty'>): number {
  return XP_MAP[habit.difficulty] ?? 10;
}

/** Level = floor(sqrt(totalXP / 20)); Lv1 dicapai pada 20 XP. */
export function calcLevel(totalXp: number): number {
  if (!Number.isFinite(totalXp) || totalXp <= 0) return 0;
  return Math.floor(Math.sqrt(totalXp / 20));
}

/** XP minimum untuk mencapai level L. */
export function xpForLevel(level: number): number {
  return 20 * level * level;
}

/** XP yang dibutuhkan dari level sekarang ke berikutnya. */
export function levelProgress(totalXp: number): { level: number; current: number; needed: number; pct: number } {
  const level = calcLevel(totalXp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = next - base;
  const current = Math.max(0, totalXp - base);
  return { level, current, needed: span, pct: span > 0 ? Math.min(100, (current / span) * 100) : 0 };
}

/**
 * Streak hari berturut-turut hingga (termasuk) `endYmd`.
 * Log diberikan sebagai Set YMD 'yyyy-MM-dd' (konvensi UTC-midnight slice(0,10)).
 * Hari ini belum selesai tidak memutus streak.
 *
 * Task 36 — HARI AMAN (streak shield): hari kosong TIDAK langsung memutus
 * streak. Setiap bulan kalender ada kuota `SHIELDS_PER_MONTH` hari aman;
 * hari kosong mengonsumsi satu kuota bulan-nya (hari aman tidak menambah
 * hitungan streak, hanya menjaga rantai tetap nyambung). Kuota habis atau
 * hari kosong sebelum habit ada → streak putus. Penilaian deterministik
 * dari kumpulan log (tanpa penulisan ledger) sehingga semua konsumen
 * (dashboard global, kartu habit, lencana milestone) selalu sepakat.
 */
export const SHIELDS_PER_MONTH = 2;

const STREAK_HARD_CAP = 4_000; // pengaman loop (± 11 tahun)

export interface StreakShieldInfo {
  streak: number;
  /** YMD hari kosong yang diampuni hari aman (urut walk mundur, terbaru dulu). */
  shieldedDays: string[];
  /** Hari aman terpakai pada bulan kalender `endYmd`. */
  usedThisMonth: number;
}

export function computeStreakWithShields(
  doneDays: Set<string>,
  endYmd: string,
  shieldsPerMonth: number = SHIELDS_PER_MONTH,
  /** Task 37 — jadwal habit: hari tidak terjadwal dilewati (tidak putus,
   *  tidak konsumsi hari aman, tidak dihitung). Menerima objek atau JSON mentah. */
  schedule?: HabitSchedule | string | null,
): StreakShieldInfo {
  const sched =
    schedule === undefined || schedule === null
      ? null
      : typeof schedule === 'string'
        ? parseSchedule(schedule)
        : schedule;
  const notScheduled = (ymd: string): boolean =>
    !!sched && sched.kind !== 'daily' && !isScheduledOn(sched, ymd);

  const usedByMonth = new Map<string, number>();
  const shieldedDays: string[] = [];

  let cursor = endYmd;
  // Jika hari ini belum ada, mulai dari kemarin (streak belum putus).
  if (!doneDays.has(cursor)) {
    cursor = shiftYmd(cursor, -1);
  }

  let streak = 0;
  let guard = 0;
  while (guard < STREAK_HARD_CAP) {
    // Task 37: hari tidak terjadwal → lewati (habit mingguan tidak putus
    // oleh hari Selasa bila jadwalnya hanya Senin).
    if (notScheduled(cursor)) {
      cursor = shiftYmd(cursor, -1);
      guard += 1;
      continue;
    }
    if (doneDays.has(cursor)) {
      streak += 1;
      cursor = shiftYmd(cursor, -1);
    } else if (shieldsPerMonth > 0) {
      // Hari kosong → coba hari aman (kuota per bulan kalender hari itu).
      const month = cursor.slice(0, 7);
      const used = usedByMonth.get(month) ?? 0;
      if (used >= shieldsPerMonth) break; // kuota bulan habis → putus
      usedByMonth.set(month, used + 1);
      shieldedDays.push(cursor);
      cursor = shiftYmd(cursor, -1);
    } else {
      break;
    }
    guard += 1;
  }
  return { streak, shieldedDays, usedThisMonth: usedByMonth.get(endYmd.slice(0, 7)) ?? 0 };
}

export function computeStreakFromSet(
  doneDays: Set<string>,
  endYmd: string,
  schedule?: HabitSchedule | string | null,
): number {
  return computeStreakWithShields(doneDays, endYmd, SHIELDS_PER_MONTH, schedule).streak;
}

/** Aritmetika YMD string UTC-safe (tidak lewat Date lokal). */
export function shiftYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d) + delta * 86_400_000;
  const t = new Date(ms);
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** Map YMD -> HabitLog dari daftar log (key = date YMD 'yyyy-MM-dd'). */
export function buildLogMap(logs: HabitLog[]): Map<string, HabitLog> {
  const map = new Map<string, HabitLog>();
  for (const log of logs) {
    const raw: unknown = log.date;
    const key =
      typeof raw === 'string'
        ? raw.slice(0, 10)
        : raw instanceof Date
          ? raw.toISOString().slice(0, 10)
          : String(raw).slice(0, 10);
    map.set(key, log);
  }
  return map;
}
