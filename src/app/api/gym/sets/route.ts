// ---------------------------------------------------------------------------
// GET    /api/gym/sets?zone=dada — jurnal set zona (Task 74 F3): riwayat 30
//                                hari + PR sepanjang masa per gerakan.
// POST   /api/gym/sets          — catat/koreksi performa aktual satu gerakan
//                                { zone, exercise, sets, amount, unit, date? }.
//                                Upsert per (zona, nameKey, hari): mencatat
//                                ulang di hari sama = koreksi, bukan baris
//                                baru. Respons membawa isPr + prevBestAmount
//                                untuk perayaan klien.
// DELETE /api/gym/sets?id=…     — hapus satu catatan (PR dihitung ulang murni
//                                dari sisa baris di GET berikutnya).
//
// Jurnal set = LAPISAN CATAT terpisah: TIDAK menyentuh XP/streak/kalender
// HabitLog (prinsip Peta Otot). Validasi memakai validateSetLogInput() yang
// SAMA dengan klien — dua sisi satu aturan.
// ---------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { asString, badRequest, handleApiError, notFound, readJsonBody } from '@/app/api/_lib/api-utils';
import { ensureGymSetTables } from '@/app/api/_lib/gym-set-ensure';
import { jakartaDateString, isValidYMD } from '@/lib/timezone';
import {
  MUSCLE_ZONE_DEF_BY_KEY,
  buildZoneSetsPayload,
  prevBestAmount,
  validateSetLogInput,
  type GymSetLogRow,
  type GymSetSaveResult,
  type GymZoneSetsPayload,
  type MuscleZoneKey,
} from '@/lib/muscle-map';

export const dynamic = 'force-dynamic';

/** Bentuk klien dari baris Prisma GymSetLog. */
function toRow(r: {
  id: string;
  zone: string;
  nameKey: string;
  exercise: string;
  sets: number;
  amount: number;
  unit: string;
  dayKey: string;
  createdAt: Date;
}): GymSetLogRow {
  return {
    id: r.id,
    zone: r.zone as MuscleZoneKey,
    nameKey: r.nameKey,
    exercise: r.exercise,
    sets: r.sets,
    amount: r.amount,
    unit: r.unit as GymSetLogRow['unit'],
    dayKey: r.dayKey,
    createdAt: (r.createdAt as Date).toISOString(),
  };
}

export async function GET(req: Request) {
  try {
    await ensureGymSetTables();

    const zone = new URL(req.url).searchParams.get('zone') ?? '';
    if (!MUSCLE_ZONE_DEF_BY_KEY[zone as MuscleZoneKey]) {
      throw badRequest('Parameter zona tidak valid');
    }
    const zoneKey = zone as MuscleZoneKey;

    // Seluruh catatan zona (semua waktu) — PR sepanjang masa tak boleh
    // terpotong jendela 30 hari; payload memfilter sendiri.
    const rows = await db.gymSetLog.findMany({ where: { zone: zoneKey } });
    const payload: GymZoneSetsPayload = buildZoneSetsPayload(
      zoneKey,
      rows.map(toRow),
      jakartaDateString(),
    );
    return NextResponse.json(payload);
  } catch (error) {
    return handleApiError(error, 'gym/sets:GET');
  }
}

export async function POST(req: Request) {
  try {
    await ensureGymSetTables();

    const body = await readJsonBody(req);

    // Tanggal opsional (default hari ini Jakarta) — memungkinkan backdate
    // "oh kemarin aku lupa catat"; masa depan ditolak.
    const date = asString(body.date) ?? jakartaDateString();
    if (!isValidYMD(date)) throw badRequest('Format tanggal tidak valid (yyyy-MM-dd)');
    const todayYmd = jakartaDateString();
    if (date > todayYmd) throw badRequest('Tidak bisa mencatat untuk tanggal di masa depan');

    const validated = validateSetLogInput({
      zone: asString(body.zone) ?? '',
      exercise: asString(body.exercise) ?? '',
      sets: typeof body.sets === 'number' ? body.sets : Number.NaN,
      amount: typeof body.amount === 'number' ? body.amount : Number.NaN,
      unit: asString(body.unit) ?? '',
    });
    if (!validated.ok) throw badRequest(validated.error);
    const { zone, exercise, nameKey, sets, amount, unit } = validated;

    // Baris hari itu (bila sudah ada = mode koreksi).
    const existing = await db.gymSetLog.findUnique({
      where: { zone_nameKey_dayKey: { zone, nameKey, dayKey: date } },
      select: { id: true },
    });

    // PR dibandingkan terhadap baseline rekor SEBELUM penyimpanan ini:
    // maksimum dari rekor catatan lain (mengabaikan baris yang dikoreksi)
    // dan nilai LAMA baris hari ini — supaya koreksi 13→15 benar-benar
    // dibandingkan dengan 13 ("rekor lama 13"), bukan rekor 12 kemarin.
    const zoneRows = (await db.gymSetLog.findMany({ where: { zone } })).map(toRow);
    const bestOthers = prevBestAmount(zoneRows, nameKey, unit, existing?.id);
    const oldAmount = existing ? (zoneRows.find((r) => r.id === existing.id)?.amount ?? null) : null;
    const prev = bestOthers !== null || oldAmount !== null
      ? Math.max(bestOthers ?? 0, oldAmount ?? 0)
      : null;
    // PR baru: lewati baseline (bila ada); catatan PERTAMA gerakan ini juga
    // dirayakan sebagai rekor awal — koreksi tanpa perubahan/penurunan tidak.
    const isPr = prev === null ? existing === null : amount > prev;

    const saved = await db.gymSetLog.upsert({
      where: { zone_nameKey_dayKey: { zone, nameKey, dayKey: date } },
      update: { exercise, sets, amount, unit },
      create: { zone, nameKey, exercise, sets, amount, unit, dayKey: date },
    });

    const result: GymSetSaveResult = { log: toRow(saved), isPr, prevBestAmount: prev };
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, 'gym/sets:POST');
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureGymSetTables();

    const id = new URL(req.url).searchParams.get('id') ?? '';
    if (!id) throw badRequest('Parameter id wajib');
    const existing = await db.gymSetLog.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw notFound('Catatan tidak ditemukan');

    await db.gymSetLog.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'gym/sets:DELETE');
  }
}
