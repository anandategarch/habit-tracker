// lib/dashboard-helpers.ts — XP, level, streak, agregasi dashboard/tracker.
// Level memakai XP TOTAL all-time (fix Gelombang 1 — dulu todayXP reset harian).
import type { Habit, HabitLog } from '@/components/habit-tracker/daily-tracker-types';

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
 */
export function computeStreakFromSet(doneDays: Set<string>, endYmd: string): number {
  let streak = 0;
  let cursor = endYmd;
  // Jika hari ini belum ada, mulai dari kemarin (streak belum putus).
  if (!doneDays.has(cursor)) {
    cursor = shiftYmd(cursor, -1);
  }
  while (doneDays.has(cursor)) {
    streak += 1;
    cursor = shiftYmd(cursor, -1);
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
