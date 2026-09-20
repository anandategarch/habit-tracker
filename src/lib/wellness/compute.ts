// ---------------------------------------------------------------------------
// src/lib/wellness/compute.ts — TUBUH & GIZI Fase 2 (Task 73).
//
// Pustaka MURNI (tanpa I/O) — dipakai server (api/wellness membentuk payload)
// dan klien (komponen wellness membaca angka/teks yang sama). Prinsip arsitektur
// app tetap: LAPISAN TURUNAN — tidak menyentuh kalkulasi XP/streak/kalender.
//
// Semua tanggal = YMD string 'yyyy-MM-dd' (konvensi app, TZ-proof) — operasi
// tanggal memakai shiftYmd dari lib/dashboard-helpers (satu sumber kebenaran).
// ---------------------------------------------------------------------------

import { shiftYmd } from '@/lib/dashboard-helpers';
import {
  PROTEIN_FALLBACK_G,
  PROTEIN_PER_KG,
  WATER_ML_PER_GLASS,
  WATER_TARGET_GLASSES,
  WEEKLY_WINDOW_DAYS,
  WEIGHT_DELTA_DAYS,
  WEIGHT_DECIMALS,
  WEIGHT_TREND_DAYS,
} from './constants';
import type {
  WeightPoint,
  WellnessEntry,
  WellnessPayload,
  WellnessRow,
  WellnessTargets,
  WellnessWeekly,
} from './types';

// ── Format Indonesia (koma desimal) ────────────────────────────────────────

/** Berat "72,5 kg" (1 desimal, koma id-ID). */
export function formatKgId(kg: number): string {
  return `${kg.toLocaleString('id-ID', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} kg`;
}

/** Delta berat bertanda: "+0,5 kg" / "−0,3 kg" / "0 kg". */
export function formatDeltaKgId(deltaKg: number): string {
  const rounded = roundWeight(deltaKg);
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  return `${sign}${Math.abs(rounded).toLocaleString('id-ID', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} kg`;
}

/** Total ml gelas → liter ringkas "1,5 L" / "2 L". */
export function formatLitersId(glasses: number): string {
  const liters = (glasses * WATER_ML_PER_GLASS) / 1000;
  return `${liters.toLocaleString('id-ID', {
    maximumFractionDigits: 1,
  })} L`;
}

/** Bulatkan berat ke presisi 0,1 kg. */
export function roundWeight(kg: number): number {
  return Math.round(kg * 10 ** WEIGHT_DECIMALS) / 10 ** WEIGHT_DECIMALS;
}

// ── Target & progress ───────────────────────────────────────────────────────

/**
 * Target protein harian: 1,6 g × berat tercatat TERAKHIR (60 g fallback bila
 * berat belum pernah dicatat). Murni — dipanggil server (payload) & dipakai
 * ulang klien untuk koreksi optimistic UI.
 */
export function proteinTargetGram(latestWeightKg: number | null): number {
  if (latestWeightKg == null || !Number.isFinite(latestWeightKg)) {
    return PROTEIN_FALLBACK_G;
  }
  return Math.round(latestWeightKg * PROTEIN_PER_KG);
}

/** Persen progress 0..100 (dibulatkan; lebih dari target tetap 100 visual). */
export function progressPct(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / target) * 100)));
}

// ── Riwayat berat ───────────────────────────────────────────────────────────

/** Ekstrak titik berat (tanpa null) dari baris jendela, urut naik. */
export function weightTrendOf(rows: WellnessRow[]): WeightPoint[] {
  return rows
    .filter((r) => r.weightKg != null)
    .map((r) => ({ ymd: r.ymd, weightKg: r.weightKg as number }))
    .sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0));
}

/**
 * Delta berat jendela mingguan: catatan TERBARU − catatan TERLAMA yang masih
 * berada dalam [today−6 .. today]. null bila window hanya memuat ≤1 catatan
 * (belum ada pembanding) — jangan mengarang "0 kg" dari data kosong.
 */
export function weightDelta7Kg(trend: WeightPoint[], todayYmd: string): number | null {
  const windowStart = shiftYmd(todayYmd, -(WEIGHT_DELTA_DAYS - 1));
  const inWindow = trend.filter((p) => p.ymd >= windowStart && p.ymd <= todayYmd);
  if (inWindow.length < 2) return null;
  const latest = inWindow[inWindow.length - 1];
  const oldest = inWindow[0];
  return roundWeight(latest.weightKg - oldest.weightKg);
}

// ── Ringkasan mingguan ─────────────────────────────────────────────────────

/** Rata-rata + hari-capai-target air & protein dalam jendela 7 hari. */
export function weeklyStatsOf(rows: WellnessRow[], todayYmd: string, waterTarget: number): WellnessWeekly {
  const windowStart = shiftYmd(todayYmd, -(WEEKLY_WINDOW_DAYS - 1));
  const inWindow = rows.filter((r) => r.ymd >= windowStart && r.ymd <= todayYmd);
  const waters = inWindow.map((r) => r.waterGlasses).filter((v): v is number => v != null);
  const proteins = inWindow.map((r) => r.proteinGram).filter((v): v is number => v != null);
  return {
    avgWater7: waters.length
      ? Math.round((waters.reduce((a, b) => a + b, 0) / waters.length) * 10) / 10
      : null,
    avgProtein7: proteins.length
      ? Math.round(proteins.reduce((a, b) => a + b, 0) / proteins.length)
      : null,
    waterGoalDays7: waters.filter((v) => v >= waterTarget).length,
  };
}

// ── Builder payload (server memanggil; murni → mudah diverifikasi) ─────────

/**
 * Bentuk payload lengkap GET /api/wellness dari baris DailyLog jendela 30 hari
 * (termasuk hari ini; baris hari-tanpa-catatan boleh absen dari daftar).
 *
 * @param todayYmd   YMD hari ini (Jakarta)
 * @param todayEntry nilai hari ini (null semua bila baris belum ada)
 * @param rows       baris jendela [today−29 .. today] yang ADA di DB (sembarang urutan)
 */
export function buildWellnessPayload(
  todayYmd: string,
  todayEntry: WellnessEntry,
  rows: WellnessRow[],
): WellnessPayload {
  const trendStart = shiftYmd(todayYmd, -(WEIGHT_TREND_DAYS - 1));
  const bounded = rows.filter((r) => r.ymd >= trendStart && r.ymd <= todayYmd);
  const trend = weightTrendOf(bounded);
  const latest = trend.length ? trend[trend.length - 1] : null;

  const targets: WellnessTargets = {
    waterGlasses: WATER_TARGET_GLASSES,
    proteinGram: proteinTargetGram(latest?.weightKg ?? null),
    proteinFromWeight: latest != null,
  };

  return {
    todayYmd,
    today: todayEntry,
    targets,
    weight: {
      latestKg: latest?.weightKg ?? null,
      latestYmd: latest?.ymd ?? null,
      delta7Kg: weightDelta7Kg(trend, todayYmd),
      trend,
    },
    weekly: weeklyStatsOf(bounded, todayYmd, targets.waterGlasses),
  };
}

// ── Optimistic patch (klien memanggil; hitungan sama dengan server) ─────────

/**
 * Terapkan patch hari-ini ke payload yang SUDAH ada di cache klien
 * (optimistic UI): today diperbarui, trend/berat/delta/target protein ikut
 * dihitung ulang dengan fungsi murni yang sama dengan server — hasil
 * optimistic ≈ hasil refetch (tanpa flicker). Ringkasan mingguan dibiarkan
 * (disegarkan otomatis oleh invalidate setelah PUT sukses).
 */
export function applyTodayPatch(
  payload: WellnessPayload,
  patch: { waterGlasses?: number; proteinGram?: number; weightKg?: number },
): WellnessPayload {
  const today: WellnessEntry = {
    waterGlasses: patch.waterGlasses ?? payload.today.waterGlasses,
    proteinGram: patch.proteinGram ?? payload.today.proteinGram,
    weightKg: patch.weightKg ?? payload.today.weightKg,
  };

  // Trend: ganti titik hari ini (bila ada), tambah bila baru.
  const trend = payload.weight.trend.filter((p) => p.ymd !== payload.todayYmd);
  if (today.weightKg != null) {
    trend.push({ ymd: payload.todayYmd, weightKg: today.weightKg });
  }
  trend.sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0));
  const latest = trend.length ? trend[trend.length - 1] : null;

  return {
    ...payload,
    today,
    targets: {
      waterGlasses: payload.targets.waterGlasses,
      proteinGram: proteinTargetGram(latest?.weightKg ?? null),
      proteinFromWeight: latest != null,
    },
    weight: {
      latestKg: latest?.weightKg ?? null,
      latestYmd: latest?.ymd ?? null,
      delta7Kg: weightDelta7Kg(trend, payload.todayYmd),
      trend,
    },
  };
}
