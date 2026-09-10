// GET /api/work/board?date=YYYY-MM-DD — payload Papan Tugas + Arsip (Fase 2,
// Task 19). Beda dengan /api/work: papan mengambil SEMUA tugas terbuka (hari
// ini + lewat tenggat + kapan saja + tanggal depan) plus yang selesai HARI
// INI untuk kolom Selesai; arsip = tugas selesai dari hari-hari sebelumnya.
//
// Task 21 (bug hunt ronde 2): definisi "Selesai hari ini" dan "Arsip" kini
// berbasis completedAt (tengah malam Jakarta) — BUKAN dayKey. Alasan: tugas
// "kapan saja" (dayKey null) yang diselesaikan hari ini sebelumnya masuk
// arsip langsung, dan tugas ber-target masa depan yang diselesaikan hari ini
// hilang total (tidak cocok tiga-tiga query). Dengan completedAt: semua yang
// selesai hari ini tampil di kolom Selesai, sisanya masuk arsip.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, handleApiError } from '@/app/api/_lib/api-utils';
import { isValidYMD, jakartaDateString, jakartaDayStart } from '@/lib/timezone';
import { ensureWorkTables } from '@/app/api/_lib/work-ensure';

export const dynamic = 'force-dynamic';

const ARCHIVE_PAGE = 30;

function serializeTask(t: {
  id: string;
  title: string;
  notes: string | null;
  status: string;
  dayKey: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}, date: string) {
  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    status: t.status,
    dayKey: t.dayKey,
    dueAt: t.dueAt ? t.dueAt.toISOString() : null,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    overdue: t.dayKey !== null && t.dayKey < date && t.status !== 'selesai',
    kapanSaja: t.dayKey === null,
  };
}

export async function GET(req: Request) {
  try {
    await ensureWorkTables();

    const dateParam = new URL(req.url).searchParams.get('date');
    if (dateParam !== null && !isValidYMD(dateParam)) {
      throw badRequest('Parameter date tidak valid (format yyyy-MM-dd)');
    }
    const date = dateParam ?? jakartaDateString();
    // Tengah malam Jakarta hari payload — batas "selesai hari ini" vs arsip.
    const dayStart = jakartaDayStart(date);

    const [openTasks, todayDone, archive, flag] = await Promise.all([
      // Semua tugas terbuka apa pun tanggalnya (hari ini / lewat tenggat /
      // kapan saja / tanggal depan) — urut: overdue → kapan saja → hari ini →
      // depan; lalu terbaru dibuat dulu biar kartu baru nempel di atas.
      db.workTask.findMany({
        where: { status: { not: 'selesai' } },
        orderBy: [{ createdAt: 'desc' }],
      }),
      // Selesai HARI INI (kolom Selesai): berdasarkan completedAt >= tengah
      // malam Jakarta, apa pun dayKey-nya — kapan saja & target depan ikut
      // terhitung saat kamu menuntaskannya hari ini.
      db.workTask.findMany({
        where: { status: 'selesai', completedAt: { gte: dayStart } },
        orderBy: [{ completedAt: 'desc' }],
      }),
      // Arsip: selesai sebelum hari ini (completedAt lama, atau null untuk
      // baris warisan lama yang tidak pernah menyimpan completedAt).
      db.workTask.findMany({
        where: {
          status: 'selesai',
          OR: [{ completedAt: { lt: dayStart } }, { completedAt: null }],
        },
        orderBy: [{ completedAt: 'desc' }],
        take: ARCHIVE_PAGE,
      }),
      db.workDayFlag.findUnique({ where: { dayKey: date } }),
    ]);

    const rank = (t: { dayKey: string | null }) => {
      if (t.dayKey !== null && t.dayKey < date) return 0; // overdue
      if (t.dayKey === null) return 1; // kapan saja
      if (t.dayKey === date) return 2; // hari ini
      return 3; // tanggal depan
    };

    const tasks = [...openTasks]
      .sort((a, b) => {
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return ra - rb;
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
      .map((t) => serializeTask(t, date));

    const doneToday = todayDone.map((t) => serializeTask(t, date));
    const archivePayload = archive.map((t) => serializeTask(t, date));

    const stats = {
      todo: tasks.filter((t) => t.status === 'todo').length,
      jalan: tasks.filter((t) => t.status === 'jalan').length,
      nunggu: tasks.filter((t) => t.status === 'nunggu').length,
      selesaiHariIni: doneToday.length,
      arsip: archivePayload.length,
    };

    return NextResponse.json({
      date,
      tasks,
      doneToday,
      archive: archivePayload,
      stats,
      holiday: flag?.holiday ?? false,
    });
  } catch (error) {
    return handleApiError(error, 'work/board:GET');
  }
}
