// ---------------------------------------------------------------------------
// GET  /api/wellness — TUBUH & GIZI Fase 2 (Task 73): payload air/protein/
//                      berat hari ini + trend berat 30 hari + ringkasan 7 hari
//                      (murni lapisan BACA dari kolom DailyLog — tidak
//                      menyentuh kalkulasi XP/streak).
// PUT  /api/wellness — upsert PARTIAL per tanggal (default hari ini):
//                      { date?, waterGlasses?, proteinGram?, weightKg? } —
//                      field yang tidak dikirim TIDAK di-reset (pola
//                      daily-logs). 0 adalah nilai sah (0 gelas = direkam).
// ---------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  asNumber,
  asString,
  badRequest,
  clamp,
  handleApiError,
  readJsonBody,
} from '@/app/api/_lib/api-utils';
import { ensureWellnessColumns } from '@/app/api/_lib/wellness-ensure';
import { shiftYmd } from '@/lib/dashboard-helpers';
import { dateFromYMD, isValidYMD, jakartaDateString } from '@/lib/timezone';
import {
  buildWellnessPayload,
  roundWeight,
  WATER_MAX,
  WATER_MIN,
  PROTEIN_MAX,
  PROTEIN_MIN,
  WEIGHT_MAX,
  WEIGHT_MIN,
  WEIGHT_TREND_DAYS,
  type WellnessEntry,
  type WellnessRow,
} from '@/lib/wellness';

export const dynamic = 'force-dynamic';

function ymdOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    // Kolom aditif — pastikan ada sebelum dibaca (produksi Turso).
    await ensureWellnessColumns();

    const todayYmd = jakartaDateString();
    const trendStartYmd = shiftYmd(todayYmd, -(WEIGHT_TREND_DAYS - 1));

    const rows = await db.dailyLog.findMany({
      where: { date: { gte: dateFromYMD(trendStartYmd), lte: dateFromYMD(todayYmd) } },
      select: { date: true, waterGlasses: true, proteinGram: true, weightKg: true },
      orderBy: { date: 'asc' },
    });

    const mapped: WellnessRow[] = rows.map((r) => ({
      ymd: ymdOf(r.date as Date),
      waterGlasses: r.waterGlasses ?? null,
      proteinGram: r.proteinGram ?? null,
      weightKg: r.weightKg ?? null,
    }));

    const today = mapped.find((r) => r.ymd === todayYmd);
    const todayEntry: WellnessEntry = {
      waterGlasses: today?.waterGlasses ?? null,
      proteinGram: today?.proteinGram ?? null,
      weightKg: today?.weightKg ?? null,
    };

    return NextResponse.json(buildWellnessPayload(todayYmd, todayEntry, mapped));
  } catch (error) {
    return handleApiError(error, 'wellness:GET');
  }
}

export async function PUT(req: Request) {
  try {
    await ensureWellnessColumns();

    const body = await readJsonBody(req);

    // Tanggal opsional (default hari ini Jakarta) — wellness Beranda mencatat
    // "sekarang"; date eksplisit disiapkan untuk backdate berat di masa depan.
    const date = asString(body.date) ?? jakartaDateString();
    if (!isValidYMD(date)) throw badRequest('Format tanggal tidak valid (yyyy-MM-dd)');

    const update: Record<string, unknown> = {};
    const create: Record<string, unknown> = { date: dateFromYMD(date) };

    if ('waterGlasses' in body && body.waterGlasses !== undefined && body.waterGlasses !== null) {
      const water = asNumber(body.waterGlasses);
      if (water === null) throw badRequest('Nilai gelas air tidak valid');
      update.waterGlasses = Math.round(clamp(water, WATER_MIN, WATER_MAX));
      create.waterGlasses = update.waterGlasses;
    }
    if ('proteinGram' in body && body.proteinGram !== undefined && body.proteinGram !== null) {
      const protein = asNumber(body.proteinGram);
      if (protein === null) throw badRequest('Nilai protein tidak valid');
      update.proteinGram = Math.round(clamp(protein, PROTEIN_MIN, PROTEIN_MAX));
      create.proteinGram = update.proteinGram;
    }
    if ('weightKg' in body && body.weightKg !== undefined && body.weightKg !== null) {
      const weight = asNumber(body.weightKg);
      if (weight === null) throw badRequest('Nilai berat badan tidak valid');
      update.weightKg = roundWeight(clamp(weight, WEIGHT_MIN, WEIGHT_MAX));
      create.weightKg = update.weightKg;
    }

    if (Object.keys(update).length === 0) {
      throw badRequest('Tidak ada field yang bisa disimpan');
    }

    const log = await db.dailyLog.upsert({
      where: { date: dateFromYMD(date) },
      update: update as Parameters<typeof db.dailyLog.upsert>[0]['update'],
      create: create as Parameters<typeof db.dailyLog.upsert>[0]['create'],
    });
    return NextResponse.json(log);
  } catch (error) {
    return handleApiError(error, 'wellness:PUT');
  }
}
