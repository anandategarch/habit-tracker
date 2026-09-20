// ---------------------------------------------------------------------------
// GET    /api/gym/program — program latihan (Task 75 F4): program aktif
//                            (hari ini, strip minggu, adherence, minggu ke-N)
//                            + daftar program tersimpan. Progres hari latihan
//                            MURNI dibaca dari HabitLog habit zona (prinsip
//                            Peta Otot — tidak ada kalkulasi XP baru).
// POST   /api/gym/program — buat program { name, emoji?, days } + AKTIFKAN
//                            (transaksi: satu-satunya aktif; startedAt = now).
//                            Dipakai untuk custom build maupun menyalin preset.
// PUT    /api/gym/program — ubah program tersimpan { id, name, emoji, days }
//                            (isActive/startedAt tak disentuh — program aktif
//                            ikut berubah live, minggu ke-N tetap).
// PATCH  /api/gym/program — { id } aktifkan program (switch — minggu ke-1
//                            baru), atau { action: 'stop' } hentikan program.
// DELETE /api/gym/program?id=… — hapus program tersimpan (bila aktif, otomatis
//                            tidak ada program aktif setelahnya).
//
// Validasi memakai validateProgramInput() yang SAMA dengan klien; daysJson
// diparse defensif di GET (baris rusak di-skip, tidak pernah 500).
// ---------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { asString, badRequest, handleApiError, notFound, readJsonBody } from '@/app/api/_lib/api-utils';
import { ensureGymProgramTable } from '@/app/api/_lib/gym-program-ensure';
import { dateFromYMD, jakartaDateString } from '@/lib/timezone';
import { shiftYmd } from '@/lib/dashboard-helpers';
import {
  MUSCLE_ZONE_DEFS,
  computeProgramPayload,
  parseProgramDays,
  validateProgramInput,
  type GymProgramPayload,
  type GymProgramSaved,
  type MuscleZoneKey,
  type ProgramDayInput,
} from '@/lib/muscle-map';

export const dynamic = 'force-dynamic';

/** Bentuk primitif baris Prisma GymProgram. */
interface ProgramRow {
  id: string;
  name: string;
  emoji: string;
  daysJson: string;
  isActive: boolean;
  startedAt: Date | null;
  updatedAt: Date;
}

function ymdOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Konversi baris → GymProgramSaved; null bila daysJson rusak (di-skip). */
function toSaved(r: ProgramRow): GymProgramSaved | null {
  const days = parseProgramDays(r.daysJson);
  if (!days) return null;
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    days,
    isActive: r.isActive,
    // Audit 77 (MAJOR): dulu dikirim ISO lalu di-slice(0,10) konsumen →
    // tanggal UTC, meleset 1 hari pada 00:00–06:59 WIB (server UTC):
    // "Minggu ke-N" melompat & hari pra-aktivasi dihitung terlewat.
    // Kirim YMD JAKARTA langsung — tanggal aktivasi yang dimaksud user.
    startedAt: r.startedAt ? jakartaDateString(r.startedAt) : null,
    updatedAt: (r.updatedAt as Date).toISOString(),
  };
}

/** YMD awal minggu berjalan sesuai weekStart pengaturan (0=Minggu, 1=Senin). */
function weekStartYmdOf(ymd: string, weekStart: number): string {
  const dow = dateFromYMD(ymd).getUTCDay(); // 0=Minggu .. 6=Sabtu
  const diff = (dow - weekStart + 7) % 7;
  return shiftYmd(ymd, -diff);
}

/**
 * Peta ymd → set zona yang selesai hari itu (minggu berjalan). Sesi Full
 * Body menyumbang ke SEMUA zona (konsisten fullBodyContrib mesin misi).
 * Murni baca HabitLog — tidak ada penulisan.
 */
async function buildZoneDoneByYmd(weekStartY: string): Promise<Map<string, Set<MuscleZoneKey>>> {
  const zoneHabits = await db.habit.findMany({
    where: { muscleZone: { not: null }, isArchived: false },
    orderBy: { createdAt: 'asc' },
    select: { id: true, muscleZone: true },
  });
  // Habit PERTAMA per zona (createdAt terlama — deterministik), SAMA persis
  // dengan resolusi GET /api/gym (audit 70-c). Audit 77: dulu semua habit
  // zona dihitung (cek has(h.id) selalu true) → habit zona dobel membuat
  // chip ✅ program dan toggle Peta Otot saling bertentangan.
  const habitZone = new Map<string, MuscleZoneKey>();
  const seenZone = new Set<MuscleZoneKey>();
  for (const h of zoneHabits) {
    const zone = h.muscleZone as MuscleZoneKey;
    if (seenZone.has(zone)) continue;
    seenZone.add(zone);
    habitZone.set(h.id, zone);
  }

  const result = new Map<string, Set<MuscleZoneKey>>();
  if (habitZone.size === 0) return result;

  const logs = await db.habitLog.findMany({
    where: {
      habitId: { in: [...habitZone.keys()] },
      completed: true,
      date: { gte: dateFromYMD(weekStartY) },
    },
    select: { habitId: true, date: true },
  });
  const add = (ymd: string, zone: MuscleZoneKey) => {
    const set = result.get(ymd) ?? new Set<MuscleZoneKey>();
    set.add(zone);
    result.set(ymd, set);
  };
  for (const l of logs) {
    const zone = habitZone.get(l.habitId);
    if (!zone) continue;
    const ymd = ymdOf(l.date as Date);
    if (zone === 'fullbody') {
      for (const def of MUSCLE_ZONE_DEFS) add(ymd, def.key);
    } else {
      add(ymd, zone);
    }
  }
  return result;
}

export async function GET() {
  try {
    await ensureGymProgramTable();

    const settings = await db.appSettings.findUnique({ where: { id: 'singleton' } });
    const weekStart = settings?.weekStart === 0 ? 0 : 1;
    const todayYmd = jakartaDateString();
    const weekStartY = weekStartYmdOf(todayYmd, weekStart);
    const weekStartDow = dateFromYMD(weekStartY).getUTCDay();

    const rows = await db.gymProgram.findMany({ orderBy: { updatedAt: 'asc' } });
    // Audit 77-a: baris daysJson rusak SELAMA ini hilang senyap — termasuk
    // yang isActive (tak terlihat/diubah/dihapus dari UI). Tetap di-skip
    // (GET tak boleh 500), tapi sekarang ter-log untuk diagnosis.
    const saved: GymProgramSaved[] = [];
    for (const r of rows) {
      const s = toSaved(r);
      if (!s) {
        console.warn(`[gym/program] daysJson rusak — baris "${r.name}" (${r.id}) dilewati`);
        continue;
      }
      saved.push(s);
    }

    // Batasi query log ke minggu berjalan saja (payload hanya butuh itu).
    const zoneDoneByYmd = await buildZoneDoneByYmd(weekStartY);

    const payload: GymProgramPayload = computeProgramPayload({
      saved,
      zoneDoneByYmd,
      todayYmd,
      weekStartYmd: weekStartY,
      weekStartDow,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return handleApiError(error, 'gym/program:GET');
  }
}

/** Ambil array hari dari body (validasi bentuk ada di validateProgramInput). */
function daysFromBody(body: Record<string, unknown>): ProgramDayInput[] {
  const raw = body.days;
  if (!Array.isArray(raw)) return [];
  return raw as ProgramDayInput[];
}

export async function POST(req: Request) {
  try {
    await ensureGymProgramTable();

    const body = await readJsonBody(req);
    const validated = validateProgramInput({
      name: asString(body.name) ?? '',
      emoji: asString(body.emoji) ?? '',
      days: daysFromBody(body),
    });
    if (!validated.ok) throw badRequest(validated.error);
    const { name, emoji, days } = validated;

    // Buat + aktifkan dalam SATU transaksi: pastikan maksimal satu aktif
    // (pola CAS audit 70-c — dua POST paralel tidak boleh menghasilkan dua
    // program aktif).
    const created = await db.$transaction(async (tx) => {
      await tx.gymProgram.updateMany({ where: { isActive: true }, data: { isActive: false } });
      return tx.gymProgram.create({
        data: {
          name,
          emoji,
          daysJson: JSON.stringify(days),
          isActive: true,
          startedAt: new Date(),
        },
      });
    });

    return NextResponse.json({ ok: true, id: created.id, name: created.name });
  } catch (error) {
    return handleApiError(error, 'gym/program:POST');
  }
}

export async function PUT(req: Request) {
  try {
    await ensureGymProgramTable();

    const body = await readJsonBody(req);
    const id = asString(body.id) ?? '';
    if (!id) throw badRequest('Parameter id wajib');

    const existing = await db.gymProgram.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw notFound('Program tidak ditemukan');

    const validated = validateProgramInput({
      name: asString(body.name) ?? '',
      emoji: asString(body.emoji) ?? '',
      days: daysFromBody(body),
    });
    if (!validated.ok) throw badRequest(validated.error);
    const { name, emoji, days } = validated;

    const updated = await db.gymProgram.update({
      where: { id },
      data: { name, emoji, daysJson: JSON.stringify(days) },
    });
    return NextResponse.json({ ok: true, id: updated.id, name: updated.name });
  } catch (error) {
    return handleApiError(error, 'gym/program:PUT');
  }
}

export async function PATCH(req: Request) {
  try {
    await ensureGymProgramTable();

    const body = await readJsonBody(req);
    const action = asString(body.action) ?? '';

    if (action === 'stop') {
      // Hentikan program aktif (tanpa menghapus baris — bisa diaktifkan lagi).
      const res = await db.gymProgram.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
      return NextResponse.json({ ok: true, stopped: res.count > 0 });
    }

    // Default: aktifkan program id (switch — minggu ke-1 dimulai ulang).
    const id = asString(body.id) ?? '';
    if (!id) throw badRequest('Parameter id wajib (atau action "stop")');
    const existing = await db.gymProgram.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!existing) throw notFound('Program tidak ditemukan');

    await db.$transaction(async (tx) => {
      await tx.gymProgram.updateMany({ where: { isActive: true }, data: { isActive: false } });
      await tx.gymProgram.update({ where: { id }, data: { isActive: true, startedAt: new Date() } });
    });
    return NextResponse.json({ ok: true, id, name: existing.name });
  } catch (error) {
    return handleApiError(error, 'gym/program:PATCH');
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureGymProgramTable();

    const id = new URL(req.url).searchParams.get('id') ?? '';
    if (!id) throw badRequest('Parameter id wajib');
    const existing = await db.gymProgram.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!existing) throw notFound('Program tidak ditemukan');

    await db.gymProgram.delete({ where: { id } });
    return NextResponse.json({ ok: true, wasActive: existing.isActive });
  } catch (error) {
    return handleApiError(error, 'gym/program:DELETE');
  }
}
