// POST /api/finance/recurring/[id]/process — buat 1 transaksi instance.
// Guard race (CAS): updateMany where lastRun = nilai yang terbaca; hanya 1
// panggilan paralel yang berhasil melewati gerbang, lainnya 409.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  badRequest,
  buildTransferMeta,
  handleApiError,
  notFound,
  serializeTransaction,
  sourceInfoMap,
  transactionDate,
} from '@/app/api/_lib/api-utils';
import { jakartaDateString, jakartaNowParts } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

// M7: jarak minimal antar-run per frekuensi (hari). Guard CAS lama hanya
// membandingkan lastRun yang dibaca request itu sendiri — request berikutnya
// (detik kemudian) lolos lagi dan membuat transaksi ganda.
const MIN_INTERVAL_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  monthly: 28,
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const rt = await db.recurringTransaction.findUnique({ where: { id } });
    if (!rt) throw notFound('Transaksi berulang tidak ditemukan');

    const now = new Date();
    if (!rt.isActive) throw badRequest('Transaksi berulang sedang tidak aktif');
    if (rt.endDate && rt.endDate.getTime() < now.getTime()) {
      throw badRequest('Transaksi berulang sudah melewati tanggal berakhir');
    }
    if (rt.startDate.getTime() > now.getTime()) {
      throw badRequest('Transaksi berulang belum dimulai');
    }

    // M7: guard jarak-antar-run berbasis lastRun TERSIMPAN — instance belum
    // jatuh tempo lagi → 409 (bukan transaksi ganda).
    const minDays = MIN_INTERVAL_DAYS[rt.frequency] ?? 1;
    if (rt.lastRun && now.getTime() - rt.lastRun.getTime() < minDays * 86_400_000) {
      return NextResponse.json(
        { error: 'Instance terbaru belum cukup lama — transaksi berulang ini baru diproses' },
        { status: 409 },
      );
    }

    // ── CAS gate: hanya pemanggil yang lastRun masih sama yang lanjut ──
    const claimed = await db.recurringTransaction.updateMany({
      where: { id, lastRun: rt.lastRun },
      data: { lastRun: now },
    });
    if (claimed.count === 0) {
      return NextResponse.json(
        { error: 'Transaksi berulang baru saja diproses — coba lagi nanti' },
        { status: 409 },
      );
    }

    // Instance: hari Jakarta berjalan + jam dinding Jakarta sekarang.
    const todayYmd = jakartaDateString();
    const { hour, minute } = jakartaNowParts();
    const tx = await db.transaction.create({
      data: {
        type: rt.type,
        amount: rt.amount,
        category: rt.category,
        sourceId: rt.sourceId,
        description: rt.name,
        notes: `Diproses otomatis dari transaksi berulang "${rt.name}"`,
        tags: 'berulang',
        date: transactionDate(todayYmd, `${pad2(hour)}:${pad2(minute)}`),
      },
    });

    const sources = await db.fundSource.findMany();
    const meta = buildTransferMeta(tx.type === 'transfer' ? [tx] : []);
    return NextResponse.json(serializeTransaction(tx, sourceInfoMap(sources), meta), { status: 201 });
  } catch (error) {
    return handleApiError(error, 'finance/recurring/[id]/process:POST');
  }
}
