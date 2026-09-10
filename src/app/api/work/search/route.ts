// GET /api/work/search?q= — cari tugas & catatan Meja Kerja (Task 17-a).
// Catatan teknis: Prisma SQLite/libsql TIDAK mendukung `mode: 'insensitive'`
// (hanya Postgres/Mongo), jadi pencarian case-insensitive dilakukan di JS
// (toLowerCase) — volume data single-user kecil, hasil 100% sesuai maksud.
// Urutan hasil: Tugas dulu, lalu Catatan (sesuai mockup Screen 5).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError } from '@/app/api/_lib/api-utils';
import { jakartaDateString } from '@/lib/timezone';
import { ensureWorkTables } from '@/app/api/_lib/work-ensure';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await ensureWorkTables();
    const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
    if (q.length < 2) {
      return NextResponse.json({ q, tasks: [], notes: [] });
    }
    const needle = q.toLowerCase();

    const [tasks, notes] = await Promise.all([
      db.workTask.findMany({ orderBy: [{ createdAt: 'desc' }], take: 2000 }),
      db.workNote.findMany({ orderBy: [{ updatedAt: 'desc' }], take: 2000 }),
    ]);

    const today = jakartaDateString();
    const matchedTasks = tasks
      .filter(
        (t) =>
          t.title.toLowerCase().includes(needle) ||
          (t.notes ?? '').toLowerCase().includes(needle)
      )
      .slice(0, 30)
      .map((t) => ({
        id: t.id,
        title: t.title,
        notes: t.notes,
        status: t.status,
        dayKey: t.dayKey,
        completedAt: t.completedAt ? t.completedAt.toISOString() : null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        overdue: t.dayKey !== null && t.dayKey < today && t.status !== 'selesai',
        kapanSaja: t.dayKey === null,
      }));

    const matchedNotes = notes
      .filter(
        (n) =>
          n.content.toLowerCase().includes(needle) ||
          (n.tag ?? '').toLowerCase().includes(needle)
      )
      .slice(0, 30)
      .map((n) => ({
        id: n.id,
        content: n.content,
        tag: n.tag,
        pinned: n.pinned,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
      }));

    return NextResponse.json({ q, tasks: matchedTasks, notes: matchedNotes });
  } catch (error) {
    return handleApiError(error, 'work/search:GET');
  }
}
