// ---------------------------------------------------------------------------
// src/lib/wellness/types.ts — TUBUH & GIZI Fase 2 (Task 73).
//
// Bentukan data wellness. Semua tanggal logis = YMD 'yyyy-MM-dd' Jakarta
// (konvensi app); nilai nullable = "belum diisi hari itu" (bukan nol —
// beda makna: 0 gelas air = memang belum minum dan DIREKAM).
// ---------------------------------------------------------------------------

/** Nilai wellness satu hari (subset kolom DailyLog). */
export interface WellnessEntry {
  waterGlasses: number | null;
  proteinGram: number | null;
  weightKg: number | null;
}

/** Satu titik riwayat berat (untuk sparkline & delta). */
export interface WeightPoint {
  ymd: string;
  weightKg: number;
}

/** Baris mentah DailyLog jendela N hari (bahan compute — lihat compute.ts). */
export interface WellnessRow {
  ymd: string;
  waterGlasses: number | null;
  proteinGram: number | null;
  weightKg: number | null;
}

/** Target harian aktif (air konstan; protein turunan berat tercatat). */
export interface WellnessTargets {
  waterGlasses: number;
  proteinGram: number;
  /** true bila target protein diturunkan dari berat badan tercatat. */
  proteinFromWeight: boolean;
}

/** Ringkasan mingguan air & protein (jendela 7 hari termasuk hari ini). */
export interface WellnessWeekly {
  avgWater7: number | null;
  avgProtein7: number | null;
  /** Hari mencapai target air penuh dalam 7 hari (streak tidak — hitungan hari). */
  waterGoalDays7: number;
}

/** Payload GET /api/wellness (dibentuk server lewat buildWellnessPayload). */
export interface WellnessPayload {
  todayYmd: string;
  /** Nilai hari ini (null = belum diisi). */
  today: WellnessEntry;
  targets: WellnessTargets;
  weight: {
    latestKg: number | null;
    latestYmd: string | null;
    /** latest − titik tertua dalam jendela 7 hari; null bila belum ada pembanding. */
    delta7Kg: number | null;
    /** Riwayat 30 hari terakhir, urut naik. */
    trend: WeightPoint[];
  };
  weekly: WellnessWeekly;
}

/** Patch tulis (PUT /api/wellness) — partial-safe seperti daily-logs. */
export interface WellnessPatch {
  date: string;
  waterGlasses?: number;
  proteinGram?: number;
  weightKg?: number;
}
