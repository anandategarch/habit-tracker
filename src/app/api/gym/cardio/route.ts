// ---------------------------------------------------------------------------
// GET    /api/gym/cardio        — payload kardio (entri 30 hari + statistik
//                                 minggu berjalan + jarak terjauh per jenis +
//                                 berat terakhir untuk estimasi klien).
// POST   /api/gym/cardio        — catat satu sesi { kind, durationMin,
//                                 distanceKm?, date? }. Beberapa sesi sehari
//                                 sah (jalan pagi + lari sore).
// DELETE /api/gym/cardio?id=…   — hapus satu sesi (salah catat).
//
// Kardio = LAPISAN CATAT terpisah: TIDAK menyentuh XP/streak/kalender
// HabitLog (prinsip Peta Otot). kcal TIDAK disimpan — diturunkan murni dari
// MET × berat terakhir (DailyLog.weightKg, synergy F2). Validasi memakai
// validateCardioInput() yang SAMA dengan klien — dua sisi satu aturan.
// ---------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { asString, badRequest, handleApiError, notFound, readJsonBody } from '@/app/api/_lib/api-utils';
import { ensureGymCardioTable } from '@/app/api/_lib/gym-cardio-ensure';
import { latestWeightKg } from '@/app/api/_lib/latest-weight';
import { jakartaDateString, isValidYMD } from '@/lib/timezone';
import {
  estimateCardioKcal,
  buildCardioPayload,
  validateCardioInput,
  type GymCardioEntry,
  type GymCardioKind,
} from '@/lib/muscle-map';

export const dynamic = 'force-dynamic';

/** YMD awal minggu berjalan sesuai weekStart pengaturan (pola route program). */
function weekStartYmdOf(ymd: string, weekStart: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const diff = (dow - weekStart + 7) % 7;
  const t = new Date(Date.UTC(y, m - 1, d - diff));
  return t.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    await ensureGymCardioTable();

    const todayYmd = jakartaDateString();
    const settings = await db.appSettings.findUnique({ where: { id: 'singleton' }, select: { weekStart: true } });
    const weekStart = settings?.weekStart === 0 ? 0 : 1;
    const weightKg = await latestWeightKg();

    const rows = await db.gymCardioLog.findMany();
    const payload = buildCardioPayload(rows, {
      todayYmd,
      weekStartYmd: weekStartYmdOf(todayYmd, weekStart),
      weightKg,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return handleApiError(error, 'gym/cardio:GET');
  }
}

export async function POST(req: Request) {
  try {
    await ensureGymCardioTable();

    const body = await readJsonBody(req);

    // Tanggal opsional (default hari ini Jakarta) — backdate sah, masa depan
    // ditolak (pola route jurnal set Task 74).
    const date = asString(body.date) ?? jakartaDateString();
    if (!isValidYMD(date)) throw badRequest('Format tanggal tidak valid (yyyy-MM-dd)');
    if (date > jakartaDateString()) throw badRequest('Tidak bisa mencatat untuk tanggal di masa depan');

    const rawDistance = body.distanceKm;
    const validated = validateCardioInput({
      kind: asString(body.kind) ?? '',
      durationMin: typeof body.durationMin === 'number' ? body.durationMin : Number.NaN,
      distanceKm: rawDistance === null || rawDistance === undefined ? null : Number(rawDistance),
    });
    if (!validated.ok) throw badRequest(validated.error);
    const { kind, durationMin, distanceKm } = validated;

    const created = await db.gymCardioLog.create({
      data: { kind, durationMin, distanceKm, dayKey: date },
    });

    // Estimasi kcal dari berat terkini (bukan disimpan — turunan murni).
    const weightKg = await latestWeightKg();
    const entry: GymCardioEntry = {
      id: created.id,
      kind: kind as GymCardioKind,
      durationMin: created.durationMin,
      distanceKm: created.distanceKm,
      dayKey: created.dayKey,
      createdAt: created.createdAt.toISOString(),
      kcal: estimateCardioKcal(kind, durationMin, weightKg),
    };
    return NextResponse.json({ entry });
  } catch (error) {
    return handleApiError(error, 'gym/cardio:POST');
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureGymCardioTable();

    const id = new URL(req.url).searchParams.get('id') ?? '';
    if (!id) throw badRequest('Parameter id wajib');
    const existing = await db.gymCardioLog.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw notFound('Sesi kardio tidak ditemukan');

    await db.gymCardioLog.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'gym/cardio:DELETE');
  }
}
