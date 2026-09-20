// ---------------------------------------------------------------------------
// src/lib/muscle-map-exercises.ts — pustaka gerakan latihan (Task 64 + 67).
//
// Pustaka MURNI (tanpa I/O): satuan gerakan (GYM_EXERCISE_UNITS), struktur
// gerakan BERSAMA preset & kustom (GymExerciseItem), formatter tampilan
// exerciseDisplay(), dan preset default per zona ZONE_EXERCISE_PRESETS
// (workout di rumah, tanpa alat).
//
// Dipakai bersama lewat barrel '@/lib/muscle-map' oleh:
//   * Server: src/app/api/gym/route.ts + api/gym/exercises/route.ts
//     (fallback preset + validasi unit PUT/DELETE CRUD Task 67)
//   * Klien : components/gym/exercise-editor.tsx (dropdown unit),
//     components/gym/zone-focus-sheet.tsx (exerciseDisplay).
// ---------------------------------------------------------------------------

import type { MuscleZoneKey } from './muscle-map-zones';

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
