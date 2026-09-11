// GET/POST /api/finance/sources — sumber dana + saldo terhitung.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  asNumber,
  asString,
  badRequest,
  computeSourceBalances,
  handleApiError,
  readJsonBody,
  requireNonEmptyString,
} from '@/app/api/_lib/api-utils';

export const dynamic = 'force-dynamic';

const SOURCE_TYPES = new Set(['cash', 'bank', 'ewallet']);

// SEED-FRESH-SOURCES (Task 30, BUG-FIN-1): pada instalasi baru (belum ada
// FundSource DAN belum ada Transaction) UI transaksi menampilkan FALLBACK_SOURCES
// (Kas/Bank/E-Wallet) — tapi backend menolaknya: POST transaksi resolve sumber
// by-ID/by-name terhadap tabel → 400 "Sumber dana tidak ditemukan". Opsi yang
// ditawarkan UI harus selalu bisa disimpan, jadi seed trio default SEKALI saat
// GET pertama pada app yang benar-benar baru. App dengan transaksi existing
// tidak di-seed (hormati kondisi user yang menghapus semua sumbernya).
const DEFAULT_SOURCES = [
  { name: 'Kas', emoji: '👛', type: 'cash', sortOrder: 0 },
  { name: 'Bank', emoji: '🏦', type: 'bank', sortOrder: 1 },
  { name: 'E-Wallet', emoji: '📱', type: 'ewallet', sortOrder: 2 },
] as const;

let seedInFlight: Promise<unknown> | null = null;

async function seedDefaultSourcesIfFresh(): Promise<void> {
  if (seedInFlight) return seedInFlight as Promise<void>;
  seedInFlight = (async () => {
    const [sourceCount, txCount] = await Promise.all([
      db.fundSource.count(),
      db.transaction.count(),
    ]);
    if (sourceCount > 0 || txCount > 0) return;
    // createMany + skipDuplicates tidak didukung konsisten di SQLite; 3 create
    // sekuensial cukup (terlindung seedInFlight per-instance + cek count di
    // atas; duplikat ekstrem masih bisa dihapus user lewat manajemen sumber).
    for (const s of DEFAULT_SOURCES) {
      await db.fundSource.create({ data: { ...s } });
    }
  })();
  try {
    await seedInFlight;
  } catch (error) {
    seedInFlight = null; // boleh dicoba lagi pada request berikutnya
    throw error;
  }
}

export async function GET() {
  try {
    await seedDefaultSourcesIfFresh();
    const [sources, allTx] = await Promise.all([
      db.fundSource.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      db.transaction.findMany({
        select: { id: true, type: true, amount: true, sourceId: true, transferPairId: true, category: true },
      }),
    ]);
    const balances = computeSourceBalances(sources, allTx);
    const payload = sources.map((s) => ({
      ...s,
      balance: Math.round((balances.get(s.id) ?? s.initialBalance) * 100) / 100,
    }));
    return NextResponse.json({ sources: payload });
  } catch (error) {
    return handleApiError(error, 'finance/sources:GET');
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);
    const name = requireNonEmptyString(body.name, 'Nama sumber dana wajib diisi');
    if (name.length > 80) throw badRequest('Nama sumber dana terlalu panjang');

    const emoji = asString(body.emoji);
    if (emoji !== null && emoji.length > 16) throw badRequest('Emoji tidak valid');

    const type = asString(body.type) ?? 'bank';
    if (!SOURCE_TYPES.has(type)) throw badRequest('Tipe sumber dana tidak valid (cash, bank, atau ewallet)');

    const initialBalance = asNumber(body.initialBalance);
    if (initialBalance !== null && (initialBalance < -1e12 || initialBalance > 1e12)) {
      throw badRequest('Saldo awal tidak valid');
    }

    const sortOrder = asNumber(body.sortOrder);
    if (sortOrder !== null && !Number.isInteger(sortOrder)) throw badRequest('Urutan tidak valid');

    const data: Record<string, unknown> = { name, type };
    if (emoji !== null && emoji.trim()) data.emoji = emoji.trim();
    if (initialBalance !== null) data.initialBalance = initialBalance;
    if (sortOrder !== null) data.sortOrder = sortOrder;

    const source = await db.fundSource.create({
      data: data as Parameters<typeof db.fundSource.create>[0]['data'],
    });
    return NextResponse.json({ ...source, balance: source.initialBalance }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'finance/sources:POST');
  }
}
