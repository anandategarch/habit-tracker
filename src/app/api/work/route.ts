// GET /api/work?date=YYYY-MM-DD — payload utama Meja Kerja (Task 17-a).
// Return: routines (+doneToday/doneAt), tasks (hari ini + overdue + kapan saja),
// notes (pin dulu, max 50), stats ringkas untuk pil header, dan dayFlag
// (Fase 2: Mode Libur hari itu).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, handleApiError } from '@/app/api/_lib/api-utils';
import { isValidYMD, jakartaDateString } from '@/lib/timezone';
import { ensureWorkTables } from '@/app/api/_lib/work-ensure';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await ensureWorkTables();

    const dateParam = new URL(req.url).searchParams.get('date');
    if (dateParam !== null && !isValidYMD(dateParam)) {
      throw badRequest('Parameter date tidak valid (format yyyy-MM-dd)');
    }
    const date = dateParam ?? jakartaDateString();

    const [routines, tasks, notes, dayFlag] = await Promise.all([
      db.workRoutine.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          logs: { where: { dayKey: date }, select: { done: true, doneAt: true } },
        },
      }),
      db.workTask.findMany({
        where: {
          OR: [
            { dayKey: { equals: date } },
            { dayKey: { lt: date }, status: { not: 'selesai' } },
            { dayKey: null, status: { not: 'selesai' } },
          ],
        },
        orderBy: [{ createdAt: 'asc' }],
      }),
      db.workNote.findMany({
        orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
        take: 50,
      }),
      db.workDayFlag.findUnique({ where: { dayKey: date } }),
    ]);

    // Serialisasi rutinitas + status hari ini.
    const routinePayload = routines.map((r) => {
      const log = r.logs[0];
      return {
        id: r.id,
        title: r.title,
        timeOfDay: r.timeOfDay,
        active: r.active,
        sortOrder: r.sortOrder,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        doneToday: log?.done ?? false,
        doneAt: log?.doneAt ? log.doneAt.toISOString() : null,
      };
    });

    // Urutan tampil: overdue dulu (butuh perhatian) -> hari ini -> kapan saja.
    // Dalam grup hari ini: belum selesai dulu (createdAt asc), lalu selesai.
    const rank = (t: { dayKey: string | null; status: string }) => {
      if (t.dayKey !== null && t.dayKey < date) return 0; // overdue
      if (t.dayKey === date) return 1; // hari ini
      return 2; // kapan saja
    };
    const taskPayload = [...tasks]
      .sort((a, b) => {
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return ra - rb;
        if (ra === 1) {
          // Hari ini: yang belum selesai di atas.
          const da = a.status === 'selesai' ? 1 : 0;
          const dbb = b.status === 'selesai' ? 1 : 0;
          if (da !== dbb) return da - dbb;
        }
        return a.createdAt.getTime() - b.createdAt.getTime();
      })
      .map((t) => ({
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
      }));

    const notePayload = notes.map((n) => ({
      id: n.id,
      content: n.content,
      tag: n.tag,
      pinned: n.pinned,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    }));

    // Stats: rutin dari rutinitas AKTIF; tugas dari daftar hari ini (di atas).
    const activeRoutines = routinePayload.filter((r) => r.active);
    const stats = {
      rutinAktif: activeRoutines.length,
      rutinSelesai: activeRoutines.filter((r) => r.doneToday).length,
      tugasTodo: taskPayload.filter((t) => t.status === 'todo').length,
      tugasJalan: taskPayload.filter((t) => t.status === 'jalan').length,
      tugasNunggu: taskPayload.filter((t) => t.status === 'nunggu').length,
      tugasSelesai: taskPayload.filter((t) => t.status === 'selesai').length,
    };

    return NextResponse.json({
      date,
      routines: routinePayload,
      tasks: taskPayload,
      notes: notePayload,
      stats,
      holiday: dayFlag?.holiday ?? false,
    });
  } catch (error) {
    return handleApiError(error, 'work:GET');
  }
}
