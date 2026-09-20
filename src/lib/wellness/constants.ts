// ---------------------------------------------------------------------------
// src/lib/wellness/constants.ts — TUBUH & GIZI Fase 2 (Task 73).
//
// Konstanta model wellness (air, protein, berat). Disatukan di satu modul
// supaya API (validasi clamp) dan UI (ikhtisar/progress) membaca angka yang
// SAMA — tidak ada magic number tersebar.
//
// Pilihan angka:
//  * Air 8 gelas × 250 ml ≈ 2 L — anjuran hidrasi umum (MyFitnessPal &
//    aplikasi hidrasi populer memakai 8×250 ml sebagai default).
//  * Protein 1,6 g/kg berat badan — konsensus praktis kebugaran umum
//    (1,2–2,0 g/kg) untuk orang aktif; fallback 60 g bila berat belum
//    dicatat (≈ orang 60 kg, sisi aman).
//  * Berat 20–300 kg & presisi 0,1 kg — batas masuk akal + anti-typo
//    (mis. 725 kg tertukar).
// ---------------------------------------------------------------------------

/** Target hidrasi harian default (gelas). */
export const WATER_TARGET_GLASSES = 8;

/** Satu gelas = 250 ml (dipakai ikhtisar "≈ 1,5 L"). */
export const WATER_ML_PER_GLASS = 250;

/** Batas clamp jumlah gelas (0..30) — anti nilai tak masuk akal. */
export const WATER_MIN = 0;
export const WATER_MAX = 30;

/** Rasio protein per kg berat badan tercatat (g/kg). */
export const PROTEIN_PER_KG = 1.6;

/** Target protein bila berat badan belum pernah dicatat (g). */
export const PROTEIN_FALLBACK_G = 60;

/** Batas clamp protein harian (g). */
export const PROTEIN_MIN = 0;
export const PROTEIN_MAX = 1000;

/** Langkah cepat tambah/kurang protein di UI (gram). */
export const PROTEIN_QUICK_STEPS = [10, 25, 50] as const;
export const PROTEIN_UNDO_STEP = 10;

/** Batas clamp berat badan (kg) + presisi desimal. */
export const WEIGHT_MIN = 20;
export const WEIGHT_MAX = 300;
export const WEIGHT_DECIMALS = 1;

/** Jendela riwayat berat untuk sparkline (hari). */
export const WEIGHT_TREND_DAYS = 30;

/** Jendela delta berat "minggu ini" (hari). */
export const WEIGHT_DELTA_DAYS = 7;

/** Jendela rata-rata mingguan air/protein (hari). */
export const WEEKLY_WINDOW_DAYS = 7;
