// GET  /api/gym — MUSCLE ENGINE (Task 64: Peta Otot) — status peta otot
//                     turunan dari habit zona (LAPISAN BACA: tidak mengubah
//                     kalkulasi XP/streak/kalender inti sama sekali).
// POST /api/gym — setup idempoten: buat 7 habit zona latihan (+ opsi kategori
//                     "Olahraga" + grup "Gym") bila belum ada.
//
// Habit zona = habit biasa bermuscleZone ('dada'.. 'fullbody'). XP, streak,
// kalender, KPI, dan pohon musim mingguan otomatis mengalir lewat mekanisme
// HabitLog yang sudah ada — route ini HANYA membaca & membentuk payload
// turunan untuk Peta Otot (prinsip desain user: "Peta Otot hanya membaca
// event"). Penyelesaian sesi tetap lewat pipa sah: POST /api/habits/[id]/logs.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, xpForDifficulty } from '@/app/api/_lib/api-utils';
import { dateFromYMD, jakartaDateString } from '@/lib/timezone';
import { shiftYmd, computeStreakFromSet } from '@/lib/dashboard-helpers';
import { ensureHabitGraduation } from '@/app/api/_lib/habit-ensure';
import {
  MUSCLE_ZONE_DEFS,
  MISSION_ZONE_DEFS,
  computeBalanceScore,
  type GymMapPayload,
  type GymZonePayload,
  type MuscleZoneKey,
} from '@/lib/muscle-map';

export const dynamic = 'force-dynamic';

/** YMD awal minggu berjalan sesuai weekStart pengaturan (0=Minggu, 1=Senin). */
function weekStartYmd(ymd: string, weekStart: number): string {
  const dow = dateFromYMD(ymd).getUTCDay(); // 0=Minggu .. 6=Sabtu
  const diff = (dow - weekStart + 7) % 7;
  return shiftYmd(ymd, -diff);
}

function ymdOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    // muscleZone adalah kolom aditif — pastikan ada sebelum dibaca (produksi).
    await ensureHabitGraduation();

    const settings = await db.appSettings.findUnique({ where: { id: 'singleton' } });
    const weekStart = settings?.weekStart === 0 ? 0 : 1;
    const todayYmd = jakartaDateString();
    const weekStartY = weekStartYmd(todayYmd, weekStart);

    // Habit zona: baris pertama per muscleZone yang TIDAK diarsipkan.
    const zoneHabits = await db.habit.findMany({
      where: { muscleZone: { not: null }, isArchived: false },
      select: {
        id: true, name: true, emoji: true, difficulty: true, muscleZone: true,
        isActive: true, isArchived: false, vacationMode: true,
      },
    });
    const byZone = new Map<MuscleZoneKey, (typeof zoneHabits)[number]>();
    for (const h of zoneHabits) {
      const key = h.muscleZone as MuscleZoneKey;
      if (!byZone.has(key)) byZone.set(key, h);
    }

    const habitIds = [...byZone.values()].map((h) => h.id);
    const logs = habitIds.length
      ? await db.habitLog.findMany({
          where: { habitId: { in: habitIds }, completed: true },
          select: { habitId: true, date: true, completedAt: true },
        })
      : [];

    // Grup log per habit.
    const logsByHabit = new Map<string, { ymd: string; at: Date | null }[]>();
    for (const l of logs) {
      const arr = logsByHabit.get(l.habitId) ?? [];
      arr.push({ ymd: ymdOf(l.date as Date), at: (l.completedAt as Date | null) ?? null });
      logsByHabit.set(l.habitId, arr);
    }

    const fullBodyHabit = byZone.get('fullbody') ?? null;
    const fullBodyWeekly = fullBodyHabit
      ? (logsByHabit.get(fullBodyHabit.id) ?? []).filter((l) => l.ymd >= weekStartY && l.ymd <= todayYmd).length
      : 0;

    const shape = (key: MuscleZoneKey): GymZonePayload => {
      const def = MUSCLE_ZONE_DEFS.find((d) => d.key === key)!;
      const habit = byZone.get(key) ?? null;
      const own = habit ? (logsByHabit.get(habit.id) ?? []) : [];
      const weekly = own.filter((l) => l.ymd >= weekStartY && l.ymd <= todayYmd);
      const contrib = def.isMissionZone ? fullBodyWeekly : 0; // Full Body menyentuh semua zona
      // Sesi terakhir: log terbaru (max ymd, tie-break completedAt terbaru).
      let last: { ymd: string; at: Date | null } | null = null;
      for (const l of own) {
        if (!last || l.ymd > last.ymd || (l.ymd === last.ymd && ((l.at?.getTime() ?? 0) > (last.at?.getTime() ?? 0)))) {
          last = l;
        }
      }
      const doneDays = new Set(own.map((l) => l.ymd));
      return {
        key,
        label: def.label,
        emoji: def.emoji,
        color: def.color,
        habitId: habit?.id ?? null,
        habitName: habit?.name ?? null,
        difficulty: habit?.difficulty ?? 'Medium',
        weeklyTarget: def.weeklyTarget,
        ownSessionsThisWeek: weekly.length,
        fullBodyContrib: contrib,
        sessionsThisWeek: weekly.length + contrib,
        logYmdsThisWeek: weekly.map((l) => l.ymd).sort(),
        doneToday: habit ? doneDays.has(todayYmd) : false,
        lastSessionAt: last?.at ? (last.at as Date).toISOString() : null,
        lastSessionYmd: last?.ymd ?? null,
        lifetimeSessions: own.length,
        zoneStreak: habit ? computeStreakFromSet(doneDays, todayYmd) : 0,
        weeklyZoneXp: habit ? weekly.length * xpForDifficulty(habit.difficulty) : 0,
      };
    };

    const zones = MISSION_ZONE_DEFS.map((d) => shape(d.key));
    const fullBody = shape('fullbody');

    const touched = zones.filter((z) => z.sessionsThisWeek >= 1).length;
    const payload: GymMapPayload = {
      todayYmd,
      weekStartYmd: weekStartY,
      setupDone: MUSCLE_ZONE_DEFS.every((d) => byZone.has(d.key)),
      zones,
      fullBody,
      mission: { touched, total: zones.length, balancedWeek: touched === zones.length && zones.length > 0 },
      balanceScore: computeBalanceScore(zones),
    };
    return NextResponse.json(payload);
  } catch (error) {
    return handleApiError(error, 'gym:GET');
  }
}

export async function POST() {
  try {
    await ensureHabitGraduation();

    // Kategori "Olahraga" (HabitOption) — upsert idempoten.
    await db.habitOption.upsert({
      where: { type_label: { type: 'category', label: 'Olahraga' } },
      update: {},
      create: { type: 'category', label: 'Olahraga', color: '#f49b25', sortOrder: 60 },
    });

    // Grup "Gym" — cari atau buat.
    let group = await db.habitGroup.findFirst({ where: { name: 'Gym' } });
    if (!group) {
      group = await db.habitGroup.create({ data: { name: 'Gym', color: '#1589ff' } });
    }

    let created = 0;
    for (const def of MUSCLE_ZONE_DEFS) {
      // Idempoten: zona dianggap terpasang bila ada habit non-arsip dengan
      // muscleZone ini (sama dengan definisi setupDone di GET).
      const existing = await db.habit.findFirst({
        where: { muscleZone: def.key, isArchived: false },
        select: { id: true },
      });
      if (existing) continue;
      await db.habit.create({
        data: {
          name: def.habitName,
          emoji: def.emoji,
          category: 'Olahraga',
          priority: 'Sedang',
          // Full Body = sirkuit 20 menit → Sulit (20 XP, recovery 72 jam);
          // zona lain Sedang (10 XP, 48 jam). XP tetap bobot difficulty biasa.
          difficulty: def.key === 'fullbody' ? 'Sulit' : 'Sedang',
          habitType: 'normal',
          target: 1,
          muscleZone: def.key,
          groupId: group.id,
          sortOrder: 900 + MUSCLE_ZONE_DEFS.findIndex((d) => d.key === def.key),
        },
      });
      created += 1;
    }

    return NextResponse.json({ ok: true, created, total: MUSCLE_ZONE_DEFS.length });
  } catch (error) {
    return handleApiError(error, 'gym:POST');
  }
}
