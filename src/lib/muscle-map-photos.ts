// ---------------------------------------------------------------------------
// src/lib/muscle-map-photos.ts — FOTO PROGRES (Task 76, Bonus Gym Cerdas).
//
// Pustaka MURNI (tanpa I/O): definisi pose (depan/samping/belakang), batas
// ukuran base64 hasil kompresi klien, validasi input foto (dipakai server &
// klien — aturan SAMA dua sisi, pola muscle-map-sets.ts), dan mesin payload
// (daftar thumbnail terbaru + pose terakhir + ringkasan perjalanan).
//
// Berat foto = SNAPSHOT (disimpan saat foto diambil, auto server dari
// DailyLog.weightKg — synergy Fase 2) — TIDAK diturunkan ulang supaya
// riwayat foto stabil ala app workout profesional.
//
// Prinsip arsitektur tetap: foto MURNI LAPISAN CATAT — tidak menyentuh
// XP/streak/kalender (Peta Otot "hanya membaca event").
// ---------------------------------------------------------------------------

// ── Batas input & payload (server & klien memakai konstanta sama) ──────────

/** Catatan foto opsional: maks 200 karakter. */
export const PHOTO_NOTE_MAX = 200;
/** Base64 gambar penuh (≈450 KB biner) — hasil kompresi klien 720px. */
export const PHOTO_IMAGE_BASE64_MAX = 600_000;
/** Base64 thumbnail (≈20 KB biner) — hasil kompresi klien 144px. */
export const PHOTO_THUMB_BASE64_MAX = 30_000;
/** Jumlah foto yang dikirim ke daftar klien (terbaru dulu). */
export const PHOTO_LIST_MAX = 36;
/** Dimensi maks gambar penuh saat kompresi klien (px). */
export const PHOTO_FULL_MAX_DIM = 720;
/** Dimensi maks thumbnail saat kompresi klien (px). */
export const PHOTO_THUMB_MAX_DIM = 144;
/** Presisi berat snapshot: 20–300 kg (sama dengan wellness). */
export const PHOTO_WEIGHT_MIN = 20;
export const PHOTO_WEIGHT_MAX = 300;

// ── Pose ────────────────────────────────────────────────────────────────────

export const GYM_PHOTO_POSES = ['depan', 'samping', 'belakang'] as const;
export type GymPhotoPose = (typeof GYM_PHOTO_POSES)[number];

export interface GymPhotoPoseDef {
  key: GymPhotoPose;
  label: string;
  /** Deskripsi singkat untuk placeholder kosong. */
  hint: string;
}

export const GYM_PHOTO_POSE_LIST: GymPhotoPoseDef[] = [
  { key: 'depan', label: 'Depan', hint: 'berdiri menghadap kamera' },
  { key: 'samping', label: 'Samping', hint: 'badan menoleh ke samping' },
  { key: 'belakang', label: 'Belakang', hint:'punggung menghadap kamera' },
];

export const GYM_PHOTO_POSE_DEF_BY_KEY: Record<GymPhotoPose, GymPhotoPoseDef> = Object.fromEntries(
  GYM_PHOTO_POSE_LIST.map((p) => [p.key, p]),
) as Record<GymPhotoPose, GymPhotoPoseDef>;

// ── Tipe payload ────────────────────────────────────────────────────────────

/** Baris daftar foto (thumbnail) — bentuk serialisasi klien. */
export interface GymPhotoRow {
  id: string;
  pose: GymPhotoPose;
  note: string | null;
  /** Snapshot berat saat foto diambil (bukan berat kini). */
  weightKg: number | null;
  dayKey: string; // yyyy-MM-dd Jakarta
  thumbBase64: string;
  createdAt: string;
}

/** Baris detail foto (gambar penuh) — GET /api/gym/photos?id=… */
export interface GymPhotoDetail extends GymPhotoRow {
  imageBase64: string;
}

/** Payload GET /api/gym/photos (daftar). */
export interface GymPhotosPayload {
  todayYmd: string;
  /** Terbaru dulu, maks PHOTO_LIST_MAX. */
  photos: GymPhotoRow[];
  /** Total foto sepanjang masa. */
  count: number;
  /** Foto terbaru per pose (null = pose belum pernah difoto). */
  latestByPose: Record<GymPhotoPose, GymPhotoRow | null>;
  /** dayKey foto terlama sepanjang masa (null = belum ada foto). */
  firstDayKey: string | null;
  /** Hari antara foto pertama → terbaru (0 = masih satu hari). */
  journeyDays: number | null;
  /** Berat terakhir DailyLog (null = belum pernah) — hint dialog ambil foto. */
  latestWeightKg: number | null;
}

// ── Validasi (dipakai server & klien — dua sisi aturan sama) ───────────────

export interface PhotoInput {
  pose: string;
  note: string | null;
  imageBase64: string;
  thumbBase64: string;
}

export type PhotoValidation =
  | { ok: true; pose: GymPhotoPose; note: string | null; imageBase64: string; thumbBase64: string }
  | { ok: false; error: string };

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/** Validasi satu foto terkompresi. JPEG base64 selalu berawalan "/9j/". */
export function validatePhotoInput(input: PhotoInput): PhotoValidation {
  const pose = input.pose as GymPhotoPose;
  if (!GYM_PHOTO_POSE_DEF_BY_KEY[pose]) {
    return { ok: false, error: 'Pose foto tidak dikenal' };
  }
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length > PHOTO_NOTE_MAX) {
    return { ok: false, error: `Catatan foto maksimal ${PHOTO_NOTE_MAX} karakter` };
  }
  if (typeof input.imageBase64 !== 'string' || !input.imageBase64) {
    return { ok: false, error: 'Gambar foto wajib ada' };
  }
  if (!input.imageBase64.startsWith('/9j/') || !BASE64_RE.test(input.imageBase64)) {
    return { ok: false, error: 'Format foto harus JPEG hasil kompresi aplikasi' };
  }
  if (input.imageBase64.length > PHOTO_IMAGE_BASE64_MAX) {
    return { ok: false, error: 'Gambar terlalu besar — coba foto dengan resolusi lebih kecil' };
  }
  if (typeof input.thumbBase64 !== 'string' || !input.thumbBase64.startsWith('/9j/') || !BASE64_RE.test(input.thumbBase64)) {
    return { ok: false, error: 'Thumbnail foto tidak valid' };
  }
  if (input.thumbBase64.length > PHOTO_THUMB_BASE64_MAX) {
    return { ok: false, error: 'Thumbnail terlalu besar' };
  }
  return {
    ok: true,
    pose,
    note: note || null,
    imageBase64: input.imageBase64,
    thumbBase64: input.thumbBase64,
  };
}

// ── Mesin payload (murni) ───────────────────────────────────────────────────

/** Baris mentah dari Prisma (subset kolom) — bentuk input builder. */
export interface GymPhotoRowInput {
  id: string;
  pose: string;
  note: string | null;
  weightKg: number | null;
  dayKey: string;
  thumbBase64: string;
  createdAt: Date | string;
}

function toRow(r: GymPhotoRowInput): GymPhotoRow {
  const pose = (GYM_PHOTO_POSES as readonly string[]).includes(r.pose) ? (r.pose as GymPhotoPose) : 'depan';
  return {
    id: r.id,
    pose,
    note: r.note,
    weightKg: r.weightKg,
    dayKey: r.dayKey,
    thumbBase64: r.thumbBase64,
    createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(),
  };
}

/** Terbaru dulu: dayKey desc, tie-break createdAt desc. */
function byNewestFirst(a: GymPhotoRowInput, b: GymPhotoRowInput): number {
  if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? 1 : -1;
  const at = a.createdAt instanceof Date ? a.createdAt.getTime() : Date.parse(a.createdAt);
  const bt = b.createdAt instanceof Date ? b.createdAt.getTime() : Date.parse(b.createdAt);
  return at < bt ? 1 : at > bt ? -1 : 0;
}

/** Selisih hari antara dua YMD (b − a), aman lintas bulan/tahun. */
export function dayDiffYmd(aYmd: string, bYmd: string): number {
  const [ay, am, ad] = aYmd.split('-').map(Number);
  const [by, bm, bd] = bYmd.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/**
 * Bentuk payload daftar foto. `rows` = SELURUH foto (semua waktu) — count,
 * firstDayKey & journeyDays sepanjang masa; daftar dipotong PHOTO_LIST_MAX.
 */
export function buildPhotosPayload(
  rows: GymPhotoRowInput[],
  opts: { todayYmd: string; latestWeightKg: number | null },
): GymPhotosPayload {
  const sorted = [...rows].sort(byNewestFirst);
  const photos = sorted.slice(0, PHOTO_LIST_MAX).map(toRow);

  const latestByPose = {} as Record<GymPhotoPose, GymPhotoRow | null>;
  for (const pose of GYM_PHOTO_POSES) {
    latestByPose[pose] = null;
  }
  for (const raw of sorted) {
    const row = toRow(raw);
    if (latestByPose[row.pose] === null) latestByPose[row.pose] = row;
  }

  const firstDayKey = sorted.length > 0 ? sorted[sorted.length - 1].dayKey : null;
  const lastDayKey = sorted.length > 0 ? sorted[0].dayKey : null;
  const journeyDays =
    firstDayKey !== null && lastDayKey !== null ? Math.max(0, dayDiffYmd(firstDayKey, lastDayKey)) : null;

  return {
    todayYmd: opts.todayYmd,
    photos,
    count: sorted.length,
    latestByPose,
    firstDayKey,
    journeyDays,
    latestWeightKg: opts.latestWeightKg,
  };
}
