// GET/PUT /api/settings — AppSettings singleton (partial-safe).
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

export const dynamic = 'force-dynamic';

const THEMES = new Set(['light', 'dark', 'system']);

async function getOrCreateSettings() {
  const existing = await db.appSettings.findUnique({ where: { id: 'singleton' } });
  if (existing) return existing;
  return db.appSettings.create({ data: { id: 'singleton' } });
}

export async function GET() {
  try {
    const settings = await getOrCreateSettings();
    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error, 'settings:GET');
  }
}

export async function PUT(req: Request) {
  try {
    const body = await readJsonBody(req);
    const data: Record<string, unknown> = {};

    if ('userName' in body) {
      const userName = asString(body.userName);
      if (userName === null || !userName.trim() || userName.trim().length > 60) {
        throw badRequest('Nama pengguna tidak valid');
      }
      data.userName = userName.trim();
    }
    if ('theme' in body) {
      const theme = asString(body.theme);
      if (theme === null || !THEMES.has(theme)) {
        throw badRequest('Tema tidak valid (light, dark, atau system)');
      }
      data.theme = theme;
    }
    if ('themeColor' in body) {
      const themeColor = asString(body.themeColor);
      if (themeColor === null || !themeColor.trim() || themeColor.trim().length > 40) {
        throw badRequest('Warna tema tidak valid');
      }
      data.themeColor = themeColor.trim();
    }
    if ('weekStart' in body) {
      const weekStart = asNumber(body.weekStart);
      if (weekStart === null || !Number.isInteger(weekStart) || (weekStart !== 0 && weekStart !== 1)) {
        throw badRequest('Awal minggu tidak valid (0 = Minggu, 1 = Senin)');
      }
      data.weekStart = weekStart;
    }
    if ('language' in body) {
      const language = asString(body.language);
      if (language === null || language.trim().length > 10) {
        throw badRequest('Bahasa tidak valid');
      }
      data.language = language.trim() || 'id';
    }
    if ('targetCompletion' in body) {
      const target = asNumber(body.targetCompletion);
      if (target === null) throw badRequest('Target penyelesaian tidak valid');
      data.targetCompletion = Math.round(clamp(target, 0, 100));
    }

    if (Object.keys(data).length === 0) {
      throw badRequest('Tidak ada field yang bisa diperbarui');
    }

    const settings = await db.appSettings.upsert({
      where: { id: 'singleton' },
      update: data,
      create: { id: 'singleton', ...data },
    });
    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error, 'settings:PUT');
  }
}
