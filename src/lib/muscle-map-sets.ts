// ---------------------------------------------------------------------------
// src/lib/muscle-map-sets.ts — JURNAL SET & PR (Task 74, Fase 3 Gym Cerdas).
//
// Pustaka MURNI (tanpa I/O): tipe payload jurnal set, validasi input catatan
// (dipakai server & klien — aturan SAMA dua sisi), normalisasi nama gerakan
// (nameKey), dan mesin PR (personal record) per gerakan.
//
// Definisi PR (gaya Hevy/Strong-lite, disederhanakan untuk workout rumah):
//   * Satu "set terkuat" = amount tertinggi dalam SATU set untuk kombinasi
//     (zona, gerakan, satuan). PR hanya berpindah bila amount baru LEBIH BESAR
//     (strict >) dari semua catatan lain — menyamai rekor lama bukan PR baru.
//   * Satuan ikut memisahkan dimensi: "Push Up 20 reps" dan "Push Up 45
//     detik" adalah dua rekor berbeda (beda satuan tak dibandingkan).
//   * Mencatat ulang gerakan sama di hari sama = KOREKSI (upsert unique
//     zone+nameKey+dayKey) — PR dihitung MENGECUALI baris yang sedang
//     dikoreksi supaya menurunkan angka tidak salah dikira "belum pernah".
//
// Prinsip arsitektur tetap: jurnal set MURNI LAPISAN CATAT — tidak
// menyentuh XP/streak/kalender HabitLog (Peta Otot "hanya membaca event").
// ---------------------------------------------------------------------------

import { GYM_EXERCISE_UNITS, type GymExerciseUnit } from './muscle-map-exercises';
import { MUSCLE_ZONE_DEF_BY_KEY, type MuscleZoneKey } from './muscle-map-zones';

// ── Batas input (server & klien memakai konstanta yang sama) ───────────────

/** Jumlah set per catatan: 1–50. */
export const SET_LOG_SETS_MIN = 1;
export const SET_LOG_SETS_MAX = 50;
/** Jumlah per set: 1–9999 (reps/taps/detik/menit/putaran). */
export const SET_LOG_AMOUNT_MIN = 1;
export const SET_LOG_AMOUNT_MAX = 9999;
/** Panjang nama gerakan (sama dengan editor latihan Task 67). */
export const SET_LOG_NAME_MAX = 60;
/** Jendela hari riwayat yang dikirim ke klien per zona. */
export const SET_LOG_HISTORY_DAYS = 30;
/** Maksimum entri PR yang dikirim per zona (urut rekor terkuat). */
export const SET_LOG_PR_MAX = 12;

// ── Tipe ───────────────────────────────────────────────────────────────────

/** Satu catatan jurnal set (bentuk serialisasi klien). */
export interface GymSetLogRow {
  id: string;
  zone: MuscleZoneKey;
  nameKey: string;
  exercise: string;
  sets: number;
  amount: number;
  unit: GymExerciseUnit;
  dayKey: string; // yyyy-MM-dd Jakarta
  /** ISO waktu dicatat (tie-break urutan antar-catatan sehari). */
  createdAt: string;
}

/** PR satu gerakan (per satuan) — turunan murni dari seluruh riwayat. */
export interface GymExercisePr {
  /** nameKey gerakan (untuk pasangan dengan baris daftar latihan). */
  nameKey: string;
  /** Nama tampilan dari catatan PR (terbaru). */
  exercise: string;
  unit: GymExerciseUnit;
  /** Amount terkuat dalam satu set. */
  bestAmount: number;
  /** Set dari catatan rekor (konteks "3 set × 15 reps"). */
  bestSets: number;
  /** Hari rekor dipecah (tie amount sama → catatan TERBARU menang). */
  bestDayKey: string;
  /** Total catatan gerakan ini (semua satuan digabung). */
  totalLogs: number;
}

/** Payload GET /api/gym/sets?zone=… */
export interface GymZoneSetsPayload {
  zone: MuscleZoneKey;
  todayYmd: string;
  /** Riwayat SET_LOG_HISTORY_DAYS hari terakhir (terbaru dulu). */
  logs: GymSetLogRow[];
  /** PR per (nameKey, unit) — urut bestAmount desc, maks SET_LOG_PR_MAX. */
  prs: GymExercisePr[];
}

/** Hasil POST /api/gym/sets — info perayaan PR untuk klien. */
export interface GymSetSaveResult {
  log: GymSetLogRow;
  /** true bila amount > semua catatan lain gerakan+satuan ini (PR baru). */
  isPr: boolean;
  /** Rekor sebelumnya (null = gerakan ini belum pernah dicatat). */
  prevBestAmount: number | null;
}

// ── Normalisasi nama ───────────────────────────────────────────────────────

/** Kunci gerakan: trim + spasi tunggal + lowercase — pengelompokan PR
 *  case-insensitive ("Push Up" ≡ "push up"). */
export function exerciseNameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

// ── Validasi (dipakai server & klien — dua sisi aturan sama) ───────────────

export interface SetLogInput {
  zone: string;
  exercise: string;
  sets: number;
  amount: number;
  unit: string;
}

/** Hasil validasi: nilai bersih atau pesan error Indonesia. */
export type SetLogValidation =
  | { ok: true; zone: MuscleZoneKey; exercise: string; nameKey: string; sets: number; amount: number; unit: GymExerciseUnit }
  | { ok: false; error: string };

/** Validasi satu catatan set. Angka desimal/negative ditolak eksplisit. */
export function validateSetLogInput(input: SetLogInput): SetLogValidation {
  const zone = input.zone;
  if (!MUSCLE_ZONE_DEF_BY_KEY[zone as MuscleZoneKey]) {
    return { ok: false, error: 'Zona otot tidak dikenal' };
  }
  const exercise = String(input.exercise ?? '').trim().replace(/\s+/g, ' ');
  if (!exercise) return { ok: false, error: 'Nama gerakan tidak boleh kosong' };
  if (exercise.length > SET_LOG_NAME_MAX) {
    return { ok: false, error: `Nama gerakan maksimal ${SET_LOG_NAME_MAX} karakter` };
  }
  if (!Number.isInteger(input.sets) || input.sets < SET_LOG_SETS_MIN || input.sets > SET_LOG_SETS_MAX) {
    return { ok: false, error: `Jumlah set harus bilangan bulat ${SET_LOG_SETS_MIN}–${SET_LOG_SETS_MAX}` };
  }
  if (!Number.isInteger(input.amount) || input.amount < SET_LOG_AMOUNT_MIN || input.amount > SET_LOG_AMOUNT_MAX) {
    return { ok: false, error: `Jumlah per set harus bilangan bulat ${SET_LOG_AMOUNT_MIN}–${SET_LOG_AMOUNT_MAX}` };
  }
  const unit = input.unit as GymExerciseUnit;
  if (!GYM_EXERCISE_UNITS.includes(unit)) {
    return { ok: false, error: 'Satuan gerakan tidak dikenal' };
  }
  return { ok: true, zone: zone as MuscleZoneKey, exercise, nameKey: exerciseNameKey(exercise), sets: input.sets, amount: input.amount, unit };
}

// ── Mesin PR (murni) ───────────────────────────────────────────────────────

/** amount rekor + konteksnya dari sekelompok catatan SATU satuan. */
interface UnitBest {
  amount: number;
  sets: number;
  dayKey: string;
}

/** Best per satuan untuk satu nameKey. */
function bestPerUnit(rows: GymSetLogRow[]): Map<GymExerciseUnit, UnitBest> {
  const best = new Map<GymExerciseUnit, UnitBest>();
  for (const r of rows) {
    const cur = best.get(r.unit);
    // Strictly greater menang; sama → catatan TERBARU (dayKey besar) menang
    // supaya tanggal rekor selalu mencerminkan terakhir kali angka itu dicapai.
    if (!cur || r.amount > cur.amount || (r.amount === cur.amount && r.dayKey > cur.dayKey)) {
      best.set(r.unit, { amount: r.amount, sets: r.sets, dayKey: r.dayKey });
    }
  }
  return best;
}

/** Semua PR zona, urut amount terkuat dulu, maks SET_LOG_PR_MAX. */
export function computePrs(zone: MuscleZoneKey, rows: GymSetLogRow[], todayYmd: string): GymExercisePr[] {
  void todayYmd; // disiapkan untuk pengurutan "rekor segar" di masa depan
  const byName = new Map<string, { display: string; rows: GymSetLogRow[] }>();
  for (const r of rows) {
    const g = byName.get(r.nameKey) ?? { display: r.exercise, rows: [] };
    // Nama tampilan terbaru (dayKey terbesar) supaya ikut rename user.
    if (r.dayKey >= (g.rows[g.rows.length - 1]?.dayKey ?? '')) g.display = r.exercise;
    g.rows.push(r);
    byName.set(r.nameKey, g);
  }
  const prs: GymExercisePr[] = [];
  for (const [nameKey, g] of byName) {
    for (const [unit, b] of bestPerUnit(g.rows)) {
      prs.push({
        nameKey,
        exercise: g.display,
        unit,
        bestAmount: b.amount,
        bestSets: b.sets,
        bestDayKey: b.dayKey,
        totalLogs: g.rows.length,
      });
    }
  }
  prs.sort((a, b) => b.bestAmount - a.bestAmount || a.exercise.localeCompare(b.exercise));
  return prs.slice(0, SET_LOG_PR_MAX);
}

/** Rekor sebelumnya untuk (nameKey, unit) — mengabaikan baris `excludeId`
 *  (baris yang sedang dikoreksi hari ini). null = belum pernah dicatat. */
export function prevBestAmount(rows: GymSetLogRow[], nameKey: string, unit: GymExerciseUnit, excludeId?: string): number | null {
  let best: number | null = null;
  for (const r of rows) {
    if (r.nameKey !== nameKey || r.unit !== unit) continue;
    if (excludeId && r.id === excludeId) continue;
    if (best === null || r.amount > best) best = r.amount;
  }
  return best;
}

/** Bentuk payload zona: riwayat 30 hari terbaru-dulu + PR sepanjang masa.
 *  `rows` = SELURUH catatan zona (semua waktu) — PR tidak boleh terpotong. */
export function buildZoneSetsPayload(zone: MuscleZoneKey, allRows: GymSetLogRow[], todayYmd: string): GymZoneSetsPayload {
  // Terbaru dulu: dayKey desc, tie-break createdAt desc.
  const sorted = [...allRows].sort((a, b) => {
    if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
  });
  const startKey = dayKeyShift(todayYmd, -(SET_LOG_HISTORY_DAYS - 1));
  const recent = sorted.filter((r) => r.dayKey >= startKey && r.dayKey <= todayYmd);
  return {
    zone,
    todayYmd,
    logs: recent,
    prs: computePrs(zone, sorted, todayYmd),
  };
}

// ── Format tampilan ────────────────────────────────────────────────────────

/** "15 reps" / "45 detik" — angka + satuan (untuk chip PR). */
export function prLabel(amount: number, unit: GymExerciseUnit): string {
  return `${amount} ${unit}`;
}

// ── Util kecil (harian; tidak dipakai lintas modul lain supaya tetap murni) ─

/** Geser 'yyyy-MM-dd' sebanyak n hari — leksikografis aman (YYYY-MM-DD). */
export function dayKeyShift(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}
