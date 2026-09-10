// Validasi field transaksi (POST /api/finance/transactions & PUT /[id]).
import { db } from '@/lib/db';
import { asNumber, asString, badRequest, transactionDate } from '@/app/api/_lib/api-utils';
import { isValidYMD, toJakarta } from '@/lib/timezone';
import type { Transaction as TxRow } from '@prisma/client';

export const TX_TYPES = new Set(['income', 'expense']);

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** tags bentuk apa pun (array / string koma) → string koma rapi. */
export function normalizeTags(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) {
    return v
      .map((t) => String(t).trim())
      .filter(Boolean)
      .join(',');
  }
  if (typeof v === 'string') return v.trim();
  return '';
}

/**
 * Resolve tanggal body: 'yyyy-MM-dd' (kontrak) atau ISO penuh (toleransi client
 * lama yang mengirim fullDate.toISOString()). ISO → YMD + jam dinding Jakarta.
 */
export function resolveDateAndTime(dateV: unknown, timeV: unknown): { ymd: string; time: unknown } | null {
  let ymd: string | null = null;
  let time = timeV;
  if (typeof dateV === 'string') {
    if (isValidYMD(dateV)) {
      ymd = dateV;
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dateV)) {
      const d = new Date(dateV);
      if (!Number.isNaN(d.getTime())) {
        const shifted = toJakarta(d);
        ymd = `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
        if (time === undefined || time === null || time === '') {
          time = `${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}`;
        }
      }
    }
  } else if (dateV instanceof Date && !Number.isNaN(dateV.getTime())) {
    const shifted = toJakarta(dateV);
    ymd = `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
    if (time === undefined || time === null || time === '') {
      time = `${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}`;
    }
  }
  if (!ymd) return null;
  return { ymd, time };
}

/**
 * Parse field transaksi. mode 'create' → field inti wajib; 'update' → partial.
 * `current` dipakai untuk guard edit transaksi transfer.
 */
export async function parseTransactionFields(
  body: Record<string, unknown>,
  mode: 'create' | 'update',
  current?: TxRow,
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {};

  if (current && current.type === 'transfer') {
    // Transfer hanya boleh diubah deskripsi/catatan/tags/tanggalnya.
    const allowed = ['description', 'notes', 'tags', 'date', 'time'];
    const attempted = Object.keys(body).filter((k) => !allowed.includes(k));
    if (attempted.length > 0) {
      throw badRequest('Transaksi transfer tidak bisa diubah jumlah/kategorinya — hapus dan buat ulang');
    }
  }

  if (mode === 'create' || 'type' in body) {
    const type = asString(body.type);
    if (type === null || !TX_TYPES.has(type)) {
      throw badRequest('Tipe transaksi tidak valid (income atau expense — transfer lewat endpoint transfer)');
    }
    if (current && current.type === 'transfer') {
      throw badRequest('Transaksi transfer tidak bisa diubah tipenya');
    }
    data.type = type;
  }

  if (mode === 'create' || 'amount' in body) {
    const amount = asNumber(body.amount);
    if (amount === null || amount <= 0 || amount > 1e12) throw badRequest('Jumlah transaksi tidak valid');
    data.amount = Math.round(amount * 100) / 100;
  }

  if (mode === 'create' || 'category' in body) {
    const category = asString(body.category);
    if (category === null || !category.trim() || category.trim().length > 80) {
      throw badRequest('Kategori tidak valid');
    }
    data.category = category.trim();
  }

  if (mode === 'create' || 'description' in body) {
    const description = asString(body.description);
    if (description !== null && description.length > 300) throw badRequest('Deskripsi terlalu panjang');
    data.description = description ?? '';
  }

  if ('notes' in body) {
    const notes = asString(body.notes);
    if (notes !== null && notes.length > 2000) throw badRequest('Catatan terlalu panjang');
    data.notes = notes ?? null;
  }

  if ('tags' in body) {
    data.tags = normalizeTags(body.tags);
  }

  if (mode === 'create' || 'sourceId' in body || 'source' in body) {
    const raw = body.sourceId !== undefined ? body.sourceId : body.source;
    if (raw === undefined || raw === null || raw === '') {
      data.sourceId = null;
    } else {
      const sourceRef = asString(raw);
      if (sourceRef === null || !sourceRef.trim()) throw badRequest('Sumber dana tidak valid');
      // H1: resolve by-ID LALU by-name (pola transactions/split route).
      // Dialog form mengirim NAMA sumber (`txForm.source`) — sebelumnya
      // resolve hanya by-ID sehingga setiap create/edit transaksi dari form
      // gagal 400 "Sumber dana tidak ditemukan".
      const key = sourceRef.trim();
      const byId = await db.fundSource.findUnique({ where: { id: key }, select: { id: true } });
      const resolved = byId?.id
        ?? (await db.fundSource.findFirst({ where: { name: key }, select: { id: true } }))?.id
        ?? null;
      if (!resolved) throw badRequest('Sumber dana tidak ditemukan');
      data.sourceId = resolved;
    }
  }

  if (mode === 'create' || 'date' in body) {
    const resolved = resolveDateAndTime(body.date, body.time);
    if (!resolved) throw badRequest('Format tanggal tidak valid (yyyy-MM-dd)');
    data.date = transactionDate(resolved.ymd, resolved.time);
  }

  return data;
}
