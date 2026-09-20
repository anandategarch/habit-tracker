// ---------------------------------------------------------------------------
// GET    /api/gym/photos            — payload daftar foto progres (thumbnail
//                                     terbaru-dulu, pose terakhir, ringkasan
//                                     perjalanan, berat terakhir sebagai hint).
// GET    /api/gym/photos?id=…        — detail SATU foto (gambar penuh).
// POST   /api/gym/photos             — simpan foto { pose, note?, imageBase64,
//                                     thumbBase64, date? }. Berat di-snapshot
//                                     otomatis server dari DailyLog terakhir
//                                     (synergy F2) bila klien tak mengirim.
// DELETE /api/gym/photos?id=…        — hapus satu foto.
//
// Foto progres = LAPISAN CATAT terpisah: TIDAK menyentuh XP/streak/kalender
// (prinsip Peta Otot). Gambar sudah terkompres di KLIEN (canvas JPEG ≤720px
// + thumbnail 144px) — server memvalidasi bentuk (JPEG base64) & ukuran.
// Validasi memakai validatePhotoInput() yang SAMA dengan klien.
// ---------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { asString, asNumber, badRequest, handleApiError, notFound, readJsonBody } from '@/app/api/_lib/api-utils';
import { ensureGymPhotoTable } from '@/app/api/_lib/gym-photo-ensure';
import { latestWeightKg } from '@/app/api/_lib/latest-weight';
import { jakartaDateString, isValidYMD } from '@/lib/timezone';
import {
  GYM_PHOTO_POSES,
  PHOTO_WEIGHT_MAX,
  PHOTO_WEIGHT_MIN,
  buildPhotosPayload,
  validatePhotoInput,
  type GymPhotoDetail,
  type GymPhotoPose,
  type GymPhotoRow,
  type GymPhotoRowInput,
} from '@/lib/muscle-map';

export const dynamic = 'force-dynamic';

function asPose(v: string): GymPhotoPose {
  return (GYM_PHOTO_POSES as readonly string[]).includes(v) ? (v as GymPhotoPose) : 'depan';
}

function toRowInput(r: {
  id: string;
  pose: string;
  note: string | null;
  weightKg: number | null;
  dayKey: string;
  thumbBase64: string;
  createdAt: Date;
}): GymPhotoRowInput {
  return {
    id: r.id,
    pose: asPose(r.pose),
    note: r.note,
    weightKg: r.weightKg,
    dayKey: r.dayKey,
    thumbBase64: r.thumbBase64,
    createdAt: r.createdAt,
  };
}

export async function GET(req: Request) {
  try {
    await ensureGymPhotoTable();

    const id = new URL(req.url).searchParams.get('id');
    if (id) {
      const row = await db.gymProgressPhoto.findUnique({ where: { id } });
      if (!row) throw notFound('Foto tidak ditemukan');
      const photo: GymPhotoDetail = {
        id: row.id,
        pose: asPose(row.pose),
        note: row.note,
        weightKg: row.weightKg,
        dayKey: row.dayKey,
        thumbBase64: row.thumbBase64,
        createdAt: row.createdAt.toISOString(),
        imageBase64: row.imageBase64,
      };
      return NextResponse.json({ photo });
    }

    const todayYmd = jakartaDateString();
    const latestWeight = await latestWeightKg();
    const rows = await db.gymProgressPhoto.findMany({
      orderBy: [{ dayKey: 'desc' }, { createdAt: 'desc' }],
    });
    const payload = buildPhotosPayload(rows.map(toRowInput), { todayYmd, latestWeightKg: latestWeight });
    return NextResponse.json(payload);
  } catch (error) {
    return handleApiError(error, 'gym/photos:GET');
  }
}

export async function POST(req: Request) {
  try {
    await ensureGymPhotoTable();

    const body = await readJsonBody(req);

    // Tanggal opsional (default hari ini Jakarta) — backdate sah, masa depan
    // ditolak (pola route jurnal set/kardio).
    const date = asString(body.date) ?? jakartaDateString();
    if (!isValidYMD(date)) throw badRequest('Format tanggal tidak valid (yyyy-MM-dd)');
    if (date > jakartaDateString()) throw badRequest('Tidak bisa menyimpan foto untuk tanggal di masa depan');

    const validated = validatePhotoInput({
      pose: asString(body.pose) ?? '',
      note: asString(body.note) ?? null,
      imageBase64: asString(body.imageBase64) ?? '',
      thumbBase64: asString(body.thumbBase64) ?? '',
    });
    if (!validated.ok) throw badRequest(validated.error);
    const { pose, note, imageBase64, thumbBase64 } = validated;

    // Snapshot berat: klien boleh mengirim override (dialog tahu beratnya),
    // selain itu server ambil DailyLog terakhir. Tidak ada berat → null
    // (foto tetap sah).
    const clientWeight = asNumber(body.weightKg);
    const weightKg =
      clientWeight !== null && clientWeight >= PHOTO_WEIGHT_MIN && clientWeight <= PHOTO_WEIGHT_MAX
        ? Math.round(clientWeight * 10) / 10
        : await latestWeightKg();

    const created = await db.gymProgressPhoto.create({
      data: { pose, note, weightKg, thumbBase64, imageBase64, dayKey: date },
    });

    // Respons POST = baris daftar (thumbnail) — klien sudah memegang gambarnya.
    const photo: GymPhotoRow = {
      id: created.id,
      pose,
      note,
      weightKg,
      dayKey: created.dayKey,
      thumbBase64,
      createdAt: created.createdAt.toISOString(),
    };
    return NextResponse.json({ photo });
  } catch (error) {
    return handleApiError(error, 'gym/photos:POST');
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureGymPhotoTable();

    const id = new URL(req.url).searchParams.get('id') ?? '';
    if (!id) throw badRequest('Parameter id wajib');
    const existing = await db.gymProgressPhoto.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw notFound('Foto tidak ditemukan');

    await db.gymProgressPhoto.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'gym/photos:DELETE');
  }
}
