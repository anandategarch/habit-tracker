// ---------------------------------------------------------------------------
// src/lib/muscle-map.ts — MUSCLE ENGINE (Task 64: Peta Otot / Gym di Rumah)
//
// Pustaka MURNI (tanpa I/O) untuk fitur workout: definisi zona otot, mesin
// status zona, skor recovery, balance score, kurva definisi seumur hidup,
// dan pustaka gerakan preset (tanpa alat). Dipakai bersama oleh:
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

// ── Payload API (dibentuk server, dikonsumsi klien) ────────────────────────

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

export interface GymMapPayload {
  todayYmd: string;
  weekStartYmd: string;
  /** true bila SEMUA habit zona (7) sudah terpasang & aktif. */
  setupDone: boolean;
  /** 6 zona utama (urutan def) — tanpa Full Body. */
  zones: GymZonePayload[];
  fullBody: GymZonePayload | null;
  mission: GymMissionPayload;
  /** 0–100 — seberapa merata distribusi latihan minggu ini (desain user #4). */
  balanceScore: number;
  // ── V2 (Task 65) — lapisan turunan riwayat/pencapaian ──
  /** 12 YMD awal minggu kolom heatmap (terlama → minggu berjalan). */
  historyWeeks: string[];
  /** Riwayat + PR per zona (7 — termasuk Full Body). */
  zoneHistory: GymZoneHistoryPayload[];
  /** Minggu terbaik sepanjang masa (null bila belum ada sesi). */
  bestWeek: GymBestWeekPayload | null;
  /** 10 pencapaian gym turunan. */
  achievements: GymAchievementPayload[];
  totals: GymTotalsPayload;
  // ── Task 67 — latihan kustom per zona (CRUD fleksibel) ──
  /** Latihan kustom HANYA untuk zona yang dikustomisasi (ada baris
   *  GymExerciseList). Zona tanpa entri → preset ZONE_EXERCISE_PRESETS. */
  exercisesByZone: Partial<Record<MuscleZoneKey, GymExerciseItem[]>>;
  /** Zona yang daftar latihannya dikustomisasi user (bisa kosong daftarnya!). */
  customizedZones: MuscleZoneKey[];
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

// ── Visual "samar-samar" (opasitas dari aset panel 04) ─────────────────────

export const STATUS_BASE_OPACITY: Record<MuscleZoneStatus, number> = {
  idle: 0.07,
  active: 0.18,
  pump: 0.29,
  recovery: 0.15,
  neglected: 0.07,
  balanced: 0.19,
};

/** Definisi seumur hidup: kurva akar (awal terasa, lalu landai — persis
 *  filosofi level pohon), TIDAK PERNAH reset, puncak 100 pada ~70 sesi. */
export function lifetimeDefinitionPct(lifetimeSessions: number): number {
  if (!Number.isFinite(lifetimeSessions) || lifetimeSessions <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(Math.sqrt(lifetimeSessions) * 12)));
}

/** Bonus opasitas dari definisi seumur hidup — MAKSIMUM tetap "samar". */
export function zoneVisualOpacity(status: MuscleZoneStatus, lifetimeSessions: number): number {
  const base = STATUS_BASE_OPACITY[status];
  const bonus = (lifetimeDefinitionPct(lifetimeSessions) / 100) * 0.1; // maks +0.10
  return Math.min(0.34, base + bonus);
}

/** Warna isian zona menurut status (idle/neglected diganti warna status). */
export function zoneVisualFill(status: MuscleZoneStatus, zoneColor: string): string {
  if (status === 'idle') return '#7a8893';
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

// ── Pustaka gerakan preset (tanpa alat — workout di rumah) ─────────────────

/** Satuan jumlah per set (Task 67 — gerakan kustom user). */
export const GYM_EXERCISE_UNITS = [
  'reps',
  'taps',
  'detik',
  'menit',
  'putaran',
  'reps / sisi',
  'reps / kaki',
] as const;
export type GymExerciseUnit = (typeof GYM_EXERCISE_UNITS)[number];

/** Satu gerakan latihan — struktur BERSAMA preset & kustom (Task 67). */
export interface GymExerciseItem {
  /** Nama gerakan, mis. "Push Up", "Shoulder Tap Plank". */
  name: string;
  /** Jumlah set (1–20). */
  sets: number;
  /** Jumlah per set — maknanya mengikuti satuan (1–9999). */
  amount: number;
  unit: GymExerciseUnit;
}

/** String tampilan standar: "3 set × 12 reps", "3 set × 20 detik",
 *  "1 putaran" (kasus sirkuit tanpa multi-set). */
export function exerciseDisplay(ex: Pick<GymExerciseItem, 'sets' | 'amount' | 'unit'>): string {
  if (ex.unit === 'putaran' && ex.sets <= 1) return `${ex.amount} putaran`;
  return `${ex.sets} set × ${ex.amount} ${ex.unit}`;
}

export interface ZoneExercisePreset extends GymExerciseItem {
  /** Kontribusi zona (aset 10) — chip informatif, belum dipakai kalkulasi (V3). */
  mapping?: { label: string; pct: number }[];
}

export const ZONE_EXERCISE_PRESETS: Record<MuscleZoneKey, ZoneExercisePreset[]> = {
  dada: [
    { name: 'Push Up', sets: 3, amount: 12, unit: 'reps', mapping: [{ label: 'Dada', pct: 70 }, { label: 'Bahu', pct: 20 }, { label: 'Lengan', pct: 10 }] },
    { name: 'Incline Push Up', sets: 3, amount: 10, unit: 'reps' },
    { name: 'Diamond Push Up', sets: 2, amount: 8, unit: 'reps', mapping: [{ label: 'Dada', pct: 50 }, { label: 'Lengan', pct: 40 }, { label: 'Bahu', pct: 10 }] },
    { name: 'Chest Press (Tanpa Alat)', sets: 3, amount: 15, unit: 'reps' },
  ],
  punggung: [
    { name: 'Superman', sets: 3, amount: 12, unit: 'reps' },
    { name: 'Bird Dog', sets: 3, amount: 10, unit: 'reps / sisi' },
    { name: 'Pull-Up (jika ada bar)', sets: 3, amount: 6, unit: 'reps' },
    { name: 'Backpack Row', sets: 3, amount: 10, unit: 'reps' },
  ],
  bahu: [
    { name: 'Pike Push Up', sets: 3, amount: 8, unit: 'reps' },
    { name: 'Shoulder Tap Plank', sets: 3, amount: 16, unit: 'taps' },
    { name: 'Lateral Raise (botol air)', sets: 3, amount: 12, unit: 'reps' },
    { name: 'Wall Handstand Hold', sets: 3, amount: 20, unit: 'detik' },
  ],
  lengan: [
    { name: 'Bench Dip (kursi)', sets: 3, amount: 12, unit: 'reps' },
    { name: 'Diamond Push Up', sets: 3, amount: 8, unit: 'reps' },
    { name: 'Biceps Curl (ransel)', sets: 3, amount: 12, unit: 'reps' },
    { name: 'Close-Grip Push Up', sets: 3, amount: 10, unit: 'reps' },
  ],
  perut: [
    { name: 'Plank', sets: 3, amount: 40, unit: 'detik', mapping: [{ label: 'Perut', pct: 80 }, { label: 'Bahu', pct: 10 }, { label: 'Lengan', pct: 10 }] },
    { name: 'Crunch', sets: 3, amount: 15, unit: 'reps' },
    { name: 'Leg Raise', sets: 3, amount: 12, unit: 'reps' },
    { name: 'Mountain Climber', sets: 3, amount: 20, unit: 'reps' },
  ],
  kaki: [
    { name: 'Squat', sets: 3, amount: 15, unit: 'reps', mapping: [{ label: 'Kaki', pct: 75 }, { label: 'Perut', pct: 15 }, { label: 'Punggung', pct: 10 }] },
    { name: 'Lunge', sets: 3, amount: 12, unit: 'reps / kaki' },
    { name: 'Calf Raise', sets: 3, amount: 20, unit: 'reps' },
    { name: 'Wall Sit', sets: 3, amount: 30, unit: 'detik' },
  ],
  fullbody: [
    { name: 'Burpee', sets: 3, amount: 10, unit: 'reps' },
    { name: 'Jumping Jack', sets: 3, amount: 30, unit: 'reps' },
    { name: 'High Knees', sets: 3, amount: 30, unit: 'detik' },
    { name: 'Sirkuit Full Body 20 Menit', sets: 1, amount: 1, unit: 'putaran' },
  ],
};

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

// ─────────────────────────────────────────────────────────────────────────────
// V2 (Task 65) — LAPISAN TURUNAN KEDUA: riwayat mingguan, minggu terbaik,
// PR zona, dan pencapaian gym. Tetap MURNI MEMBACA event (HabitLog zona):
// tidak ada tabel/kolom/state baru — semua dihitung dari daftar YMD sesi.
// ─────────────────────────────────────────────────────────────────────────────

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
  /** Total sesi efektif semua zona minggu itu. */
  totalSessions: number;
  /** Berapa zona utama tersentuh minggu itu. */
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
      total += n;
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
