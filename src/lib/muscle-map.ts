// ---------------------------------------------------------------------------
// src/lib/muscle-map.ts — BARREL Muscle Engine (Task 64/65/67, dipecah Task 71).
//
// Pustaka MURNI (tanpa I/O) untuk fitur workout — kini dibagi per domain:
//   * muscle-map-zones.ts        : definisi zona + mesin status + visual Opsi A
//                                  + balance score + narasi Indonesia
//   * muscle-map-exercises.ts    : GYM_EXERCISE_UNITS, GymExerciseItem,
//                                  exerciseDisplay, ZONE_EXERCISE_PRESETS
//   * muscle-map-history.ts      : V2 — computeGymHistory, PR zona, pencapaian,
//                                  utilitas minggu murni
//   * muscle-map-readiness.ts    : Task 72 F1 — Gym Cerdas: skor kesiapan
//                                  harian dari check-in (tidur/energi/mood),
//                                  multiplier pemulihan + saran zona
//   * muscle-map-sets.ts         : Task 74 F3 — jurnal set aktual + mesin PR
//                                  (validasi catatan, rekor per satuan, payload
//                                  riwayat 30 hari per zona)
//   * muscle-map-program.ts      : Task 75 F4 — program latihan mingguan
//                                  (4 preset split, validasi dua-sisi, mesin
//                                  payload minggu + adherence + minggu ke-N)
//   * muscle-map-cardio.ts       : Task 76 Bonus — jurnal kardio (validasi
//                                  dua-sisi, estimasi kcal MET, payload
//                                  minggu + jarak terjauh per jenis)
//   * muscle-map-photos.ts       : Task 76 Bonus — foto progres (pose,
//                                  batas base64, validasi dua-sisi, payload
//                                  daftar + perjalanan hari)
//   * image-compress.ts          : Task 76 Bonus — kompresi foto klien
//                                  (canvas → JPEG penuh + thumbnail) — file
//                                  terpisah (browser-only), BUKAN di barrel
//
// File ini tetap BERADA di jalur yang sama supaya SEMUA konsumen
// `from '@/lib/muscle-map'` (api/gym, api/gym/exercises, use-gym,
// muscle-map.tsx, exercise-editor, gym-history, gym-card, gym-screen,
// rest-timer) resolve tanpa perubahan. Definisi tersisa: GymMapPayload —
// tipe payload API yang merangkum ketiga domain.
//
// PRINSIP ARSITEKTUR (desain user Task 63/64 — "Peta Otot hanya MEMBACA
// event"): XP, streak, kalender, dan KPI tetap mengalir lewat mekanisme
// HabitLog habit zona (pipa lama). Modul ini TIDAK menambah kalkulasi XP
// baru — semua fungsi di sini adalah LAPISAN TURUNAN atas data habit.
// ---------------------------------------------------------------------------

import type { GymExerciseItem } from './muscle-map-exercises';
import type {
  GymAchievementPayload,
  GymBestWeekPayload,
  GymTotalsPayload,
  GymZoneHistoryPayload,
} from './muscle-map-history';
import type { GymMissionPayload, GymZonePayload, MuscleZoneKey } from './muscle-map-zones';
import type { GymReadinessPayload } from './muscle-map-readiness';

export * from './muscle-map-zones';
export * from './muscle-map-exercises';
export * from './muscle-map-history';
export * from './muscle-map-readiness';
export * from './muscle-map-sets';
export * from './muscle-map-program';
export * from './muscle-map-cardio';
export * from './muscle-map-photos';

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
  // ── Task 72 F1 (Gym Cerdas) — kesiapan harian turunan DailyLog ──
  /** null bila belum ada check-in hari ini/kemarin → UI menampilkan ajakan
   *  mengisi check-in. Memuat multiplier pemulihan yang mengalir ke
   *  recoveryPct/zoneStatus di klien. */
  readiness: GymReadinessPayload | null;
}
