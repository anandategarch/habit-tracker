// POST /api/finance/transactions/split
// Dua mode (atomik):
//  1. { baseId, rows: [{category, amount}] } → pecah 1 transaksi EXISTING
//     menjadi N transaksi lalu hapus base.
//  2. { splits: [{category, amount}], date, source?, description?, type? }
//     → buat N transaksi BARU dari form split (mode "Split" dialog tambah
//     transaksi — belum ada transaksi base).
// Response: { created: n }.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  asNumber,
  asString,
  badRequest,
  handleApiError,
  notFound,
  readJsonBody,
  transactionDate,
} from '@/app/api/_lib/api-utils';
import { ensureTransactionGroupId } from '@/app/api/_lib/transaction-ensure';
import { resolveDateAndTime } from '@/app/api/_lib/finance-fields';
import { dateFromYMDNoon, isValidYMD } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

interface SplitRow {
  category: string;
  amount: number;
}

function parseRows(raw: unknown, min: number): SplitRow[] {
  if (!Array.isArray(raw) || raw.length < min) {
    throw badRequest(`Minimal ${min} baris untuk split`);
  }
  if (raw.length > 50) throw badRequest('Maksimal 50 baris split');
  return raw.map((row, i) => {
    if (typeof row !== 'object' || row === null) throw badRequest(`Baris ke-${i + 1} tidak valid`);
    const rec = row as Record<string, unknown>;
    const category = asString(rec.category);
    if (category === null || !category.trim() || category.trim().length > 80) {
      throw badRequest(`Kategori baris ke-${i + 1} tidak valid`);
    }
    const amount = asNumber(rec.amount);
    // Cap 1e12 — selaras validasi transactions route (guard nominal tak masuk akal).
    if (amount === null || amount <= 0 || amount > 1e12) {
      throw badRequest(`Jumlah baris ke-${i + 1} tidak valid`);
    }
    return { category: category.trim(), amount: Math.round(amount * 100) / 100 };
  });
}

export async function POST(req: Request) {
  try {
    // Task 60-f: kolom groupId (badge "Split") via DDL runtime idempoten —
    // no-op lokal (db push), ALTER TABLE saat pertama di Turso produksi.
    await ensureTransactionGroupId();
    const body = await readJsonBody(req);

    // ── Mode 1: split transaksi existing ─────────────────────────────────
    const baseId = asString(body.baseId);
    if (baseId && baseId.trim()) {
      const base = await db.transaction.findUnique({ where: { id: baseId.trim() } });
      if (!base) throw notFound('Transaksi tidak ditemukan');
      if (base.type === 'transfer') throw badRequest('Transaksi transfer tidak bisa dipecah');

      const parsed = parseRows(body.rows, 2);
      // Task 60-f: satu groupId dibagi ke seluruh baris pecahan supaya
      // daftar transaksi bisa menampilkan badge "Split" (satu pembayaran
      // yang dipecah ke beberapa kategori — dulu nilainya tidak pernah ada).
      const groupId = crypto.randomUUID();

      await db.$transaction(async (tx) => {
        await tx.transaction.createMany({
          data: parsed.map((p) => ({
            type: base.type,
            amount: p.amount,
            category: p.category,
            sourceId: base.sourceId,
            description: base.description,
            notes: base.notes,
            tags: base.tags,
            date: base.date,
            groupId,
          })),
        });
        await tx.transaction.delete({ where: { id: base.id } });
      });
      return NextResponse.json({ created: parsed.length });
    }

    // ── Mode 2: buat N transaksi baru dari form split ────────────────────
    const rowsRaw = Array.isArray(body.splits) ? body.splits : body.rows;
    const parsed = parseRows(rowsRaw, 2);

    // Tanggal: 'yyyy-MM-dd' string → 12:00Z; ISO penuh (form split mengirim
    // toISOString +07:00) → dikonversi ke KONVENSI STORAGE (komponen UTC =
    // jam dinding Jakarta) via resolveDateAndTime — sama seperti route
    // transactions. Tanpa ini transaksi split tersimpan sebagai epoch mentah
    // (−7 jam) sehingga tampil salah jam & bisa bergeser hari.
    let date: Date;
    const rawDate = asString(body.date);
    if (rawDate && isValidYMD(rawDate)) {
      date = dateFromYMDNoon(rawDate);
    } else if (rawDate && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(rawDate)) {
      const resolved = resolveDateAndTime(rawDate, undefined);
      if (!resolved) throw badRequest('Tanggal tidak valid');
      date = transactionDate(resolved.ymd, resolved.time);
    } else if (rawDate) {
      const probe = new Date(rawDate);
      if (Number.isNaN(probe.getTime())) throw badRequest('Tanggal tidak valid');
      date = probe;
    } else {
      date = dateFromYMDNoon(new Date().toISOString().slice(0, 10));
    }

    const sourceId = asString(body.source) || asString(body.sourceId);
    const description = asString(body.description) ?? 'Transaksi split';
    const type = asString(body.type) === 'income' ? 'income' : 'expense';

    // Validasi sumber hanya bila dikirim (bisa id atau nama) — resolve by-ID
    // lalu by-name. Tidak ditemukan → 400 jelas (bukan silent null yang
    // menyimpan transaksi tanpa sumber tanpa sepengetahuan user).
    let resolvedSourceId: string | null = null;
    if (sourceId && sourceId.trim()) {
      const key = sourceId.trim();
      const byId = await db.fundSource.findUnique({ where: { id: key }, select: { id: true } });
      const found = byId ?? (await db.fundSource.findFirst({ where: { name: key }, select: { id: true } }));
      if (!found) throw badRequest('Sumber dana tidak ditemukan');
      resolvedSourceId = found.id;
    }

    // Task 60-f: satu groupId untuk seluruh baris hasil pecahan (badge Split).
    const groupId = crypto.randomUUID();
    await db.transaction.createMany({
      data: parsed.map((p) => ({
        type,
        amount: p.amount,
        category: p.category,
        sourceId: resolvedSourceId,
        description,
        date,
        groupId,
      })),
    });
    return NextResponse.json({ created: parsed.length });
  } catch (error) {
    return handleApiError(error, 'finance/transactions/split:POST');
  }
}
