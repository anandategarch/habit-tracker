// ─────────────────────────────────────────────────────────────────────────────
// src/lib/muscle-map-history.ts — V2 (Task 65): LAPISAN TURUNAN KEDUA —
// riwayat mingguan, minggu terbaik, PR zona, dan pencapaian gym.
//
// Pustaka MURNI (tanpa I/O) — tetap MURNI MEMBACA event (HabitLog zona):
// tidak ada tabel/kolom/state baru — semua dihitung dari daftar YMD sesi.
// Dipanggil server (api/gym/route.ts → computeGymHistory); tipe payload
// dikonsumsi klien via barrel '@/lib/muscle-map' (gym-history.tsx, sheet
// zona PR, header sheet).
// ─────────────────────────────────────────────────────────────────────────────

import { MUSCLE_ZONE_DEFS, MISSION_ZONE_DEFS, type MuscleZoneKey } from './muscle-map-zones';

/** Kolom heatmap: 12 minggu terakhir (kolom terakhir = minggu berjalan). */
export const GYM_HISTORY_WEEKS = 12;

export interface GymHistoryCell {
  weekStartYmd: string;
  /** Sesi efektif zona minggu itu (mission zone = own + kontribusi Full Body). */
  sessions: number;
}

export interface GymZoneHistoryPayload {
  key: MuscleZoneKey;
  label: string;
  /** Sel heatmap GYM_HISTORY_WEEKS kolom (terlama → minggu berjalan). */
  cells: GymHistoryCell[];
  /** PR zona: sesi efektif terbanyak dalam satu minggu (sepanjang masa). */
  bestWeekSessions: number;
  bestWeekStartYmd: string | null;
  /** PR zona: hari berturut-turut dengan sesi zona sendiri (sepanjang masa). */
  longestStreakDays: number;
}

export interface GymBestWeekPayload {
  weekStartYmd: string;
  /** Total sesi ASLI minggu itu (Σ own zona misi + own Full Body).
   *  Task 70 (audit 70-a m2): dulu sesi efektif — 1 sesi Full Body
   *  terhitung "7 sesi" (1 fb + kontribusi ke 6 zona misi). */
  totalSessions: number;
  /** Berapa zona utama tersentuh minggu itu (efektif — fb menyentuh semua). */
  zonesTouched: number;
}

export type GymAchievementKind =
  | 'total'
  | 'fullbody'
  | 'balancedWeeks'
  | 'perfectZones'
  | 'longestZoneStreak';

export interface GymAchievementDef {
  id: string;
  emoji: string;
  title: string;
  description: string;
  kind: GymAchievementKind;
  threshold: number;
}

/** 10 pencapaian gym (desain user #bonus: milestone + minggu seimbang). */
export const GYM_ACHIEVEMENT_DEFS: GymAchievementDef[] = [
  { id: 'first-session', emoji: '🌱', title: 'Langkah Pertama', description: 'Selesaikan 1 sesi latihan apa pun.', kind: 'total', threshold: 1 },
  { id: 'sessions-10', emoji: '🔥', title: '10 Sesi', description: 'Kumpulkan 10 sesi latihan sepanjang masa.', kind: 'total', threshold: 10 },
  { id: 'sessions-25', emoji: '🏋️', title: '25 Sesi', description: 'Kumpulkan 25 sesi latihan sepanjang masa.', kind: 'total', threshold: 25 },
  { id: 'sessions-50', emoji: '💎', title: '50 Sesi', description: 'Kumpulkan 50 sesi latihan sepanjang masa.', kind: 'total', threshold: 50 },
  { id: 'sessions-100', emoji: '🏆', title: '100 Sesi', description: 'Kumpulkan 100 sesi latihan sepanjang masa.', kind: 'total', threshold: 100 },
  { id: 'fullbody-1', emoji: '🏃', title: 'Sirkuit Lengkap', description: 'Selesaikan 1 sesi Full Body.', kind: 'fullbody', threshold: 1 },
  { id: 'balanced-1', emoji: '⚖️', title: 'Minggu Seimbang', description: 'Sentuh semua 6 zona dalam satu minggu.', kind: 'balancedWeeks', threshold: 1 },
  { id: 'balanced-4', emoji: '⚖️', title: '4 Minggu Seimbang', description: 'Raih Minggu Seimbang sebanyak 4 minggu (beda).', kind: 'balancedWeeks', threshold: 4 },
  { id: 'perfect-week', emoji: '🎯', title: 'Minggu Sempurna', description: 'Semua 6 zona capai target mingguan dalam satu minggu.', kind: 'perfectZones', threshold: 6 },
  { id: 'zone-streak-7', emoji: '⚡', title: 'Zona Panas 7 Hari', description: 'Satu zona dilatih 7 hari berturut-turut.', kind: 'longestZoneStreak', threshold: 7 },
];

export interface GymAchievementPayload {
  id: string;
  emoji: string;
  title: string;
  description: string;
  unlocked: boolean;
  /** 0–100 menuju ambang (selalu 100 saat terbuka). */
  progressPct: number;
  /** Label progres ringkas, mis. "6 / 10 sesi". */
  progressLabel: string;
}

export interface GymTotalsPayload {
  /** Total sesi semua zona (own) sepanjang masa. */
  lifetimeSessions: number;
  fullBodySessions: number;
  /** Minggu (beda) dengan semua 6 zona tersentuh. */
  balancedWeeks: number;
  /** Rekor zona yang memenuhi target mingguan dalam satu minggu (maks 6). */
  perfectZonesBest: number;
  /** Streak zona terpanjang sepanjang masa. */
  longestZoneStreak: number;
}

// ── Utilitas minggu/hari murni ──────────────────────────────────────────────

/** YMD awal minggu dari sebuah YMD (weekStartDow 0=Minggu, 1=Senin) — UTC murni. */
export function weekStartOfYmd(ymd: string, weekStartDow: number): string {
  const t = Date.parse(ymd + 'T00:00:00Z');
  if (Number.isNaN(t)) return ymd;
  const dow = new Date(t).getUTCDay();
  const diff = (dow - (weekStartDow === 0 ? 0 : 1) + 7) % 7;
  return new Date(t - diff * 86_400_000).toISOString().slice(0, 10);
}

function shiftYmdDays(ymd: string, days: number): string {
  const t = Date.parse(ymd + 'T00:00:00Z');
  if (Number.isNaN(t)) return ymd;
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

/** Hari berturut-turut terpanjang dari kumpulan YMD (PR zona). */
export function longestConsecutiveDays(ymds: string[]): number {
  const set = new Set(ymds);
  let best = 0;
  for (const ymd of set) {
    // Hanya mulai dari kepala run (hari sebelumnya tidak ada).
    if (set.has(shiftYmdDays(ymd, -1))) continue;
    let len = 1;
    let cur = ymd;
    while (set.has(shiftYmdDays(cur, 1))) {
      cur = shiftYmdDays(cur, 1);
      len += 1;
    }
    if (len > best) best = len;
  }
  return best;
}

// ── Komputasi riwayat V2 (server memanggil; murni, tanpa I/O) ───────────────

export interface GymHistoryInput {
  /** YMD sesi per zona (log habit zona sendiri — completed=true). */
  ymdsByZone: Partial<Record<MuscleZoneKey, string[]>>;
  /** 0=Minggu, 1=Senin (dari AppSettings — sama dengan jendela minggu V1). */
  weekStartDow: number;
  todayYmd: string;
}

export interface GymHistoryResult {
  historyWeeks: string[];
  zoneHistory: GymZoneHistoryPayload[];
  bestWeek: GymBestWeekPayload | null;
  achievements: GymAchievementPayload[];
  totals: GymTotalsPayload;
}

/**
 * Hitung seluruh lapisan V2 dari daftar YMD sesi:
 *  - sel heatmap 12 minggu per zona (efektif = own + kontribusi Full Body),
 *  - PR zona (rekor sesi/minggu + streak terpanjang),
 *  - minggu terbaik global, total, dan 10 pencapaian turunan.
 * Tidak menyentuh DB/XP/streak inti — murni turunan baca.
 */
export function computeGymHistory(input: GymHistoryInput): GymHistoryResult {
  const dow = input.weekStartDow === 0 ? 0 : 1;
  const currentWeek = weekStartOfYmd(input.todayYmd, dow);

  // Kolom 12 minggu terakhir (terlama → minggu berjalan).
  const historyWeeks: string[] = [];
  for (let i = GYM_HISTORY_WEEKS - 1; i >= 0; i -= 1) {
    historyWeeks.push(shiftYmdDays(currentWeek, -7 * i));
  }

  // Hitung sesi per minggu (SEMUA minggu sepanjang masa, bukan hanya 12
  // kolom — dipakai PR/minggu terbaik/pencapaian).
  const fbYmds = input.ymdsByZone.fullbody ?? [];
  const fbWeekly = new Map<string, number>();
  for (const ymd of fbYmds) {
    const ws = weekStartOfYmd(ymd, dow);
    fbWeekly.set(ws, (fbWeekly.get(ws) ?? 0) + 1);
  }

  const zoneWeekly = new Map<MuscleZoneKey, Map<string, number>>(); // efektif
  const zoneOwnWeekly = new Map<MuscleZoneKey, Map<string, number>>(); // own
  for (const def of MUSCLE_ZONE_DEFS) {
    const own = new Map<string, number>();
    for (const ymd of input.ymdsByZone[def.key] ?? []) {
      const ws = weekStartOfYmd(ymd, dow);
      own.set(ws, (own.get(ws) ?? 0) + 1);
    }
    zoneOwnWeekly.set(def.key, own);
    if (def.isMissionZone) {
      const eff = new Map<string, number>();
      for (const [ws, n] of own) eff.set(ws, n);
      for (const [ws, n] of fbWeekly) {
        eff.set(ws, (eff.get(ws) ?? 0) + n);
      }
      zoneWeekly.set(def.key, eff);
    } else {
      zoneWeekly.set(def.key, own);
    }
  }

  // Semua minggu yang pernah ada sesi (union).
  const allWeeks = new Set<string>();
  for (const m of zoneWeekly.values()) for (const ws of m.keys()) allWeeks.add(ws);
  const sortedWeeks = [...allWeeks].sort();

  // PR zona + sel heatmap.
  const zoneHistory: GymZoneHistoryPayload[] = MUSCLE_ZONE_DEFS.map((def) => {
    const eff = zoneWeekly.get(def.key)!;
    let bestSessions = 0;
    let bestWeekStart: string | null = null;
    for (const ws of sortedWeeks) {
      const n = eff.get(ws) ?? 0;
      if (n > bestSessions) {
        bestSessions = n;
        bestWeekStart = ws;
      } else if (n === bestSessions && n > 0) {
        bestWeekStart = ws; // seri → ambil yang terbaru
      }
    }
    return {
      key: def.key,
      label: def.label,
      cells: historyWeeks.map((ws) => ({ weekStartYmd: ws, sessions: eff.get(ws) ?? 0 })),
      bestWeekSessions: bestSessions,
      bestWeekStartYmd: bestWeekStart,
      longestStreakDays: longestConsecutiveDays(input.ymdsByZone[def.key] ?? []),
    };
  });

  // Minggu terbaik global + agregat pencapaian.
  let bestWeek: GymBestWeekPayload | null = null;
  let balancedWeeks = 0;
  let perfectZonesBest = 0;
  for (const ws of sortedWeeks) {
    let total = 0;
    let touched = 0;
    let metTarget = 0;
    for (const def of MISSION_ZONE_DEFS) {
      const n = zoneWeekly.get(def.key)!.get(ws) ?? 0;
      // Task 70 (audit 70-a m2): totalSessions dari sesi ASLI (own zona misi)
      // — dulu memakai peta efektif sehingga 1 sesi Full Body menambah 6 ke
      // total (1 fb = "7 sesi"). zonesTouched & metTarget tetap dari efektif
      // (fb memang menyentuh/menghitung semua zona misi).
      total += zoneOwnWeekly.get(def.key)!.get(ws) ?? 0;
      if (n >= 1) touched += 1;
      if (n >= def.weeklyTarget) metTarget += 1;
    }
    total += fbWeekly.get(ws) ?? 0;
    if (touched === MISSION_ZONE_DEFS.length && MISSION_ZONE_DEFS.length > 0) balancedWeeks += 1;
    if (metTarget > perfectZonesBest) perfectZonesBest = metTarget;
    if (
      !bestWeek ||
      total > bestWeek.totalSessions ||
      (total === bestWeek.totalSessions && touched > bestWeek.zonesTouched)
    ) {
      bestWeek = { weekStartYmd: ws, totalSessions: total, zonesTouched: touched };
    }
  }

  const lifetimeSessions = MUSCLE_ZONE_DEFS.reduce(
    (s, def) => s + (input.ymdsByZone[def.key] ?? []).length,
    0,
  );
  const longestZoneStreak = zoneHistory.reduce((m, z) => Math.max(m, z.longestStreakDays), 0);

  const totals: GymTotalsPayload = {
    lifetimeSessions,
    fullBodySessions: fbYmds.length,
    balancedWeeks,
    perfectZonesBest,
    longestZoneStreak,
  };

  // Pencapaian turunan (tanpa timestamp — state "terbuka" murni dari data).
  const achievements: GymAchievementPayload[] = GYM_ACHIEVEMENT_DEFS.map((def) => {
    const value =
      def.kind === 'total'
        ? lifetimeSessions
        : def.kind === 'fullbody'
          ? fbYmds.length
          : def.kind === 'balancedWeeks'
            ? balancedWeeks
            : def.kind === 'perfectZones'
              ? perfectZonesBest
              : longestZoneStreak;
    const unlocked = value >= def.threshold;
    const progressPct = Math.min(100, Math.round((value / def.threshold) * 100));
    const progressLabel =
      def.kind === 'fullbody'
        ? `${Math.min(value, def.threshold)} / ${def.threshold} sesi Full Body`
        : def.kind === 'balancedWeeks'
          ? `${Math.min(value, def.threshold)} / ${def.threshold} minggu seimbang`
          : def.kind === 'perfectZones'
            ? `${Math.min(value, def.threshold)} / ${def.threshold} zona target`
            : def.kind === 'longestZoneStreak'
              ? `${Math.min(value, def.threshold)} / ${def.threshold} hari`
              : `${Math.min(value, def.threshold)} / ${def.threshold} sesi`;
    return {
      id: def.id,
      emoji: def.emoji,
      title: def.title,
      description: def.description,
      unlocked,
      progressPct,
      progressLabel,
    };
  });

  return { historyWeeks, zoneHistory, bestWeek, achievements, totals };
}
