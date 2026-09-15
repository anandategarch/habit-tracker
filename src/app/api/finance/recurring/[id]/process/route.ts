// POST /api/finance/recurring/[id]/process — buat 1 transaksi instance.
// Guard race (CAS): updateMany where lastRun = nilai yang terbaca; hanya 1
// panggilan paralel yang berhasil melewati gerbang, lainnya 409.
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
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
import { jakartaDateKey, jakartaDateString, jakartaNowParts } from '@/lib/timezone';
import { shiftYmd } from '@/lib/dashboard-helpers';
import { ensureTransactionGroupId } from '@/app/api/_lib/transaction-ensure';

export const dynamic = 'force-dynamic';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// BUGHUNT-54 (3-a #6): tanggal instance BERIKUTNYA setelah ymd sesuai
// frekuensi — semantik sama dengan addIntervalYMD di route dashboard
// (monthly = +1 bulan kalender, clamp ke akhir bulan: 31 Jan → 28/29 Feb).
function addIntervalYMD(ymd: string, frequency: string): string {
  if (frequency === 'daily') return shiftYmd(ymd, 1);
  if (frequency === 'weekly') return shiftYmd(ymd, 7);
  const [y, m, d] = ymd.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    // Task 60-f: query baris Transaction penuh (kolom groupId via DDL runtime).
    await ensureTransactionGroupId();
    const { id } = await ctx.params;
    const rt = await db.recurringTransaction.findUnique({ where: { id } });
    if (!rt) throw notFound('Transaksi berulang tidak ditemukan');

    const now = new Date();
    if (!rt.isActive) throw badRequest('Transaksi berulang sedang tidak aktif');
    // BUGHUNT-54 (3-a #6a): endDate dibandingkan per YMD Jakarta (konvensi
    // app — sama dengan filter "sudah berakhir" di route dashboard), bukan
    // instant: tagihan ber-endDate HARI INI masih due dan boleh diproses.
    if (rt.endDate && jakartaDateKey(rt.endDate) < jakartaDateString()) {
      throw badRequest('Transaksi berulang sudah melewati tanggal berakhir');
    }
    if (rt.startDate.getTime() > now.getTime()) {
      throw badRequest('Transaksi berulang belum dimulai');
    }

    // BUGHUNT-54 (3-a #6b): guard anti proses-dini kini berbasis instance
    // berikutnya (lastRun + interval, kalender bulanan penuh) — ditolak hanya
    // bila MASIH di masa depan (> hari ini YMD Jakarta). Guard lama
    // MIN_INTERVAL_DAYS (monthly = 28 hari) salah untuk bulan 29–31 hari:
    // instans bulanan bisa diproses hingga 3 hari lebih awal → jadwal drift.
    // Instance yang jatuh tempo hari ini / terlambat tetap boleh diproses.
    if (rt.lastRun && addIntervalYMD(jakartaDateKey(rt.lastRun), rt.frequency) > jakartaDateString()) {
      return NextResponse.json(
        { error: 'Instance berikutnya belum jatuh tempo — transaksi berulang ini baru diproses' },
        { status: 409 },
      );
    }

    // ── CAS gate + instance: SATU transaction (Task 60-b / audit 59-b5) ──
    // Dulunya CAS (update lastRun) dijalankan DI LUAR transaction sebelum
    // create transaksi: bila create gagal setelah CAS sukses, instance
    // "terbakar" (harus tunggu interval penuh, uang tak tercatat). Kini
    // create + CAS komit bersama — kegagalan create me-roll-back lastRun.
    // Interactive $transaction terbukti dipakai driver libsql adapter ini
    // di route lain (transfer/split/bulk-delete/transactions[id]/import/
    // reset-all/habit-options[id]/categories[id]); adapter memegang mutex
    // koneksi dari BEGIN sampai COMMIT/ROLLBACK sehingga tidak berbalap
    // dengan query lain pada proses yang sama.
    // Instance: hari Jakarta berjalan + jam dinding Jakarta sekarang.
    const todayYmd = jakartaDateString();
    const { hour, minute } = jakartaNowParts();
    const created = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const claimed = await tx.recurringTransaction.updateMany({
        where: { id, lastRun: rt.lastRun },
        data: { lastRun: now },
      });
      if (claimed.count === 0) return null;
      return tx.transaction.create({
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
    });
    if (created === null) {
      return NextResponse.json(
        { error: 'Transaksi berulang baru saja diproses — coba lagi nanti' },
        { status: 409 },
      );
    }

    const sources = await db.fundSource.findMany();
    const meta = buildTransferMeta(created.type === 'transfer' ? [created] : []);
    return NextResponse.json(serializeTransaction(created, sourceInfoMap(sources), meta), { status: 201 });
  } catch (error) {
    return handleApiError(error, 'finance/recurring/[id]/process:POST');
  }
}
