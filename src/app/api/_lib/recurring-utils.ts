// Helper recurring: validasi field + tanggal tengah malam Jakarta (+07:00).
import { db } from '@/lib/db';
import { asBool, asNumber, asString, badRequest } from '@/app/api/_lib/api-utils';
import { isValidYMD } from '@/lib/timezone';

const RT_TYPES = new Set(['income', 'expense']);
const FREQUENCIES = new Set(['daily', 'weekly', 'monthly']);

export function jakartaMidnight(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 7 * 3_600_000);
}

/** Parse field recurring; mode 'create' → field inti wajib, 'update' → partial. */
export async function parseRecurringFields(
  body: Record<string, unknown>,
  mode: 'create' | 'update',
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {};

  if (mode === 'create' || 'name' in body) {
    const name = asString(body.name);
    if (name === null || !name.trim() || name.trim().length > 120) {
      throw badRequest('Nama transaksi berulang wajib diisi');
    }
    data.name = name.trim();
  }
  if (mode === 'create' || 'amount' in body) {
    const amount = asNumber(body.amount);
    if (amount === null || amount <= 0 || amount > 1e12) throw badRequest('Jumlah tidak valid');
    data.amount = amount;
  }
  if (mode === 'create' || 'type' in body) {
    const type = asString(body.type);
    if (type === null || !RT_TYPES.has(type)) {
      throw badRequest('Tipe tidak valid (income atau expense)');
    }
    data.type = type;
  }
  if (mode === 'create' || 'category' in body) {
    const category = asString(body.category);
    if (category === null || !category.trim() || category.trim().length > 80) {
      throw badRequest('Kategori tidak valid');
    }
    data.category = category.trim();
  }
  if ('sourceId' in body) {
    const raw = body.sourceId;
    if (raw === undefined || raw === null || raw === '') {
      data.sourceId = null;
    } else {
      const sourceId = asString(raw);
      if (sourceId === null || !sourceId.trim()) throw badRequest('Sumber dana tidak valid');
      const src = await db.fundSource.findUnique({ where: { id: sourceId }, select: { id: true } });
      if (!src) throw badRequest('Sumber dana tidak ditemukan');
      data.sourceId = sourceId;
    }
  }
  if (mode === 'create' || 'frequency' in body) {
    const frequency = asString(body.frequency);
    if (frequency === null || !FREQUENCIES.has(frequency)) {
      throw badRequest('Frekuensi tidak valid (daily, weekly, atau monthly)');
    }
    data.frequency = frequency;
  }
  if (mode === 'create' || 'startDate' in body) {
    const raw = body.startDate;
    const startDate = asString(raw);
    if (startDate === null || !isValidYMD(startDate)) {
      throw badRequest('Tanggal mulai tidak valid (yyyy-MM-dd)');
    }
    data.startDate = jakartaMidnight(startDate);
  }
  if ('endDate' in body) {
    if (body.endDate === null || body.endDate === '') {
      data.endDate = null;
    } else {
      const endDate = asString(body.endDate);
      if (endDate === null || !isValidYMD(endDate)) {
        throw badRequest('Tanggal berakhir tidak valid (yyyy-MM-dd)');
      }
      data.endDate = jakartaMidnight(endDate);
    }
  }
  if ('isActive' in body) {
    const isActive = asBool(body.isActive);
    if (isActive === null) throw badRequest('Nilai isActive tidak valid');
    data.isActive = isActive;
  }

  if (mode === 'create') {
    if (data.endDate !== undefined && data.endDate !== null && data.startDate !== undefined) {
      if ((data.endDate as Date).getTime() < (data.startDate as Date).getTime()) {
        throw badRequest('Tanggal berakhir tidak boleh sebelum tanggal mulai');
      }
    }
  }

  return data;
}
