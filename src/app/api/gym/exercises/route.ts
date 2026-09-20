// PUT    /api/gym/exercises — SIMPAN daftar latihan kustom zona (Task 67).
//                        Body: { zone: MuscleZoneKey, exercises: GymExerciseItem[] }.
//                        Replace-all dalam SATU transaksi (hapus item lama →
//                        tulis ulang urut). Daftar KOSONG = sah (zona tanpa
//                        gerakan — bukan kembali ke default).
// DELETE /api/gym/exercises?zone=… — KEMBALIKAN preset default zona
//                        (hapus baris GymExerciseList; item ikut cascade).
//
// Prinsip Peta Otot tetap: mengedit latihan TIDAK menyentuh XP/streak/
// kalender (pipa HabitLog zona tidak berubah). Penanda kustomisasi = ADA-nya
// baris GymExerciseList untuk zona tsb (pola "list marker" supaya daftar
// kosong tidak tertukar dengan "belum dikustomisasi").
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, handleApiError, readJsonBody } from '@/app/api/_lib/api-utils';
import { ensureGymExerciseTables } from '@/app/api/_lib/gym-exercise-ensure';
import {
  GYM_EXERCISE_UNITS,
  MUSCLE_ZONE_DEF_BY_KEY,
  type GymExerciseItem,
  type GymExerciseUnit,
  type MuscleZoneKey,
} from '@/lib/muscle-map';

export const dynamic = 'force-dynamic';

const MAX_ITEMS = 20;

/** Validasi zona dari input mentah → MuscleZoneKey (400 bila tidak dikenal). */
function parseZone(raw: unknown): MuscleZoneKey {
  if (typeof raw !== 'string' || !MUSCLE_ZONE_DEF_BY_KEY[raw as MuscleZoneKey]) {
    throw badRequest('Zona otot tidak dikenal');
  }
  return raw as MuscleZoneKey;
}

/** Validasi ketat daftar gerakan (server-side — klien memvalidasi juga). */
function parseItems(raw: unknown): GymExerciseItem[] {
  if (!Array.isArray(raw)) throw badRequest('Daftar latihan tidak valid');
  if (raw.length > MAX_ITEMS) throw badRequest(`Maksimal ${MAX_ITEMS} gerakan per zona`);
  const items: GymExerciseItem[] = [];
  // Task 70 (audit 70-b MINOR #2): tolak nama duplikat (trim + case-insensitive).
  const seenNames = new Set<string>();
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw badRequest('Format gerakan tidak valid');
    }
    const r = entry as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (!name) throw badRequest('Nama gerakan tidak boleh kosong');
    if (name.length > 60) throw badRequest('Nama gerakan maksimal 60 karakter');
    const nameKey = name.toLowerCase();
    if (seenNames.has(nameKey)) {
      throw badRequest(`Nama gerakan duplikat: "${name}" — gunakan nama yang berbeda`);
    }
    seenNames.add(nameKey);
    // Task 70 (audit 70-b MINOR #4): typeof number + isInteger — string/boolean
    // (koersi Number() lama yang longgar) dan desimal kini DITOLAK 400.
    if (typeof r.sets !== 'number' || !Number.isInteger(r.sets) || r.sets < 1 || r.sets > 20) {
      throw badRequest('Jumlah set harus bilangan bulat 1–20');
    }
    if (typeof r.amount !== 'number' || !Number.isInteger(r.amount) || r.amount < 1 || r.amount > 9999) {
      throw badRequest('Jumlah per set harus bilangan bulat 1–9999');
    }
    const sets = r.sets;
    const amount = r.amount;
    const unit = typeof r.unit === 'string' ? r.unit : '';
    if (!GYM_EXERCISE_UNITS.includes(unit as GymExerciseUnit)) {
      throw badRequest('Satuan latihan tidak dikenal');
    }
    items.push({ name, sets, amount, unit: unit as GymExerciseUnit });
  }
  return items;
}

export async function PUT(req: Request) {
  try {
    await ensureGymExerciseTables();
    const body = await readJsonBody(req);
    const zone = parseZone(body.zone);
    const items = parseItems(body.exercises);

    // Transaksi: upsert penanda zona → replace-all item (urut tersimpan).
    await db.$transaction(async (tx) => {
      const list = await tx.gymExerciseList.upsert({
        where: { zone },
        update: {},
        create: { zone },
      });
      await tx.gymExercise.deleteMany({ where: { listId: list.id } });
      if (items.length > 0) {
        await tx.gymExercise.createMany({
          data: items.map((item, i) => ({
            listId: list.id,
            name: item.name,
            sets: item.sets,
            amount: item.amount,
            unit: item.unit,
            sortOrder: i,
          })),
        });
      }
    });

    return NextResponse.json({ ok: true, zone, count: items.length });
  } catch (error) {
    return handleApiError(error, 'gym-exercises:PUT');
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureGymExerciseTables();
    const zone = parseZone(new URL(req.url).searchParams.get('zone'));

    // deleteMany = idempoten (zona belum dikustomisasi → no-op sukses).
    // Item ikut terhapus lewat FK cascade.
    await db.gymExerciseList.deleteMany({ where: { zone } });

    return NextResponse.json({ ok: true, zone, count: 0 });
  } catch (error) {
    return handleApiError(error, 'gym-exercises:DELETE');
  }
}
