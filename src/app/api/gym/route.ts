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
import { shiftYmd, computeStreakWithShields } from '@/lib/dashboard-helpers';
import { ensureHabitGraduation } from '@/app/api/_lib/habit-ensure';
import { ensureGymExerciseTables } from '@/app/api/_lib/gym-exercise-ensure';
import {
  MUSCLE_ZONE_DEFS,
  MISSION_ZONE_DEFS,
  MUSCLE_ZONE_DEF_BY_KEY,
  computeBalanceScore,
  computeGymHistory,
  computeReadiness,
  type GymExerciseItem,
  type GymExerciseUnit,
  type GymMapPayload,
  type GymReadinessPayload,
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
    // Task 67: tabel latihan kustom (CREATE IF NOT EXISTS, no-op lokal).
    await ensureGymExerciseTables();

    const settings = await db.appSettings.findUnique({ where: { id: 'singleton' } });
    const weekStart = settings?.weekStart === 0 ? 0 : 1;
    const todayYmd = jakartaDateString();
    const weekStartY = weekStartYmd(todayYmd, weekStart);

    // ── Task 72 F1 (Gym Cerdas): kesiapan harian dari DailyLog TERBARU
    // (hari ini, fallback kemarin — "kondisi terakhir yang diketahui").
    // Tanpa baris → null → UI menampilkan ajakan mengisi check-in.
    // Murni lapisan baca: tidak menulis apa pun.
    const yesterdayYmd = shiftYmd(todayYmd, -1);
    const dailyRows = await db.dailyLog.findMany({
      where: { date: { in: [dateFromYMD(todayYmd), dateFromYMD(yesterdayYmd)] } },
      select: { date: true, sleep: true, energy: true, mood: true },
    });
    let readiness: GymReadinessPayload | null = null;
    if (dailyRows.length > 0) {
      // Baris terbaru (tanggal terbesar) menang.
      const latest = dailyRows.reduce((a, b) => (a.date >= b.date ? a : b));
      const sourceYmd = ymdOf(latest.date as Date);
      readiness = computeReadiness(
        { sleep: latest.sleep, energy: latest.energy, mood: latest.mood },
        sourceYmd,
        sourceYmd === todayYmd,
      );
    }

    // Habit zona: baris pertama per muscleZone yang TIDAK diarsipkan.
    // Task 70 (audit 70-c MAJOR): orderBy createdAt asc — pemilihan "baris
    // pertama per zona" deterministik (habit TERLAMA) bila habit zona
    // terlanjur dobel oleh race POST pra-perbaikan, bukan urutan acak DB.
    const zoneHabits = await db.habit.findMany({
      where: { muscleZone: { not: null }, isArchived: false },
      orderBy: { createdAt: 'asc' },
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
        zoneStreak: habit
          // Task 70 (audit 70-a m3): streak zona STRICT — computeStreakWithShields
          // dengan kuota hari-aman 0 (berturut-turut murni) supaya "Streak zona"
          // di sheet tidak bisa MELEBIHI PR "Rekor streak terpanjang"
          // (longestStreakDays = longestConsecutiveDays, juga strict). Default
          // pemakai lain computeStreakFromSet (2 hari aman/bln) tidak berubah.
          ? computeStreakWithShields(doneDays, todayYmd, 0).streak
          : 0,
        weeklyZoneXp: habit ? weekly.length * xpForDifficulty(habit.difficulty) : 0,
      };
    };

    const zones = MISSION_ZONE_DEFS.map((d) => shape(d.key));
    const fullBody = shape('fullbody');

    // ── V2 (Task 65): lapisan riwayat/pencapaian — PURE TURUNAN dari log
    // yang SUDAH dibaca di atas (tanpa query tambahan, tanpa state baru).
    const ymdsByZone: Partial<Record<MuscleZoneKey, string[]>> = {};
    for (const def of MUSCLE_ZONE_DEFS) {
      const h = byZone.get(def.key);
      ymdsByZone[def.key] = h ? (logsByHabit.get(h.id) ?? []).map((l) => l.ymd) : [];
    }
    const history = computeGymHistory({
      ymdsByZone,
      weekStartDow: weekStart,
      todayYmd,
    });

    const touched = zones.filter((z) => z.sessionsThisWeek >= 1).length;

    // ── Task 67: latihan kustom per zona (list marker GymExerciseList).
    // Zona dengan baris marker = dikustomisasi (daftar boleh kosong);
    // tanpa marker → klien menampilkan preset ZONE_EXERCISE_PRESETS.
    const customLists = await db.gymExerciseList.findMany({
      include: { exercises: { orderBy: { sortOrder: 'asc' } } },
    });
    const customizedZones: MuscleZoneKey[] = [];
    const exercisesByZone: Partial<Record<MuscleZoneKey, GymExerciseItem[]>> = {};
    for (const list of customLists) {
      const key = list.zone as MuscleZoneKey;
      if (!MUSCLE_ZONE_DEF_BY_KEY[key]) continue; // zone tak dikenal → abaikan
      customizedZones.push(key);
      exercisesByZone[key] = list.exercises.map((e) => ({
        name: e.name,
        sets: e.sets,
        amount: e.amount,
        unit: e.unit as GymExerciseUnit,
      }));
    }

    const payload: GymMapPayload = {
      todayYmd,
      weekStartYmd: weekStartY,
      setupDone: MUSCLE_ZONE_DEFS.every((d) => byZone.has(d.key)),
      zones,
      fullBody,
      mission: { touched, total: zones.length, balancedWeek: touched === zones.length && zones.length > 0 },
      balanceScore: computeBalanceScore(zones),
      historyWeeks: history.historyWeeks,
      zoneHistory: history.zoneHistory,
      bestWeek: history.bestWeek,
      achievements: history.achievements,
      totals: history.totals,
      exercisesByZone,
      customizedZones,
      readiness,
    };
    return NextResponse.json(payload);
  } catch (error) {
    return handleApiError(error, 'gym:GET');
  }
}

export async function POST() {
  try {
    await ensureHabitGraduation();

    // Kategori "Olahraga" (HabitOption) — upsert idempoten (unique
    // type_label; aman di luar transaksi).
    await db.habitOption.upsert({
      where: { type_label: { type: 'category', label: 'Olahraga' } },
      update: {},
      create: { type: 'category', label: 'Olahraga', color: '#f49b25', sortOrder: 60 },
    });

    // Task 70 (audit 70-c MAJOR): HabitGroup "Gym" + habit 7 zona dibuat
    // dalam SATU $transaction dengan re-check DI DALAM transaksi (pola CAS
    // gym/exercises & recurring/process — adapter libsql memegang koneksi
    // dari BEGIN sampai COMMIT). Dulu check-then-act per zona TANPA
    // transaksi: 2 POST paralel (PWA 2 perangkat) sama-sama lolos cek lalu
    // membuat habit zona DOBEL (muscleZone tanpa unique constraint).
    const created = await db.$transaction(async (tx) => {
      // Grup "Gym" — cari atau buat (di dalam transaksi).
      let group = await tx.habitGroup.findFirst({ where: { name: 'Gym' } });
      if (!group) {
        group = await tx.habitGroup.create({ data: { name: 'Gym', color: '#1589ff' } });
      }

      let made = 0;
      for (const def of MUSCLE_ZONE_DEFS) {
        // Idempoten: zona dianggap terpasang bila ada habit non-arsip dengan
        // muscleZone ini (sama dengan definisi setupDone di GET). Re-check
        // dilakukan DI DALAM transaksi (lihat komentar Task 70 di atas).
        const existing = await tx.habit.findFirst({
          where: { muscleZone: def.key, isArchived: false },
          select: { id: true },
        });
        if (existing) continue;
        await tx.habit.create({
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
        made += 1;
      }
      return made;
    });

    return NextResponse.json({ ok: true, created, total: MUSCLE_ZONE_DEFS.length });
  } catch (error) {
    return handleApiError(error, 'gym:POST');
  }
}
