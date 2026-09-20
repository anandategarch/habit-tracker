// ---------------------------------------------------------------------------
// src/app/api/_lib/latest-weight.ts — berat badan terakhir dari DailyLog
// (Task 76, Bonus Gym Cerdas).
//
// Helper baca kecil dipakai route kardio (estimasi kcal MET) dan foto progres
// (snapshot berat + hint dialog) — synergy Fase 2 (Tubuh & Gizi): berat harian
// dicatat di DailyLog.weightKg; kita ambil baris TERBARU yang beratnya tidak
// null. null = user belum pernah mencatat berat.
// ---------------------------------------------------------------------------

import { db } from '@/lib/db';

/** Berat (kg) terakhir yang tercatat, atau null bila belum pernah. */
export async function latestWeightKg(): Promise<number | null> {
  const row = await db.dailyLog.findFirst({
    where: { weightKg: { not: null } },
    orderBy: { date: 'desc' },
    select: { weightKg: true },
  });
  return row?.weightKg ?? null;
}
