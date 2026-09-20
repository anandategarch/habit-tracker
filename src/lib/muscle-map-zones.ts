// ---------------------------------------------------------------------------
// src/lib/muscle-map-zones.ts — definisi zona + mesin status zona (Task 64).
//
// Pustaka MURNI (tanpa I/O): definisi 6 zona otot + Full Body (label, warna,
// target mingguan), konstanta & fungsi mesin status (pump/recovery/balanced/
// active/neglected/idle), semantik visual Opsi A (Task 69 — badan charcoal,
// zona menyala), balance score, dan narasi/copy Indonesia.
//
// Dipakai bersama lewat barrel '@/lib/muscle-map' oleh:
//   * Server: src/app/api/gym/route.ts (GET status + POST setup)
//   * Klien : src/components/gym/* (derivasi status tampilan)
//
// PRINSIP ARSITEKTUR (desain user Task 63/64 — "Peta Otot hanya MEMBACA
// event"): XP, streak, kalender, dan KPI tetap mengalir lewat mekanisme
// HabitLog habit zona (pipa lama). Modul ini TIDAK menambah kalkulasi XP
// baru — semua fungsi di sini adalah LAPISAN TURUNAN atas data habit.
//
// Dua lapis waktu (senada pohon musim mingguan Task 62):
//   * Minggu berjalan (reset Senin Jakarta) → status/aktivitas zona.
//   * Seumur hidup (tidak pernah reset)     → "definisi" visual lambat.
//
// Label & palet mengikuti aset desain user (upload/peta-otot/ panel 01-14).
// ---------------------------------------------------------------------------

export type MuscleZoneKey = 'dada' | 'punggung' | 'bahu' | 'lengan' | 'perut' | 'kaki' | 'fullbody';

export interface MuscleZoneDef {
  key: MuscleZoneKey;
  /** Label tampilan (bahasa Indonesia). */
  label: string;
  emoji: string;
  /** Warna dasar zona (dari aset desain user, panel 01/13). */
  color: string;
  /** Target sesi per minggu (aset panel 01: Dada 3x, Kaki 3x, lainnya 2x). */
  weeklyTarget: number;
  /** Zona misi "Balanced Week" — Full Body adalah PRESET, bukan zona misi. */
  isMissionZone: boolean;
  /** Nama habit yang dibuat oleh setup. */
  habitName: string;
}

/** 6 zona utama + Full Body (preset). Urutan = urutan tampilan (aset 01/11). */
export const MUSCLE_ZONE_DEFS: MuscleZoneDef[] = [
  { key: 'dada',     label: 'Dada',     emoji: '💪', color: '#ef4e44', weeklyTarget: 3, isMissionZone: true,  habitName: 'Latihan Dada' },
  { key: 'punggung', label: 'Punggung', emoji: '🏋️', color: '#218eff', weeklyTarget: 2, isMissionZone: true,  habitName: 'Latihan Punggung' },
  { key: 'bahu',     label: 'Bahu',     emoji: '🤸', color: '#f49b25', weeklyTarget: 2, isMissionZone: true,  habitName: 'Latihan Bahu' },
  { key: 'lengan',   label: 'Lengan',   emoji: '🦾', color: '#ffd127', weeklyTarget: 2, isMissionZone: true,  habitName: 'Latihan Lengan' },
  { key: 'perut',    label: 'Perut',    emoji: '🧘', color: '#5ddd93', weeklyTarget: 2, isMissionZone: true,  habitName: 'Latihan Perut' },
  { key: 'kaki',     label: 'Kaki',     emoji: '🦵', color: '#2095ff', weeklyTarget: 3, isMissionZone: true,  habitName: 'Latihan Kaki' },
  { key: 'fullbody', label: 'Full Body', emoji: '🏃', color: '#8256e8', weeklyTarget: 1, isMissionZone: false, habitName: 'Latihan Full Body' },
];

export const MUSCLE_ZONE_DEF_BY_KEY: Record<MuscleZoneKey, MuscleZoneDef> = MUSCLE_ZONE_DEFS.reduce(
  (acc, def) => {
    acc[def.key] = def;
    return acc;
  },
  {} as Record<MuscleZoneKey, MuscleZoneDef>,
);

/** Zona misi Balanced Week (6 zona utama — tanpa Full Body). */
export const MISSION_ZONE_DEFS = MUSCLE_ZONE_DEFS.filter((d) => d.isMissionZone);

// ── Konstanta mesin status ─────────────────────────────────────────────────

/** Jendela "pump" — zona yang barusan diselesaikan (glow + scale). */
export const PUMP_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 jam
/** Zona dianggap "Terabaikan" bila >14 hari tanpa sesi (dari aset 04 + diskusi). */
export const NEGLECT_AFTER_DAYS = 14;
/** Recovery dianggap selesai pada ambang ini (status kembali "siap"). */
export const RECOVERY_READY_PCT = 90;

/** Kebutuhan pemulihan per intensitas (difficulty habit) — jam. */
export function recoveryHoursFor(difficulty: string): number {
  switch (difficulty) {
    case 'Easy':
    case 'Mudah':
      return 24;
    case 'Hard':
    case 'Sulit':
      return 72;
    default:
      return 48;
  }
}

/** Puncak pump per intensitas (aset 05: Normal 1.04, Hard 1.06). */
export function pumpPeakFor(difficulty: string): number {
  switch (difficulty) {
    case 'Hard':
    case 'Sulit':
      return 1.06;
    default:
      return 1.04;
  }
}

// ── Payload API zona (dibentuk server, dikonsumsi klien) ───────────────────

export interface GymZonePayload {
  key: MuscleZoneKey;
  label: string;
  emoji: string;
  color: string;
  /** null = habit zona belum dibuat (setup belum jalan / zona diarsip). */
  habitId: string | null;
  habitName: string | null;
  /** Difficulty habit zona (bilingual: 'Medium'/'Sedang'/...). */
  difficulty: string;
  weeklyTarget: number;
  /** Sesi sendiri minggu ini (log habit zona sendiri). */
  ownSessionsThisWeek: number;
  /** Sesi Full Body minggu ini yang ikut "menyentuh" zona ini. */
  fullBodyContrib: number;
  /** Total sesi efektif = own + fullBodyContrib. */
  sessionsThisWeek: number;
  /** YMD sesi minggu ini (untukan dot heatmap mingguan). */
  logYmdsThisWeek: string[];
  doneToday: boolean;
  /** Waktu selesai sesi terakhir (ISO Jakarta / UTC) — null bila belum pernah. */
  lastSessionAt: string | null;
  lastSessionYmd: string | null;
  /** Total sesi seumur hidup (habit zona sendiri). */
  lifetimeSessions: number;
  /** Streak zona (hari berturut-turut punya sesi zona — habit sendiri). */
  zoneStreak: number;
  /** XP dari sesi zona sendiri minggu ini (event XP = sesi × bobot difficulty). */
  weeklyZoneXp: number;
}

export interface GymMissionPayload {
  touched: number;
  total: number;
  balancedWeek: boolean;
}

// ── Mesin status zona (lapisan turunan, murni klien) ───────────────────────

export type MuscleZoneStatus = 'idle' | 'active' | 'pump' | 'recovery' | 'neglected' | 'balanced';

export interface ZoneStatusMeta {
  label: string;
  hint: string;
  /** Warna chip status (dari aset 04). */
  color: string;
}

export const ZONE_STATUS_META: Record<MuscleZoneStatus, ZoneStatusMeta> = {
  idle:      { label: 'Belum Dilatih',      hint: 'Samar, hampir tidak terlihat',        color: '#7a8893' },
  active:    { label: 'Dilatih Minggu Ini', hint: 'Mulai terlihat',                      color: '#ffae37' },
  pump:      { label: 'Baru Selesai',       hint: 'Membesar + glow lembut',              color: '#1c98ff' },
  recovery:  { label: 'Recovery',           hint: 'Sedikit redup, masih hangat',         color: '#ffb13a' },
  neglected: { label: 'Terabaikan',         hint: 'Kembali sangat samar',                color: '#d65c81' },
  balanced:  { label: 'Balanced',           hint: 'Sesuai target mingguan',              color: '#64e59b' },
};

/** Selisih hari antar dua YMD (b - a), aman UTC. */
export function ymdDaysBetween(aYmd: string, bYmd: string): number {
  const a = Date.parse(aYmd + 'T00:00:00Z');
  const b = Date.parse(bYmd + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Skor recovery zona (0–100). Basis waktu: completedAt bila ada, fallback
 *  tengah hari YMD terakhir (approx). null = belum pernah dilatih. */
export function recoveryPct(zone: GymZonePayload, nowMs: number): number | null {
  if (!zone.lastSessionAt && !zone.lastSessionYmd) return null;
  let sinceMs: number;
  if (zone.lastSessionAt) {
    const t = Date.parse(zone.lastSessionAt);
    sinceMs = Number.isNaN(t) ? 0 : Math.max(0, nowMs - t);
  } else {
    // fallback: tengah hari (12:00 UTC) dari YMD terakhir
    const t = Date.parse((zone.lastSessionYmd as string) + 'T12:00:00Z');
    sinceMs = Number.isNaN(t) ? 0 : Math.max(0, nowMs - t);
  }
  const needMs = recoveryHoursFor(zone.difficulty) * 3_600_000;
  return Math.max(0, Math.min(100, Math.round((sinceMs / needMs) * 100)));
}

/** Mesin status zona — prioritas:
 *  pump (≤2 jam) > recovery (<90%) > balanced (target tercapai) >
 *  active (tersentuh minggu ini) > neglected (>14 hari) > idle. */
export function zoneStatus(zone: GymZonePayload, nowMs: number, todayYmd: string): MuscleZoneStatus {
  const rec = recoveryPct(zone, nowMs);
  // Baru selesai → PUMP (menang atas semuanya — momen paling satisfying).
  if (rec !== null) {
    let sinceMs = 0;
    if (zone.lastSessionAt) {
      const t = Date.parse(zone.lastSessionAt);
      if (!Number.isNaN(t)) sinceMs = Math.max(0, nowMs - t);
    } else if (zone.lastSessionYmd) {
      const t = Date.parse(zone.lastSessionYmd + 'T12:00:00Z');
      if (!Number.isNaN(t)) sinceMs = Math.max(0, nowMs - t);
    }
    if (sinceMs <= PUMP_WINDOW_MS) return 'pump';
    if (rec < RECOVERY_READY_PCT) return 'recovery';
  }
  if (zone.weeklyTarget > 0 && zone.sessionsThisWeek >= zone.weeklyTarget) return 'balanced';
  if (zone.sessionsThisWeek >= 1) return 'active';
  if (zone.lastSessionYmd && ymdDaysBetween(zone.lastSessionYmd, todayYmd) > NEGLECT_AFTER_DAYS) {
    return 'neglected';
  }
  return 'idle';
}

// ── Visual zona (Task 69 — gaya Opsi A "GymWP/Fitness Point": badan gelap,
//   zona aktif MENYALA — referensi design-concepts/opsi-A-gymwp-style.png) ──

export const STATUS_BASE_OPACITY: Record<MuscleZoneStatus, number> = {
  /** Idle = menyatu dengan badan gelap (nyaris tak terlihat). */
  idle: 0.05,
  /** Aktif minggu ini = menyala jelas (blok warna terang ala app gym). */
  active: 0.62,
  /** Baru selesai = paling terang + glow (aset 05, intensifikasi Opsi A). */
  pump: 0.72,
  /** Recovery = tetap terlihat hangat, sedikit lebih redup. */
  recovery: 0.45,
  /** Terabaikan = sisa pudar keunguan (0.36 — tetap samar tapi terbaca;
      audit 70-e: 0.28 kontrasnya terlalu lemah di badan gelap). */
  neglected: 0.36,
  /** Balanced = menyala + glow hijau (aset 04). */
  balanced: 0.60,
};

/** Definisi seumur hidup: kurva akar (awal terasa, lalu landai — persis
 *  filosofi level pohon), TIDAK PERNAH reset, puncak 100 pada ~70 sesi. */
export function lifetimeDefinitionPct(lifetimeSessions: number): number {
  if (!Number.isFinite(lifetimeSessions) || lifetimeSessions <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(Math.sqrt(lifetimeSessions) * 12)));
}

/** Bonus opasitas dari definisi seumur hidup — zona "berotot" sedikit lebih
 *  pekat secara permanen (maks +0.10, dipotong cap menyala). */
export function zoneVisualOpacity(status: MuscleZoneStatus, lifetimeSessions: number): number {
  const base = STATUS_BASE_OPACITY[status];
  const bonus = (lifetimeDefinitionPct(lifetimeSessions) / 100) * 0.1; // maks +0.10
  return Math.min(0.78, base + bonus);
}

/** Warna isian zona menurut status (idle menyatu badan gelap; neglected
 *  pudar keunguan; lainnya warna zona penuh — menyala di badan gelap). */
export function zoneVisualFill(status: MuscleZoneStatus, zoneColor: string): string {
  if (status === 'idle') return '#3c4550';
  if (status === 'neglected') return '#d65c81';
  return zoneColor;
}

// ── Balance score & misi mingguan (desain user #4 + aset 11) ───────────────

/** Balance = 60% cakupan zona tersentuh + 40% keserataan distribusi sesi. */
export function computeBalanceScore(mainZones: GymZonePayload[]): number {
  const n = mainZones.length;
  if (n === 0) return 0;
  const touched = mainZones.filter((z) => z.sessionsThisWeek >= 1).length;
  const coverage = touched / n;
  const total = mainZones.reduce((s, z) => s + z.sessionsThisWeek, 0);
  if (total <= 0) return 0;
  const share = mainZones.map((z) => z.sessionsThisWeek / total);
  const ideal = 1 / n;
  const deviation = share.reduce((s, p) => s + Math.abs(p - ideal), 0);
  const maxDeviation = 2 * (1 - ideal); // semua sesi menumpuk di 1 zona
  const evenness = Math.max(0, Math.min(1, 1 - deviation / maxDeviation));
  return Math.round(coverage * 60 + evenness * 40);
}

// ── Narasi status (copy Indonesia, nada "training definition") ─────────────

/** Disclaimer aset user (#"jangan kesan pengukuran fisik tubuh nyata"). */
export const MUSCLE_MAP_DISCLAIMER =
  'Peta otot adalah representasi semangat latihanmu — bukan pengukuran tubuh.';

/** Tagline banner aset user (panel 14). */
export const GYM_TAGLINE = 'Tubuh yang lebih kuat dimulai dari kebiasaan kecil.';

/** Rekomendasi latihan berdasar status zona (aset 03 + desain #2). */
export function zoneRecommendation(
  zone: GymZonePayload,
  status: MuscleZoneStatus,
  nowMs: number,
): string {
  switch (status) {
    case 'pump':
      return `Zona ${zone.label} baru selesai — pump masih menyala. Istirahatkan dulu.`;
    case 'recovery':
      return `${zone.label} masih recovery (${recoveryPctLabel(recoveryPct(zone, nowMs))}). Latih zona lain hari ini.`;
    case 'balanced':
      return `Target mingguan ${zone.label} tercapai — ${zone.label} bercahaya seimbang. Pertahankan!`;
    case 'active':
      return `${zone.label} sudah tersentuh minggu ini. ${Math.max(0, zone.weeklyTarget - zone.sessionsThisWeek)} sesi lagi menuju target.`;
    case 'neglected':
      return `${zone.label} sudah lama tidak disentuh — mulai dari sesi ringan.`;
    default:
      return `${zone.label} belum dilatih minggu ini. Waktunya memulai!`;
  }
}

/** Label "N% pulih" (desain #2) — pct dari recoveryPct(). */
export function recoveryPctLabel(pct: number | null): string {
  return pct === null ? 'Belum dilatih' : `${pct}% pulih`;
}
