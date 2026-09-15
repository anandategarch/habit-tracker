// GET/PUT/POST /api/daily-logs — log harian mood/energi/tidur/catatan.
// GET  ?date=yyyy-MM-dd → DailyLog | null ; ?month=yyyy-MM → { logs } ; ?all=true → { logs }.
// PUT/POST (alias) { date, mood?, energy?, sleep?, notes? } → upsert PARTIAL:
// menyimpan notes saja TIDAK me-reset mood/energi/tidur.
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
import { dateFromYMD, isValidMonth, isValidYMD, jakartaDateString, monthRangeYMD } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const date = params.get('date');
    const month = params.get('month');
    const all = params.get('all');

    if (date !== null) {
      if (!isValidYMD(date)) throw badRequest('Format tanggal tidak valid (yyyy-MM-dd)');
      const log = await db.dailyLog.findUnique({ where: { date: dateFromYMD(date) } });
      return NextResponse.json(log ?? null);
    }
    if (month !== null) {
      if (!isValidMonth(month)) throw badRequest('Parameter month tidak valid (format yyyy-MM)');
      const { start, end } = monthRangeYMD(month);
      const logs = await db.dailyLog.findMany({
        where: { date: { gte: start, lte: end } },
        orderBy: { date: 'asc' },
      });
      return NextResponse.json({ logs });
    }
    if (all === 'true') {
      const logs = await db.dailyLog.findMany({ orderBy: { date: 'asc' } });
      return NextResponse.json({ logs });
    }
    // Default: hari ini (Jakarta).
    const today = jakartaDateString();
    const log = await db.dailyLog.findUnique({ where: { date: dateFromYMD(today) } });
    return NextResponse.json(log ?? null);
  } catch (error) {
    return handleApiError(error, 'daily-logs:GET');
  }
}

async function upsertDailyLog(req: Request) {
  const body = await readJsonBody(req);
  const date = asString(body.date);
  if (!date || !isValidYMD(date)) throw badRequest('Format tanggal tidak valid (yyyy-MM-dd)');

  const update: Record<string, unknown> = {};
  const create: Record<string, unknown> = { date: dateFromYMD(date) };

  if ('mood' in body && body.mood !== undefined && body.mood !== null) {
    const mood = asNumber(body.mood);
    if (mood === null) throw badRequest('Nilai mood tidak valid');
    update.mood = clamp(mood, 1, 5);
    create.mood = update.mood;
  }
  if ('energy' in body && body.energy !== undefined && body.energy !== null) {
    const energy = asNumber(body.energy);
    if (energy === null) throw badRequest('Nilai energi tidak valid');
    update.energy = clamp(energy, 1, 5);
    create.energy = update.energy;
  }
  if ('sleep' in body && body.sleep !== undefined && body.sleep !== null) {
    const sleep = asNumber(body.sleep);
    if (sleep === null) throw badRequest('Nilai tidur tidak valid');
    update.sleep = clamp(sleep, 0, 24);
    create.sleep = update.sleep;
  }
  if ('notes' in body && body.notes !== undefined) {
    // Task 60-b (audit 59-b5): field teks opsional non-string dulunya
    // disimpan senyap sebagai null (menghapus catatan lama bila dipanggil
    // via API langsung) — kini ditolak 400. Null/string tetap diterima.
    if (body.notes !== null && typeof body.notes !== 'string') {
      throw badRequest('Catatan harus berupa teks');
    }
    const notes = asString(body.notes);
    if (notes !== null && notes.length > 10_000) throw badRequest('Catatan terlalu panjang');
    update.notes = notes ?? null;
    create.notes = update.notes;
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
}

export async function PUT(req: Request) {
  try {
    return await upsertDailyLog(req);
  } catch (error) {
    return handleApiError(error, 'daily-logs:PUT');
  }
}

// Alias POST — kompatibilitasi autosave catatan dari client lama.
export async function POST(req: Request) {
  try {
    return await upsertDailyLog(req);
  } catch (error) {
    return handleApiError(error, 'daily-logs:POST');
  }
}
