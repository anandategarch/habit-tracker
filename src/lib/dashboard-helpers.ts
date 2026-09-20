// lib/dashboard-helpers.ts — XP, level, streak, agregasi dashboard/tracker.
// Level memakai XP TOTAL all-time (fix Gelombang 1 — dulu todayXP reset harian).
import type { Habit } from '@/components/habit-tracker/daily-tracker-types';
import {
  isScheduledOn,
  parseSchedule,
  type HabitSchedule,
} from '@/lib/habit-schedule';

/** Opsi walk streak (Task 60-c — dipakai server & tracker via helper bersama).
 *
 *  - startDate: YMD mulai habit — hari SEBELUMNYA bukan bolong (tidak
 *    mengonsumsi kuota hari aman); menyetarakan streak dashboard dengan
 *    kartu tracker (audit 59-b2: angka beda antar layar).
 *  - onVacation: LEGACY — mode libur AKTIF tanpa interval tercatat (habit
 *    pra-Task 60): ekor hari kosong tidak memutus streak (beku sampai log
 *    selesai terakhir).
 *  - vacationDay: predikat hari NETRAL permanen (interval liburan tercatat
 *    di Habit.vacationIntervals — lihat lib/habit-vacation): tidak menambah
 *    streak, tidak putus, tidak makan hari aman, bahkan SETELAH liburan
 *    berakhir — janji UI "streak menyala kembali" (audit 59-b2 HIGH). */
export interface StreakWalkOpts {
  startDate?: string | null;
  onVacation?: boolean;
  vacationDay?: (ymd: string) => boolean;
}

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
  /** Task 60-c — lantai start, libur legacy, dan hari netral interval liburan. */
  opts: StreakWalkOpts = {},
): StreakShieldInfo {
  const sched =
    schedule === undefined || schedule === null
      ? null
      : typeof schedule === 'string'
        ? parseSchedule(schedule)
        : schedule;
  const notScheduled = (ymd: string): boolean =>
    !!sched && sched.kind !== 'daily' && !isScheduledOn(sched, ymd);
  const isVacation = opts.vacationDay ?? (() => false);
  const floor = opts.startDate ?? null;

  const usedByMonth = new Map<string, number>();
  const shieldedDays: string[] = [];

  let cursor = endYmd;
  // Jika hari ini belum ada, mulai dari kemarin (streak belum putus).
  // Task 60-c: hari ini NETRAL (libur) → jangan mundurkan — loop akan
  // melewati ekor libur sebagai hari netral.
  if (!doneDays.has(cursor) && !opts.onVacation && !isVacation(cursor)) {
    cursor = shiftYmd(cursor, -1);
  }

  let streak = 0;
  let consecutiveMissed = 0;
  let guard = 0;
  while (guard < STREAK_HARD_CAP) {
    // Task 37: hari tidak terjadwal → lewati (habit mingguan tidak putus
    // oleh hari Selasa bila jadwalnya hanya Senin). Task 60-c: hari libur
    // (interval) → netral dengan semantik sama — SEBELUM cek done supaya
    // hari libur konsisten "tak tercatat" (pola notScheduled).
    if (notScheduled(cursor) || isVacation(cursor)) {
      cursor = shiftYmd(cursor, -1);
      guard += 1;
      continue;
    }
    if (doneDays.has(cursor)) {
      streak += 1;
      consecutiveMissed = 0;
      cursor = shiftYmd(cursor, -1);
    } else if (opts.onVacation) {
      // LEGACY ekor libur tanpa interval: hari kosong netral (tanpa kuota);
      // berhenti bila melewati lantai start (streak memang belum pernah ada).
      if (floor && cursor < floor) break;
      cursor = shiftYmd(cursor, -1);
    } else {
      // Batas bawah: hari sebelum habit ada bukan "bolong" — jangan pakai
      // hari aman untuk hari sebelum mulai (Task 60-c: kini juga di sisi
      // server, dulu hanya helper tracker).
      if (floor && cursor < floor) break;
      // Hari kosong → coba hari aman (kuota per bulan kalender hari itu).
      const month = cursor.slice(0, 7);
      const used = usedByMonth.get(month) ?? 0;
      if (used >= shieldsPerMonth) break; // kuota bulan habis → putus
      // Task 39 (#1): kuota per bulan kalender tak pernah habis untuk habit
      // berjadwal jarang (bulanan 1-2 tanggal → maks 1-2 hari terjadwal per
      // bulan), sehingga streak tidak pernah putus walau bolong berbulan-
      // bulan (done Jan 2024 → bolong 11 bulan → done Jan 2025 = "streak 2").
      // Aturan tambahan: maksimal `shieldsPerMonth` hari terjadwal kosong
      // BERTURUT-TURUT — miss ke-(N+1) berturut memutus rantai. Habit harian
      // tidak berubah (2 bolong berurutan tetap diampuni, ke-3 tetap putus);
      // habit mingguan/bulanan kini putus setelah 3 kemunculan kosong berurut.
      if (consecutiveMissed >= shieldsPerMonth) break;
      consecutiveMissed += 1;
      usedByMonth.set(month, used + 1);
      shieldedDays.push(cursor);
      cursor = shiftYmd(cursor, -1);
    }
    guard += 1;
  }
  return { streak, shieldedDays, usedThisMonth: usedByMonth.get(endYmd.slice(0, 7)) ?? 0 };
}

export function computeStreakFromSet(
  doneDays: Set<string>,
  endYmd: string,
  schedule?: HabitSchedule | string | null,
  opts?: StreakWalkOpts,
): number {
  return computeStreakWithShields(doneDays, endYmd, SHIELDS_PER_MONTH, schedule, opts).streak;
}

/** Streak habit 'avoid' — hari BERSIH berturut-turut (log completed = kambuh).
 *
 * Task 60-d (audit 59-b2 LOW-MED): hari bersih HARI INI ikut dihitung
 * (sejak 00:01 — sinkron dengan isSuccess/KPI yang memakai semantik itu;
 * dulu walk mulai dari endYmd-1 → off-by-one konsisten vs dashboard).
 * Habit libur (interval) = netral: tidak dihitung, tidak memutus.
 * Dibatasi lantai startDate; hari tak terjadwal tidak dihitung (pola tracker). */
export function computeAvoidStreak(
  relapseDays: Set<string>,
  endYmd: string,
  schedule?: HabitSchedule | string | null,
  opts: StreakWalkOpts = {},
): number {
  const sched =
    schedule === undefined || schedule === null
      ? null
      : typeof schedule === 'string'
        ? parseSchedule(schedule)
        : schedule;
  const notScheduled = (ymd: string): boolean =>
    !!sched && sched.kind !== 'daily' && !isScheduledOn(sched, ymd);
  const isVacation = opts.vacationDay ?? (() => false);
  const floor = opts.startDate ?? null;

  let cursor = endYmd;
  let streak = 0;
  let guard = 0;
  while (guard < STREAK_HARD_CAP) {
    if (floor && cursor < floor) break; // sebelum habit ada
    if (isVacation(cursor)) {
      cursor = shiftYmd(cursor, -1);
      guard += 1;
      continue;
    }
    if (relapseDays.has(cursor)) break; // kambuh di luar libur → putus
    if (!notScheduled(cursor)) streak += 1; // hari tak terjadwal tidak dihitung
    cursor = shiftYmd(cursor, -1);
    guard += 1;
  }
  return streak;
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
