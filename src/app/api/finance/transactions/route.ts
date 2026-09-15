// GET/POST /api/finance/transactions — daftar + filter bulan/tipe/kategori/search.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  badRequest,
  buildTransferMeta,
  handleApiError,
  readJsonBody,
  serializeTransaction,
  sourceInfoMap,
  transactionMonthRange,
} from '@/app/api/_lib/api-utils';
import { ensureTransactionGroupId } from '@/app/api/_lib/transaction-ensure';
import { parseTransactionFields } from '@/app/api/_lib/finance-fields';
import { isValidMonth, jakartaMonthString } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

const TYPE_FILTERS = new Set(['income', 'expense', 'transfer', 'all']);

export async function GET(req: Request) {
  try {
    // Task 60-f: findMany tanpa select membaca semua kolom (termasuk groupId
    // baru) — pastikan kolomnya ada di DB produksi (DDL idempoten).
    await ensureTransactionGroupId();
    const params = new URL(req.url).searchParams;
    const search = (params.get('search') ?? '').trim().toLowerCase();

    // Bulan: default bulan berjalan Jakarta. Bila mencari tanpa month → semua waktu.
    const monthParam = params.get('month');
    let month: string | null;
    if (monthParam === null) {
      month = search ? null : jakartaMonthString();
    } else if (isValidMonth(monthParam)) {
      month = monthParam;
    } else {
      throw badRequest('Parameter month tidak valid (format yyyy-MM)');
    }

    const type = params.get('type');
    if (type !== null && !TYPE_FILTERS.has(type)) {
      throw badRequest('Tipe transaksi tidak valid (income, expense, atau transfer)');
    }
    const category = params.get('category');
    const source = params.get('source');

    const limitParam = params.get('limit');
    let limit = 500;
    if (limitParam !== null && limitParam !== '') {
      const n = Number(limitParam);
      if (!Number.isInteger(n) || n < 1 || n > 2000) throw badRequest('Parameter limit tidak valid');
      limit = n;
    }

    const where: Record<string, unknown> = {};
    if (month) {
      const range = transactionMonthRange(month);
      where.date = { gte: range.gte, lt: range.lt };
    }
    if (type && type !== 'all') where.type = type;
    if (category && category !== 'all') where.category = category;
    if (source && source !== 'all') where.sourceId = source;

    const rows = await db.transaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    // BUGHUNT-47 (47-b #4): pencarian juga mencocokkan NAMA SUMBER DANA.
    // Filter instan di client (finance.tsx) membandingkan sourceName, tapi
    // server hanya memeriksa description/notes/tags/category → hasil
    // server∩client membuang match-sumber-saja: baris "BCA/Kas" sempat
    // muncul saat mengetik lalu HILANG setelah refetch debounced.
    // Task 60-f (audit 59-b3 LOW): SATU findMany FundSource (dulu dua kali
    // per request — untuk pencarian nama & untuk info sumber serialization).
    const sources = await db.fundSource.findMany();
    const sourceNameById = new Map(sources.map((s) => [s.id, s.name.toLowerCase()]));

    let filtered = rows;
    if (search) {
      filtered = rows.filter((r) =>
        [r.description, r.notes, r.tags, r.category].some((s) =>
          (s ?? '').toLowerCase().includes(search),
        ) || (r.sourceId ? (sourceNameById.get(r.sourceId) ?? '').includes(search) : false),
      );
    }

    const limited = filtered.slice(0, limit);
    const totalIncome = filtered.reduce((s, t) => s + (t.type === 'income' ? t.amount : 0), 0);
    const totalExpense = filtered.reduce((s, t) => s + (t.type === 'expense' ? t.amount : 0), 0);

    const meta = buildTransferMeta(rows.filter((r) => r.type === 'transfer'));
    const sourceMap = sourceInfoMap(sources);

    return NextResponse.json({
      transactions: limited.map((t) => serializeTransaction(t, sourceMap, meta)),
      totalIncome: Math.round(totalIncome),
      totalExpense: Math.round(totalExpense),
      // Task 60-f (audit 59-b3): kontrak jujur — totals dihitung dari SEMUA
      // hasil filter, sedangkan `transactions` dipotong `limit` (default 500):
      // truncated=true memberi tahu klien bahwa daftar tidak lengkap.
      truncated: filtered.length > limited.length,
    });
  } catch (error) {
    return handleApiError(error, 'finance/transactions:GET');
  }
}

export async function POST(req: Request) {
  try {
    // Task 60-f: serialize membaca baris penuh (groupId) — DDL idempoten.
    await ensureTransactionGroupId();
    const body = await readJsonBody(req);
    const data = await parseTransactionFields(body, 'create');
    const tx = await db.transaction.create({
      data: data as Parameters<typeof db.transaction.create>[0]['data'],
    });
    const sources = await db.fundSource.findMany();
    const meta = buildTransferMeta(tx.type === 'transfer' ? [tx] : []);
    return NextResponse.json(serializeTransaction(tx, sourceInfoMap(sources), meta), { status: 201 });
  } catch (error) {
    return handleApiError(error, 'finance/transactions:POST');
  }
}
