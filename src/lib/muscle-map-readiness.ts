// ---------------------------------------------------------------------------
// src/lib/muscle-map-readiness.ts — GYM CERDAS Fase 1 (Task 72): kesiapan
// latihan harian (readiness) turunan dari check-in harian DailyLog.
//
// Pustaka MURNI (tanpa I/O): skor kesiapan 0–100 dari tidur (50%), energi
// (35%), mood (15%) — bobot mengikuti konsensus sport-science sederhana
// (tidur = faktor pemulihan terbesar). Skor memetakan ke 4 tier + multiplier
// KECEPATAN PEMULIHAN zona (0.8–1.1) yang mengalir ke recoveryPct/zoneStatus
// (param opsional — default 1 = perilaku lama, kompatibel penuh).
//
// Sumber data: DailyLog TERBARU (hari ini, fallback kemarin). Tanpa baris →
// readiness null → UI menampilkan ajakan mengisi check-in (loop engagement).
//
// PRINSIP ARSITEKTUR (tetap): lapisan TURUNAN — tidak menambah kalkulasi XP,
// tidak menulis data apa pun. Dipakai server (api/gym GET → payload) dan
// klien (readiness-card, zone-focus-sheet, use-gym-screen-state) lewat
// barrel '@/lib/muscle-map'.
// ---------------------------------------------------------------------------

import { RECOVERY_READY_PCT, recoveryPct, type GymZonePayload, type MuscleZoneKey } from './muscle-map-zones';

// ── Input & payload ────────────────────────────────────────────────────────

/** Input check-in harian (skala DailyLog). */
export interface GymReadinessInput {
  /** Jam tidur semalam (DailyLog.sleep — 0..24, ideal 7–9). */
  sleep: number;
  /** Energi 1..5 (DailyLog.energy). */
  energy: number;
  /** Mood 1..5 (DailyLog.mood). */
  mood: number;
}

export type GymReadinessTier = 'prima' | 'siap' | 'cukup' | 'rendah';

/** Payload readiness di GymMapPayload (dibentuk server, dikonsumsi klien). */
export interface GymReadinessPayload {
  /** YMD baris DailyLog yang jadi dasar (hari ini / kemarin). */
  sourceYmd: string;
  /** true bila sumbernya check-in HARI INI (bukan fallback kemarin). */
  isToday: boolean;
  /** Nilai mentah check-in (untuk rincian chip di UI). */
  sleep: number;
  energy: number;
  mood: number;
  /** Skor kesiapan 0–100 (tidur 50% + energi 35% + mood 15%). */
  score: number;
  tier: GymReadinessTier;
  /** Multiplier kecepatan pemulihan otot (0.8–1.1; 1 = normal). */
  recoveryFactor: number;
}

// ── Tier meta (label, warna, copy Indonesia — nada senada gym) ─────────────

export interface ReadinessTierMeta {
  label: string;
  emoji: string;
  color: string;
  headline: string;
  body: string;
}

export const READINESS_TIER_META: Record<GymReadinessTier, ReadinessTierMeta> = {
  prima: {
    label: 'Prima',
    emoji: '🌟',
    color: '#64e59b',
    headline: 'Badanmu prima hari ini',
    body: 'Tidur & energi mantap — waktu tepat untuk push lebih keras atau naik level.',
  },
  siap: {
    label: 'Siap',
    emoji: '✅',
    color: '#13d8bc',
    headline: 'Kamu siap latihan',
    body: 'Kondisi cukup baik untuk sesi normal. Jaga ritme, jangan dipaksa.',
  },
  cukup: {
    label: 'Cukup',
    emoji: '⚠️',
    color: '#f49b25',
    headline: 'Cukup — dengarkan tubuhmu',
    body: 'Energi atau tidur kurang optimal. Pilih sesi ringan atau durasi lebih pendek.',
  },
  rendah: {
    label: 'Rendah',
    emoji: '😴',
    color: '#d65c81',
    headline: 'Tubuhmu butuh istirahat',
    body: 'Recovery jadi prioritas: gerak ringan, stretching, atau tidur lebih awal.',
  },
};

// ── Konstanta model ─────────────────────────────────────────────────────────

/** Bobot komposit kesiapan (tidur = faktor pemulihan terbesar). */
export const READINESS_WEIGHTS = { sleep: 0.5, energy: 0.35, mood: 0.15 } as const;

/** Ambang tier (skor 0–100). */
export const READINESS_TIER_BOUNDS = {
  prima: 85,
  siap: 70,
  cukup: 50,
} as const;

/** Rentang multiplier kecepatan pemulihan (0.8 = 20% lebih lambat, 1.1 = 10% lebih cepat). */
export const RECOVERY_FACTOR_MIN = 0.8;
export const RECOVERY_FACTOR_MAX = 1.1;

/** Skor netral (check-in default 3/3/7) menghasilkan multiplier ~1.0. */
export const NEUTRAL_SCORE = 67;

// ── Skor komponen (murni, di-clamp 20–100 supaya tidak pernah nol total) ────

/** Skor tidur: ideal 8 jam, tiap jam menyimpang −15 poin (7h→85, 6h→70, 5h→55). */
export function sleepScore(sleep: number): number {
  const s = Number.isFinite(sleep) ? sleep : 8;
  const clamped = Math.max(0, Math.min(24, s));
  return Math.max(20, Math.min(100, Math.round(100 - Math.abs(clamped - 8) * 15)));
}

/** Skor skala 1–5 (energi/mood): 1→20, 3→60, 5→100. */
export function fiveScaleScore(value: number): number {
  const v = Number.isFinite(value) ? value : 3;
  const clamped = Math.max(1, Math.min(5, v));
  return Math.round((clamped - 1) / 4 * 80 + 20);
}

/** Hitung readiness lengkap dari input check-in (murni — tanpa I/O). */
export function computeReadiness(
  input: GymReadinessInput,
  sourceYmd: string,
  isToday: boolean,
): GymReadinessPayload {
  const sScore = sleepScore(input.sleep);
  const eScore = fiveScaleScore(input.energy);
  const mScore = fiveScaleScore(input.mood);
  const composite =
    sScore * READINESS_WEIGHTS.sleep +
    eScore * READINESS_WEIGHTS.energy +
    mScore * READINESS_WEIGHTS.mood;
  const score = Math.max(0, Math.min(100, Math.round(composite)));
  const tier: GymReadinessTier =
    score >= READINESS_TIER_BOUNDS.prima
      ? 'prima'
      : score >= READINESS_TIER_BOUNDS.siap
        ? 'siap'
        : score >= READINESS_TIER_BOUNDS.cukup
          ? 'cukup'
          : 'rendah';
  const raw = RECOVERY_FACTOR_MIN + (score / 100) * (RECOVERY_FACTOR_MAX - RECOVERY_FACTOR_MIN);
  const recoveryFactor = Math.round(raw * 1000) / 1000; // 3 desimal, clamp by rentang
  return {
    sourceYmd,
    isToday,
    sleep: input.sleep,
    energy: input.energy,
    mood: input.mood,
    score,
    tier,
    recoveryFactor,
  };
}

// ── Copy efek pemulihan ─────────────────────────────────────────────────────

/** Efek multiplier terhadap pemulihan otot (ringkas, untuk card & sheet). */
export function recoverySpeedText(recoveryFactor: number): string {
  const delta = Math.round((recoveryFactor - 1) * 100);
  if (delta >= 5) return `Pemulihan otot ${delta}% lebih cepat — tidur berkualitas 🚀`;
  if (delta <= -5) return `Pemulihan otot ${Math.abs(delta)}% lebih lambat — tidur kurang 🐢`;
  return 'Pemulihan otot berjalan normal';
}

// ── Mesin saran zona hari ini ───────────────────────────────────────────────

export interface GymZoneSuggestion {
  key: MuscleZoneKey;
  label: string;
  emoji: string;
  color: string;
  /** Alasan singkat Indonesia ("2 sesi lagi menuju target"). */
  reason: string;
}

/** Saran zona latihan hari ini — zona misi yang:
 *  * belum selesai hari ini,
 *  * belum mencapai target minggu,
 *  * recovery ≥ ambang siap (atau belum pernah dilatih),
 *  * dan tidak sedang pump.
 *  Urut: defisit target terbesar → recovery tertinggi → urutan definisi.
 *  Tier rendah → maks 2 zona (mode ringan); lainnya maks 3. Murni turunan. */
export function suggestZonesForToday(
  zones: GymZonePayload[],
  tier: GymReadinessTier,
  nowMs: number,
  todayYmd: string,
  recoveryFactor: number,
): GymZoneSuggestion[] {
  const candidates = zones.filter((z) => {
    if (z.doneToday) return false;
    if (z.sessionsThisWeek >= z.weeklyTarget) return false;
    const rec = recoveryPct(z, nowMs, recoveryFactor);
    if (rec !== null && rec < RECOVERY_READY_PCT) return false; // masih pemulihan
    if (z.lastSessionAt) {
      // pump window 2 jam — baru selesai, jangan disarankan.
      const t = Date.parse(z.lastSessionAt);
      if (!Number.isNaN(t) && nowMs - t <= 2 * 60 * 60 * 1000) return false;
    }
    return true;
  });
  const deficit = (z: GymZonePayload) => Math.max(0, z.weeklyTarget - z.sessionsThisWeek);
  const recOf = (z: GymZonePayload) => recoveryPct(z, nowMs, recoveryFactor) ?? 0;
  candidates.sort((a, b) => deficit(b) - deficit(a) || recOf(b) - recOf(a));
  const limit = tier === 'rendah' ? 2 : 3;
  return candidates.slice(0, limit).map((z) => {
    const d = deficit(z);
    const rec = recOf(z);
    const reason =
      d >= 2
        ? `${d} sesi lagi menuju target`
        : d === 1
          ? '1 sesi lagi menuju target'
          : rec >= 100
            ? 'recovery penuh — siap dilatih'
            : 'belum dilatih — mulai pelan';
    return { key: z.key, label: z.label, emoji: z.emoji, color: z.color, reason };
  });
}

/** Headline seksi saran menurut tier (mode ringan saat rendah). */
export function suggestionHeadline(tier: GymReadinessTier): string {
  return tier === 'rendah'
    ? 'Saran Hari Ini — Mode Ringan'
    : tier === 'cukup'
      ? 'Saran Hari Ini — Jangan Dipaksa'
      : 'Saran Hari Ini';
}
