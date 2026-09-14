// GET/POST /api/habits — daftar habit non-archived (aktif + dijeda) +
// completedLogCount.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, readJsonBody } from '@/app/api/_lib/api-utils';
import { parseHabitFields } from '@/app/api/_lib/habit-fields';
import { ensureHabitGraduation, expireHabitVacations } from '@/app/api/_lib/habit-ensure';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Task 36: pastikan kolom targetDays/graduatedAt ada (DDL idempotent —
    // no-op lokal, ALTER TABLE saat pertama di Turso produksi).
    await ensureHabitGraduation();
    // BUGHUNT-47 (47-c #1): matikan mode liburan yang masa berlakunya sudah
    // lewat — janji UI "otomatis nonaktif dan kembali ditrack normal"
    // dulunya tidak pernah ditegakkan (vacationUntil tidak pernah dibaca).
    await expireHabitVacations();
    const [habits, counts] = await Promise.all([
      db.habit.findMany({
        // BUGHUNT-54 (3-b #1): isActive TIDAK lagi difilter di server. Dulu
        // habit DIJEDA hilang permanen dari seluruh UI — tombol "Lanjutkan"
        // (Habit Master) dan filter "Dijeda" tak pernah melihatnya, dan XP/
        // level turun karena completedLogCount-nya ikut lenyap. Konsumen yang
        // hanya boleh menampilkan habit aktif sudah memfilter isActive
        // client-side (tracker: activeHabits/use-habit-completions; kalender:
        // activeHabitCountOnDay + habitIds; goals: daftar pendukung; Habit
        // Master justru butuh habit dijeda untuk filter statusnya).
        // isArchived TETAP difilter — arsip memang keluar dari rotasi.
        where: { isArchived: false },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      // Satu groupBy untuk semua habit (bukan query per-habit).
      db.habitLog.groupBy({
        by: ['habitId'],
        where: { completed: true },
        _count: { _all: true },
      }),
    ]);
    const countMap = new Map(counts.map((c) => [c.habitId, c._count._all]));
    const payload = habits.map((h) => ({
      ...h,
      completedLogCount: countMap.get(h.id) ?? 0,
    }));
    return NextResponse.json({ habits: payload });
  } catch (error) {
    return handleApiError(error, 'habits:GET');
  }
}

export async function POST(req: Request) {
  try {
    await ensureHabitGraduation();
    const body = await readJsonBody(req);
    const { data } = await parseHabitFields(body, 'create');
    const habit = await db.habit.create({
      data: data as Parameters<typeof db.habit.create>[0]['data'],
    });
    return NextResponse.json({ ...habit, completedLogCount: 0 }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'habits:POST');
  }
}
