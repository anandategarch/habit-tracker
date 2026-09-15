// PUT/DELETE/PATCH /api/finance/sources/[id] — CRUD sumber dana.
// PATCH (body {balance}) menyetel saldo dengan menggeser initialBalance —
// tidak membuat transaksi penyesuaian.
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import {
  asBool,
  asNumber,
  asString,
  badRequest,
  computeSourceBalances,
  handleApiError,
  notFound,
  readJsonBody,
  requireNonEmptyString,
} from '@/app/api/_lib/api-utils';

export const dynamic = 'force-dynamic';

const SOURCE_TYPES = new Set(['cash', 'bank', 'ewallet']);

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const source = await db.fundSource.findUnique({ where: { id } });
    if (!source) throw notFound('Sumber dana tidak ditemukan');

    const body = await readJsonBody(req);
    const data: Record<string, unknown> = {};

    if ('name' in body) {
      const name = requireNonEmptyString(body.name, 'Nama sumber dana wajib diisi');
      if (name.length > 80) throw badRequest('Nama sumber dana terlalu panjang');
      data.name = name;
    }
    if ('emoji' in body) {
      const emoji = asString(body.emoji);
      if (emoji === null || !emoji.trim() || emoji.length > 16) throw badRequest('Emoji tidak valid');
      data.emoji = emoji.trim();
    }
    if ('type' in body) {
      const type = asString(body.type);
      if (type === null || !SOURCE_TYPES.has(type)) {
        throw badRequest('Tipe sumber dana tidak valid (cash, bank, atau ewallet)');
      }
      data.type = type;
    }
    if ('initialBalance' in body) {
      const initialBalance = asNumber(body.initialBalance);
      if (initialBalance === null || initialBalance < -1e12 || initialBalance > 1e12) {
        throw badRequest('Saldo awal tidak valid');
      }
      data.initialBalance = initialBalance;
    }
    if ('isArchived' in body) {
      const isArchived = asBool(body.isArchived);
      if (isArchived === null) throw badRequest('Nilai isArchived tidak valid');
      data.isArchived = isArchived;
    }
    if ('sortOrder' in body) {
      const sortOrder = asNumber(body.sortOrder);
      if (sortOrder === null || !Number.isInteger(sortOrder)) throw badRequest('Urutan tidak valid');
      data.sortOrder = sortOrder;
    }

    if (Object.keys(data).length === 0) throw badRequest('Tidak ada field yang bisa diperbarui');

    const updated = await db.fundSource.update({ where: { id }, data });
    // Task 61-h (audit 61-c P3-7): POST mengembalikan {...source, balance} —
    // PUT kini ikut menyertakan saldo terhitung (field ADDITIF, klien lama
    // mengabaikannya). Dihitung dengan fungsi yang sama dengan GET/PATCH.
    const [sources, txs] = await Promise.all([
      db.fundSource.findMany({ select: { id: true, initialBalance: true } }),
      db.transaction.findMany({
        where: { sourceId: id },
        select: { id: true, type: true, amount: true, sourceId: true, transferPairId: true, category: true },
      }),
    ]);
    const balances = computeSourceBalances(sources, txs);
    return NextResponse.json({
      ...updated,
      balance: Math.round((balances.get(id) ?? updated.initialBalance) * 100) / 100,
    });
  } catch (error) {
    return handleApiError(error, 'finance/sources/[id]:PUT');
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const source = await db.fundSource.findUnique({ where: { id }, select: { id: true } });
    if (!source) throw notFound('Sumber dana tidak ditemukan');
    // Transaction.sourceId → onDelete: SetNull (transaksi tetap tersimpan).
    await db.fundSource.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'finance/sources/[id]:DELETE');
  }
}

/**
 * PATCH — kompatibilitas quick-edit saldo: { balance }.
 * Saldo dihitung dari transaksi; setelah PATCH, initialBalance digeser sehingga
 * saldo terhitung = nilai baru. Tidak ada transaksi penyesuaian yang dibuat.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const source = await db.fundSource.findUnique({ where: { id } });
    if (!source) throw notFound('Sumber dana tidak ditemukan');

    const body = await readJsonBody(req);
    const target = asNumber(body.balance);
    if (target === null || target < -1e12 || target > 1e12) throw badRequest('Saldo tidak valid');

    // H4: hitung net transaksi dengan FUNGSI YANG SAMA dengan GET
    // (computeSourceBalances + buildTransferMeta). Perhitungan manual lama
    // memakai kategori 'Transfer Masuk' hardcoded — pasangan transfer legacy
    // (tanpa kategori itu, arah hanya dari penunjukan transferPairId)
    // terhitung keluar sehingga saldo bergeser.
    // Task 61-h (audit 61-c P2-4): baca (sumber + transaksi) & tulis kini
    // dalam SATU interactive $transaction (pola 60-b savings-goals/[id]) —
    // dulunya read-modify-write terpisah → dua PATCH bersamaan saling
    // menimpa (lost update). Bentuk response TIDAK berubah.
    const updated = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const fresh = await tx.fundSource.findUnique({ where: { id } });
      if (!fresh) return null;
      const sources = await tx.fundSource.findMany({ select: { id: true, initialBalance: true } });
      const txs = await tx.transaction.findMany({
        where: { sourceId: id },
        select: { id: true, type: true, amount: true, sourceId: true, transferPairId: true, category: true },
      });
      const balances = computeSourceBalances(sources, txs);
      const net = (balances.get(id) ?? fresh.initialBalance) - fresh.initialBalance;
      const newInitial = Math.round((target - net) * 100) / 100;
      return tx.fundSource.update({ where: { id }, data: { initialBalance: newInitial } });
    });
    if (updated === null) throw notFound('Sumber dana tidak ditemukan');
    return NextResponse.json({ ...updated, balance: target, adjustment: null });
  } catch (error) {
    return handleApiError(error, 'finance/sources/[id]:PATCH');
  }
}
