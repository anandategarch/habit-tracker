// ---------------------------------------------------------------------------
// src/lib/muscle-map-cardio.ts — KARDIO (Task 76, Bonus Gym Cerdas).
//
// Pustaka MURNI (tanpa I/O): definisi jenis kardio (jalan/lari/sepeda/renang),
// validasi input catatan (dipakai server & klien — aturan SAMA dua sisi, pola
// muscle-map-sets.ts), estimasi kcal berbasis MET, dan mesin payload (entri
// 30 hari + statistik minggu berjalan + jarak terjauh per jenis).
//
// kcal TIDAK disimpan di DB — selalu diturunkan saat payload:
//   kcal ≈ MET × berat(kg) × durasi(jam)
// berat diambil dari DailyLog.weightKg terbaru (synergy Fase 2); tanpa berat
// tercatat → DEFAULT_BODY_WEIGHT_KG (65) supaya estimasi tetap masuk akal.
//
// Prinsip arsitektur tetap: kardio MURNI LAPISAN CATAT — tidak menyentuh
// XP/streak/kalender HabitLog (Peta Otot "hanya membaca event").
// ---------------------------------------------------------------------------

// ── Batas input (server & klien memakai konstanta yang sama) ───────────────

/** Durasi satu sesi: 1–600 menit. */
export const CARDIO_DURATION_MIN = 1;
export const CARDIO_DURATION_MAX = 600;
/** Jarak satu sesi (opsional): 0,1–300 km. */
export const CARDIO_DISTANCE_MIN = 0.1;
export const CARDIO_DISTANCE_MAX = 300;
/** Jendela hari riwayat yang dikirim ke klien. */
export const CARDIO_HISTORY_DAYS = 30;
/** Berat dipakai bila DailyLog belum punya berat sama sekali. */
export const DEFAULT_BODY_WEIGHT_KG = 65;

// ── Jenis kardio ────────────────────────────────────────────────────────────

export const CARDIO_KINDS = ['walk', 'run', 'bike', 'swim'] as const;
export type GymCardioKind = (typeof CARDIO_KINDS)[number];

export interface GymCardioKindDef {
  key: GymCardioKind;
  label: string;
  emoji: string;
  /** Metabolic Equivalent of Task — kasar, cukup untuk estimasi. */
  met: number;
}

export const CARDIO_KIND_LIST: GymCardioKindDef[] = [
  { key: 'walk', label: 'Jalan', emoji: '🚶', met: 3.5 },
  { key: 'run', label: 'Lari', emoji: '🏃', met: 9.8 },
  { key: 'bike', label: 'Sepeda', emoji: '🚴', met: 7.5 },
  { key: 'swim', label: 'Renang', emoji: '🏊', met: 8.3 },
];

export const CARDIO_KIND_DEF_BY_KEY: Record<GymCardioKind, GymCardioKindDef> = Object.fromEntries(
  CARDIO_KIND_LIST.map((k) => [k.key, k]),
) as Record<GymCardioKind, GymCardioKindDef>;

// ── Tipe payload ────────────────────────────────────────────────────────────

/** Satu catatan sesi kardio (bentuk serialisasi klien). */
export interface GymCardioEntry {
  id: string;
  kind: GymCardioKind;
  durationMin: number;
  /** null = sesi tanpa jarak. */
  distanceKm: number | null;
  dayKey: string; // yyyy-MM-dd Jakarta
  createdAt: string;
  /** Estimasi kcal (MET × berat × jam) — dibulatkan ke atas, null tak mungkin. */
  kcal: number;
}

/** Ringkasan statistik minggu berjalan. */
export interface GymCardioWeekStat {
  sessions: number;
  totalMin: number;
  totalKm: number | null;
  totalKcal: number;
}

/** Jarak satu sesi terjauh per jenis (hanya jenis yang pernah ada jaraknya). */
export interface GymCardioBest {
  kind: GymCardioKind;
  distanceKm: number;
  durationMin: number;
  dayKey: string;
}

/** Payload GET /api/gym/cardio. */
export interface GymCardioPayload {
  todayYmd: string;
  /** Awal minggu berjalan sesuai pengaturan weekStart (0=Minggu, 1=Senin). */
  weekStartYmd: string;
  /** Riwayat CARDIO_HISTORY_DAYS hari terakhir (terbaru dulu). */
  entries: GymCardioEntry[];
  thisWeek: GymCardioWeekStat;
  /** Terjauh per jenis — urut jarak desc. */
  bests: GymCardioBest[];
  /** Berat terakhir DailyLog (null = belum pernah) — untuk estimasi klien. */
  weightKg: number | null;
}

// ── Validasi (dipakai server & klien — dua sisi aturan sama) ───────────────

export interface CardioInput {
  kind: string;
  durationMin: number;
  distanceKm: number | null;
}

export type CardioValidation =
  | { ok: true; kind: GymCardioKind; durationMin: number; distanceKm: number | null }
  | { ok: false; error: string };

/** Validasi satu sesi kardio. Jarak opsional (null sah), dibulatkan 0,1 km. */
export function validateCardioInput(input: CardioInput): CardioValidation {
  const kind = input.kind as GymCardioKind;
  if (!CARDIO_KIND_DEF_BY_KEY[kind]) {
    return { ok: false, error: 'Jenis kardio tidak dikenal' };
  }
  if (
    !Number.isFinite(input.durationMin) ||
    !Number.isInteger(input.durationMin) ||
    input.durationMin < CARDIO_DURATION_MIN ||
    input.durationMin > CARDIO_DURATION_MAX
  ) {
    return {
      ok: false,
      error: `Durasi harus bilangan bulat ${CARDIO_DURATION_MIN}–${CARDIO_DURATION_MAX} menit`,
    };
  }
  let distanceKm: number | null = null;
  if (input.distanceKm !== null && input.distanceKm !== undefined) {
    if (typeof input.distanceKm !== 'number' || !Number.isFinite(input.distanceKm)) {
      return { ok: false, error: 'Jarak harus berupa angka' };
    }
    const rounded = Math.round(input.distanceKm * 10) / 10;
    if (rounded < CARDIO_DISTANCE_MIN || rounded > CARDIO_DISTANCE_MAX) {
      return {
        ok: false,
        error: `Jarak harus ${CARDIO_DISTANCE_MIN}–${CARDIO_DISTANCE_MAX} km (boleh dikosongkan)`,
      };
    }
    distanceKm = rounded;
  }
  return { ok: true, kind, durationMin: input.durationMin, distanceKm };
}

// ── Estimasi & format (murni) ───────────────────────────────────────────────

/** kcal ≈ MET × berat × jam — berat null → DEFAULT_BODY_WEIGHT_KG. */
export function estimateCardioKcal(kind: GymCardioKind, durationMin: number, weightKg: number | null): number {
  const met = CARDIO_KIND_DEF_BY_KEY[kind]?.met ?? 5;
  const kg = weightKg ?? DEFAULT_BODY_WEIGHT_KG;
  return Math.round(met * kg * (durationMin / 60));
}

/** "25 mnt" / "1 j 5 mnt". */
export function formatCardioDuration(min: number): string {
  if (min < 60) return `${min} mnt`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} j` : `${h} j ${m} mnt`;
}

/** "4,2 km" (koma desimal Indonesia) — null → '—'. */
export function formatKm(km: number | null): string {
  if (km === null) return '—';
  return `${String(Math.round(km * 10) / 10).replace('.', ',')} km`;
}

/** Tempo menit per km sebagai "m:ss /km"; null bila tanpa jarak. */
export function formatPace(durationMin: number, distanceKm: number | null): string | null {
  if (distanceKm === null || distanceKm <= 0) return null;
  const paceMin = durationMin / distanceKm;
  const m = Math.floor(paceMin);
  const s = Math.round((paceMin - m) * 60);
  const mm = s === 60 ? m + 1 : m;
  const ss = s === 60 ? 0 : s;
  return `${mm}:${String(ss).padStart(2, '0')} /km`;
}

// ── Mesin payload (murni) ───────────────────────────────────────────────────

/** Baris mentah dari Prisma (subset kolom) — bentuk input builder. */
export interface GymCardioRowInput {
  id: string;
  kind: string;
  durationMin: number;
  distanceKm: number | null;
  dayKey: string;
  createdAt: Date | string;
}

/** Terbaru dulu: dayKey desc, tie-break createdAt desc. */
function byNewestFirst(a: GymCardioRowInput, b: GymCardioRowInput): number {
  if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? 1 : -1;
  const at = a.createdAt instanceof Date ? a.createdAt.getTime() : Date.parse(a.createdAt);
  const bt = b.createdAt instanceof Date ? b.createdAt.getTime() : Date.parse(b.createdAt);
  return at < bt ? 1 : at > bt ? -1 : 0;
}

function toEntry(row: GymCardioRowInput, weightKg: number | null): GymCardioEntry {
  const kind = (CARDIO_KINDS as readonly string[]).includes(row.kind) ? (row.kind as GymCardioKind) : 'walk';
  return {
    id: row.id,
    kind,
    durationMin: row.durationMin,
    distanceKm: row.distanceKm,
    dayKey: row.dayKey,
    createdAt: (row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)).toISOString(),
    kcal: estimateCardioKcal(kind, row.durationMin, weightKg),
  };
}

/**
 * Bentuk payload kardio. `rows` = SELURUH sesi (semua waktu) — jarak terjauh
 * per jenis dihitung sepanjang masa (PR-flavor), entri difilter 30 hari.
 */
export function buildCardioPayload(
  rows: GymCardioRowInput[],
  opts: { todayYmd: string; weekStartYmd: string; weightKg: number | null },
): GymCardioPayload {
  const sorted = [...rows].sort(byNewestFirst);
  const historyStart = dayShiftYmd(opts.todayYmd, -(CARDIO_HISTORY_DAYS - 1));

  const entries = sorted
    .filter((r) => r.dayKey >= historyStart && r.dayKey <= opts.todayYmd)
    .map((r) => toEntry(r, opts.weightKg));

  const weekRows = sorted.filter((r) => r.dayKey >= opts.weekStartYmd && r.dayKey <= opts.todayYmd);
  const weekKm = weekRows.reduce((s, r) => s + (r.distanceKm ?? 0), 0);
  const thisWeek: GymCardioWeekStat = {
    sessions: weekRows.length,
    totalMin: weekRows.reduce((s, r) => s + r.durationMin, 0),
    totalKm: weekRows.some((r) => r.distanceKm !== null) ? Math.round(weekKm * 10) / 10 : null,
    totalKcal: weekRows.reduce(
      (s, r) => s + estimateCardioKcal(r.kind as GymCardioKind, r.durationMin, opts.weightKg),
      0,
    ),
  };

  // Jarak satu sesi terjauh per jenis (tie → catatan terbaru menang).
  const bestByKind = new Map<GymCardioKind, GymCardioBest>();
  for (const r of sorted) {
    if (r.distanceKm === null || r.distanceKm === undefined) continue;
    const kind = (CARDIO_KINDS as readonly string[]).includes(r.kind) ? (r.kind as GymCardioKind) : null;
    if (!kind) continue;
    const cur = bestByKind.get(kind);
    if (!cur || r.distanceKm > cur.distanceKm) {
      bestByKind.set(kind, { kind, distanceKm: r.distanceKm, durationMin: r.durationMin, dayKey: r.dayKey });
    }
  }
  const bests = [...bestByKind.values()].sort((a, b) => b.distanceKm - a.distanceKm);

  return {
    todayYmd: opts.todayYmd,
    weekStartYmd: opts.weekStartYmd,
    entries,
    thisWeek,
    bests,
    weightKg: opts.weightKg,
  };
}

// ── Util kecil (murni — jangan impor lintas modul supaya tetap steril) ──────

/** Geser 'yyyy-MM-dd' sebanyak n hari (leksikografis aman). */
function dayShiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
