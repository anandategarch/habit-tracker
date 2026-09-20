// GET /api/dashboard?period=7|30|90|all — payload dashboard lengkap (kontrak).
// Level memakai totalXp ALL-TIME + calcLevel dari lib/dashboard-helpers.
//
// Fix 11-c:
//  * M-1: bestStreak & currentStreak = streak GLOBAL (hari berturut dengan
//    ≥1 habit selesai, all-time) — satu sumber kebenaran; client tidak lagi
//    menghitung streak sendiri (dulu bestStreak per-habit → KPI kontradiksi
//    "Streak Aktif 30 > Rekor 11").
//  * M-2: moodAvg/energyAvg/sleepAvg = null bila tidak ada log check-in
//    (rata-rata hanya dari nilai non-null — bukan ?? 3/?? 7 → fabrikasi).
//  * M-3: period=all → jendela sejak log habit pertama; monthlyChart jujur
//    mengikuti jendela (maks ~90 titik, agregasi mingguan bila > 90 hari).
//  * L-8: focusToday membawa priority dari habit (badge prioritas hidup).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, pickDailyQuote, round1, transactionMonthRange, xpForDifficulty, ymdOf } from '@/app/api/_lib/api-utils';
import { calcLevel, computeAvoidStreak, computeStreakFromSet, shiftYmd } from '@/lib/dashboard-helpers';
import { dateFromYMD, jakartaDateString, jakartaMonthString } from '@/lib/timezone';
import { ensureHabitGraduation, expireHabitVacations } from '@/app/api/_lib/habit-ensure';
import {
  isScheduledOn,
  parseSchedule,
  type HabitSchedule,
} from '@/lib/habit-schedule';
import { parseVacationIntervals, vacationDayPredicate } from '@/lib/habit-vacation';

export const dynamic = 'force-dynamic';

function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round((dateFromYMD(toYmd).getTime() - dateFromYMD(fromYmd).getTime()) / 86_400_000) + 1;
}

/** YMD awal minggu berjalan (0 = Minggu, 1 = Senin). */
function weekStartOf(ymd: string, weekStart: number): string {
  const dow = dateFromYMD(ymd).getUTCDay();
  const diff = (dow - weekStart + 7) % 7;
  return shiftYmd(ymd, -diff);
}

type ChartDay = { date: string; completed: number; missed: number };

export async function GET(req: Request) {
  try {
    // Task 36: query habit default-select memuat targetDays/graduatedAt.
    await ensureHabitGraduation();
    // BUGHUNT-47 (47-c #1): matikan mode liburan kedaluwarsa SEBELUM dibaca
    // — habit yang masa liburnya lewat kembali ditrack normal.
    await expireHabitVacations();
    const periodParam = new URL(req.url).searchParams.get('period');
    const validPeriods = new Set(['7', '30', '90', 'all']);
    if (periodParam !== null && !validPeriods.has(periodParam)) {
      return NextResponse.json({ error: 'Parameter period tidak valid (7, 30, 90, atau all)' }, { status: 400 });
    }
    const period: 7 | 30 | 90 | 'all' =
      periodParam === '30' || periodParam === '90' ? (Number(periodParam) as 30 | 90) : periodParam === '7' ? 7 : 'all';

    const todayYmd = jakartaDateString();
    const currentMonth = jakartaMonthString();

    // ── Jendela periode ──
    // M-3: 'all' → sejak log habit pertama (fallback hari ini bila kosong);
    // angka → N hari terakhir seperti sebelumnya.
    let startYmd: string;
    if (period === 'all') {
      const firstLog = await db.habitLog.findFirst({ orderBy: { date: 'asc' }, select: { date: true } });
      startYmd = firstLog ? ymdOf(firstLog.date as Date) : todayYmd;
      if (startYmd > todayYmd) startYmd = todayYmd; // guard data future
    } else {
      startYmd = shiftYmd(todayYmd, -(period - 1));
    }

    // BUGHUNT-54 (3-c #1a): query terpisah untuk rantai XP; `habits` tetap
    // dipakai untuk rotasi harian (tracking/KPI/fokus) supaya habit
    // dijeda/diarsipkan keluar dari tagihan hari ini.
    // Task 70 (audit 70-a M1): xpHabits kini TANPA filter — habit TERARSIP
    // tetap dihitung XP/level (arsip = menyembunyikan dari rotasi, BUKAN
    // penghapus sejarah; paritas semantik jeda BUGHUNT-54 & lulus Task 36
    // — level tidak boleh turun saat habit diarsipkan).
    const [settings, habits, xpHabits, allCompleted, dailyLogs, monthTx, budgetRows] = await Promise.all([
      db.appSettings.findUnique({ where: { id: 'singleton' } }),
      db.habit.findMany({
        where: { isActive: true, isArchived: false },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      db.habit.findMany({
        // Task 70 (audit 70-a M1): tanpa where — aktif + dijeda + terarsip.
        select: { id: true, difficulty: true, habitType: true },
      }),
      db.habitLog.findMany({
        where: { completed: true },
        select: { habitId: true, date: true, value: true },
      }),
      db.dailyLog.findMany({
        where: { date: { gte: dateFromYMD(startYmd), lte: dateFromYMD(todayYmd) } },
      }),
      // Task 70 (audit 70-c #5): filter bulan berjalan DI QUERY (dulu SEMUA
      // Transaction income/expense di-fetch lalu disaring
      // startsWith(prefix) di JS). Konvensi tanggal transaksi = YMD stabil
      // sebagai komponen UTC (12:00Z tanpa jam / jam dinding Jakarta) →
      // rentang [awal bulan, awal bulan depan) identik dengan filter lama,
      // output payload tidak berubah. `allCompleted` HabitLog all-time
      // sengaja dibiarkan (dipakai XP/streak).
      db.transaction.findMany({
        where: {
          type: { in: ['income', 'expense'] },
          date: transactionMonthRange(currentMonth),
        },
        select: { type: true, amount: true, category: true, date: true },
      }),
      db.weeklyBudget.findMany({ where: { month: currentMonth } }),
    ]);

    const weekStart = settings?.weekStart === 0 ? 0 : 1;

    // Task 36 — habit yang sudah LULUS (graduatedAt) keluar dari rotasi harian
    // (KPI, rate, fokus, last-done), TAPI tetap dihitung dalam XP: habit lulus
    // = kemenangan yang sudah dibayar penuh — level tidak boleh turun saat
    // habit diwisuda. `habits` (semua aktif non-arsip) dipakai untuk XP &
    // kategori historis; `tracking` untuk semuanya yang "masih berjalan".
    const tracking = habits.filter((h) => !h.graduatedAt);
    const trackingIds = new Set(tracking.map((h) => h.id));

    // ── Log completed dikelompokkan per habit ──
    const logsByHabit = new Map<string, Array<{ ymd: string; value: number }>>();
    const todayCompleted = new Set<string>();
    // M-1: hari dengan ≥1 habit selesai (GLOBAL, all-time) — dasar streak.
    const globalDoneDays = new Set<string>();
    for (const log of allCompleted) {
      const ymd = ymdOf(log.date as Date);
      const arr = logsByHabit.get(log.habitId) ?? [];
      arr.push({ ymd, value: log.value ?? 1 });
      logsByHabit.set(log.habitId, arr);
      globalDoneDays.add(ymd);
      if (ymd === todayYmd) todayCompleted.add(log.habitId);
    }

    const totalHabits = tracking.length;

    // ── Rate penyelesaian (denominator = habit aktif TERJADWAL per hari) ──
    // Task 37: habit mingguan/bulanan hanya menagih hari terjadwalnya —
    // denominator & numerator dihitung dari hari terjadwal saja supaya
    // "rate" habit 1×/minggu tidak terlihat 14% padahal konsisten.
    const schedByHabit = new Map<string, HabitSchedule>(
      tracking.map((h) => [h.id, parseSchedule(h.scheduleJson)]),
    );
    const scheduledCountBetween = (sched: HabitSchedule, fromYmd: string, toYmd: string): number => {
      let n = 0;
      for (let c = fromYmd; c <= toYmd; c = shiftYmd(c, 1)) {
        if (isScheduledOn(sched, c)) n += 1;
      }
      return n;
    };
    const rateBetween = (fromYmd: string, toYmd: string): number => {
      let denominator = 0;
      let completed = 0;
      for (const h of tracking) {
        const startYmdHabit = jakartaDateString(h.startDate as Date);
        const effStart = startYmdHabit > fromYmd ? startYmdHabit : fromYmd;
        if (effStart > toYmd) continue;
        const schedH = schedByHabit.get(h.id) ?? { kind: 'daily' };
        denominator += scheduledCountBetween(schedH, effStart, toYmd);
        const days = logsByHabit.get(h.id) ?? [];
        // Task 39 (#6): numerator hanya menghitung log di hari TERJADWAL +
        // hasil di-clamp 100 — dulu habit yang diubah jadwalnya (harian →
        // Senin saja) menampilkan rate 700% karena numerator memuat log
        // hari non-jadwal.
        completed += days.filter(
          (d) => d.ymd >= effStart && d.ymd <= toYmd && isScheduledOn(schedH, d.ymd),
        ).length;
      }
      return denominator > 0 ? Math.min(100, Math.round((completed / denominator) * 100)) : 0;
    };

    const monthStart = currentMonth + '-01';
    // Task 37: KPI "hari ini" hanya menagih habit yang jadwalnya hari ini
    // (habit mingguan tidak mengecilkan persentase hari ini). Clamp 100%
    // untuk completion di luar jadwal (jarang, tapi jujur ditampilkan penuh).
    // Task 39 (#4): habit libur (vacationMode) tidak ditagih hari ini —
    // konsisten dengan tracker (X/Y memakai trackable, bukan scheduled mentah).
    const scheduledTodayCount = tracking.filter(
      (h) =>
        !h.vacationMode &&
        jakartaDateString(h.startDate as Date) <= todayYmd &&
        isScheduledOn(schedByHabit.get(h.id) ?? { kind: 'daily' }, todayYmd),
    ).length;
    // Task 39 (#4): "Hari Ini %" kini sepakat dengan tracker — sukses habit
    // avoid = TIDAK kambuh (log completed avoid adalah kambuh, bukan sukses).
    // Dulu: kambuh di satu-satunya habit avoid → dashboard "100%" padahal
    // tracker 0/1. Habit libur & non-jadwal hari ini juga tidak dihitung.
    const activeToday = tracking.filter((h) => {
      if (jakartaDateString(h.startDate as Date) > todayYmd) return false;
      if (!isScheduledOn(schedByHabit.get(h.id) ?? { kind: 'daily' }, todayYmd)) return false;
      if (h.vacationMode) return false;
      const done = todayCompleted.has(h.id);
      return h.habitType === 'avoid' ? !done : done;
    }).length;
    const successToday =
      scheduledTodayCount > 0
        ? Math.min(100, Math.round((activeToday / scheduledTodayCount) * 100))
        : 0;
    const weeklyRate = rateBetween(weekStartOf(todayYmd, weekStart), todayYmd);
    const monthlyRate = rateBetween(monthStart, todayYmd);
    const consistencyScore = rateBetween(startYmd, todayYmd);
    const completion7d = rateBetween(shiftYmd(todayYmd, -6), todayYmd);
    const completion30d = rateBetween(shiftYmd(todayYmd, -29), todayYmd);

    // ── XP & level (all-time) ──
    // Task 36: iterasi `habits` (termasuk yang lulus) — XP habit lulus tidak
    // pernah dicabut; level = kenangan kemenangan, bukan sewa bulanan.
    // BUGHUNT-54 (3-c #1a): iterasi `xpHabits` — jeda = istirahat terencana,
    // BUKAN penghapusan sejarah XP. Task 70 (audit 70-a M1): arsip juga.
    // Task 60-e (audit 59-b2): todayXp MENGECUALIKAN log kambuh habit 'avoid'
    // — kartu habit & toast selalu menjanjikan "avoid tidak berhak XP";
    // totalXp ALL-TIME tetap menghitung semua log (level tidak boleh turun
    // karena keputusan tampilan hari ini).
    let totalXp = 0;
    let todayXp = 0;
    for (const h of xpHabits) {
      const logs = logsByHabit.get(h.id) ?? [];
      const weight = xpForDifficulty(h.difficulty);
      totalXp += logs.length * weight;
      if (todayCompleted.has(h.id) && h.habitType !== 'avoid') todayXp += weight;
    }
    const currentLevel = calcLevel(totalXp);

    // ── Musim pohon mingguan (Task 62, Opsi B) ──────────────────────
    // weeklyXp = XP sejak AWAL MINGGU (weekStartOf — menghormati setting
    // weekStart user, default Senin) sampai hari ini. Dasar tahap pohon
    // musiman yang reset tiap awal minggu di UI. ADDITIVE-ONLY: totalXp/
    // currentLevel all-time di atas TIDAK diubah (level = kenangan
    // kemenangan). Semantik mengikuti todayXp (60-e): habit 'avoid'
    // tidak berhak XP musim; uncheck hari itu ikut menurunkan XP musim.
    const seasonStartYmd = weekStartOf(todayYmd, weekStart);
    let weeklyXp = 0;
    for (const h of xpHabits) {
      if (h.habitType === 'avoid') continue;
      const logs = logsByHabit.get(h.id) ?? [];
      const weight = xpForDifficulty(h.difficulty);
      weeklyXp +=
        logs.filter((l) => l.ymd >= seasonStartYmd && l.ymd <= todayYmd).length * weight;
    }

    // ── Streak GLOBAL (M-1) ──
    // currentStreak: hari berturut dengan ≥1 habit selesai hingga hari ini
    // (hari ini belum selesai tidak memutus — konvensi computeStreakFromSet).
    // Task 60-c (audit 59-b2 MED): sadar-liburan — hari ketika SEMUA habit yang
    // jatuh tempo sedang libur = NETRAL (tidak putus, tanpa hari aman), jadi
    // hero "Streak Aktif" tidak lagi jatuh 0/2 saat user meliburkan SEMUA
    // habitnya padahal kartu tracker membekukan angka lama. Konsumen:
    // Progres (Streak Aktif/Rekor) & sinyal pohon.
    const vacPredByHabit = new Map<string, (ymd: string) => boolean>();
    for (const h of tracking) {
      vacPredByHabit.set(
        h.id,
        vacationDayPredicate(parseVacationIntervals(h.vacationIntervals), todayYmd),
      );
    }
    // Hari kandidat = union hari dalam interval liburan mana pun (≤ hari ini).
    const candidateVacDays = new Set<string>();
    for (const h of tracking) {
      for (const v of parseVacationIntervals(h.vacationIntervals)) {
        for (let c = v.start; c <= todayYmd; c = shiftYmd(c, 1)) {
          if (v.until !== null && c > v.until) break;
          candidateVacDays.add(c);
        }
      }
    }
    const allVacationDays = new Set<string>();
    for (const day of candidateVacDays) {
      // Habit yang jatuh tempo hari itu (abaikan liburan) → semua libur?
      const due = tracking.filter(
        (h) =>
          jakartaDateString(h.startDate as Date) <= day &&
          isScheduledOn(schedByHabit.get(h.id) ?? { kind: 'daily' }, day),
      );
      if (due.length > 0 && due.every((h) => vacPredByHabit.get(h.id)?.(day) === true)) {
        allVacationDays.add(day);
      }
    }
    const globalVacationDay = (ymd: string) => allVacationDays.has(ymd);
    const currentStreak = computeStreakFromSet(globalDoneDays, todayYmd, undefined, {
      vacationDay: globalVacationDay,
    });
    // bestStreak: run terpanjang all-time — computeStreakFromSet(set, D) =
    // panjang run yang BERAKHIR di D; cukup menguji ujung run (hari
    // sesudahnya tidak selesai) → O(hari selesai), bukan O(n²).
    let bestStreak = 0;
    for (const day of globalDoneDays) {
      if (globalDoneDays.has(shiftYmd(day, 1))) continue;
      const streak = computeStreakFromSet(globalDoneDays, day, undefined, {
        vacationDay: globalVacationDay,
      });
      if (streak > bestStreak) bestStreak = streak;
    }

    // ── Rata-rata mood/energi/tidur (M-2) ──
    // Null bila tidak ada nilai; rata-rata hanya dari log yang terisi.
    const avgOf = (pick: (d: { mood: number | null; energy: number | null; sleep: number | null }) => number | null): number | null => {
      const vals = dailyLogs.map(pick).filter((v): v is number => v !== null && Number.isFinite(v));
      return vals.length > 0 ? round1(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
    };
    const moodAvg = avgOf((d) => d.mood);
    const energyAvg = avgOf((d) => d.energy);
    const sleepAvg = avgOf((d) => d.sleep);

    // ── Habit terbaik / terburuk (rate periode) ──
    // Task 37: denominator = hari TERJADWAL dalam periode (habit mingguan
    // dihitung jujur — 1×/minggu konsisten = rate tinggi, bukan 14%).
    type HabitRate = { id: string; name: string; emoji: string; rate: number; done: number; days: number };
    const rates: HabitRate[] = [];
    for (const h of tracking) {
      // BUGHUNT-54 (3-c #1b): habit libur (vacationMode) BUKAN kandidat
      // best/worst — rate-nya menyesatkan selama libur (0% → sinyal pohon
      // "Daun Menguning" bertabrakan dengan "Dorman" utk habit yang sama).
      // Konsumen worstHabit (tile Peringkat + sinyal pohon) sama-sama ingin
      // habit yang benar-benar melemah, bukan yang sedang beristirahat.
      if (h.vacationMode) continue;
      const startYmdHabit = jakartaDateString(h.startDate as Date);
      const effStart = startYmdHabit > startYmd ? startYmdHabit : startYmd;
      if (effStart > todayYmd) continue;
      const schedH = schedByHabit.get(h.id) ?? { kind: 'daily' };
      const days = scheduledCountBetween(schedH, effStart, todayYmd);
      if (days <= 0) continue;
      // Task 39 (#6): numerator hanya log hari terjadwal (sejak effStart —
      // dulu pakai startYmd periode) + rate di-clamp 100 supaya habit yang
      // jadwalnya diubah tidak menampilkan rate >100%.
      const done = (logsByHabit.get(h.id) ?? []).filter(
        (l) => l.ymd >= effStart && l.ymd <= todayYmd && isScheduledOn(schedH, l.ymd),
      ).length;
      rates.push({ id: h.id, name: h.name, emoji: h.emoji, rate: Math.min(100, Math.round((done / days) * 100)), done, days });
    }
    rates.sort((a, b) => b.rate - a.rate || b.done - a.done);
    const bestRate = rates[0] ?? null;
    const worstRate =
      rates.length >= 2 ? rates[rates.length - 1] : null;
    const bestHabit = bestRate ? { id: bestRate.id, name: bestRate.name, emoji: bestRate.emoji, rate: bestRate.rate } : null;
    const worstHabit = worstRate
      ? { id: worstRate.id, name: worstRate.name, emoji: worstRate.emoji, rate: worstRate.rate }
      : null;

    // ── Chart (M-3) ──
    // completedByDate: jumlah log completed habit BERJALAN per tanggal.
    // Task 39 (#5): dulu numerator memuat SEMUA log (termasuk habit yang
    // sudah lulus/diarsipkan) sedangkan denominator `due` hanya habit
    // tracking — semesta beda membuat "Terlewat" = 0 palsu & bar
    // "Penyelesaian" menggelembung setelah habit diwisudakan.
    const completedByDate = new Map<string, number>();
    for (const log of allCompleted) {
      if (!trackingIds.has(log.habitId)) continue;
      const ymd = ymdOf(log.date as Date);
      completedByDate.set(ymd, (completedByDate.get(ymd) ?? 0) + 1);
    }
    const buildDailyChart = (fromYmd: string, toYmd: string): ChartDay[] => {
      const chart: ChartDay[] = [];
      for (let cursor = fromYmd; cursor <= toYmd; cursor = shiftYmd(cursor, 1)) {
        // Task 37: due = habit yang jadwalnya memang hari itu.
        const due = tracking.filter(
          (h) =>
            jakartaDateString(h.startDate as Date) <= cursor &&
            isScheduledOn(schedByHabit.get(h.id) ?? { kind: 'daily' }, cursor),
        ).length;
        const completed = completedByDate.get(cursor) ?? 0;
        chart.push({ date: cursor, completed, missed: Math.max(0, due - completed) });
      }
      return chart;
    };
    // Agregasi mingguan (minggu kalender, Senin-awal default) — bucket
    // berlabel tanggal awal minggunya; dipakai bila jendela > 90 hari.
    const buildWeeklyChart = (fromYmd: string, toYmd: string): ChartDay[] => {
      const buckets = new Map<string, { completed: number; missed: number }>();
      for (let cursor = fromYmd; cursor <= toYmd; cursor = shiftYmd(cursor, 1)) {
        const wk = weekStartOf(cursor, weekStart);
        const b = buckets.get(wk) ?? { completed: 0, missed: 0 };
        // Task 37: due = habit yang jadwalnya memang hari itu.
        const due = tracking.filter(
          (h) =>
            jakartaDateString(h.startDate as Date) <= cursor &&
            isScheduledOn(schedByHabit.get(h.id) ?? { kind: 'daily' }, cursor),
        ).length;
        const completed = completedByDate.get(cursor) ?? 0;
        b.completed += completed;
        b.missed += Math.max(0, due - completed);
        buckets.set(wk, b);
      }
      return Array.from(buckets.entries())
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, v]) => ({ date, completed: v.completed, missed: v.missed }));
    };

    const weeklyChart = buildDailyChart(shiftYmd(todayYmd, -6), todayYmd);
    // monthlyChart ("Tren Penyelesaian") jujur mengikuti jendela periode:
    // 7 → 7 titik, 30 → 30, 90 → 90, all → seluruh jendela; jendela > 90
    // hari → agregasi mingguan (maks ~90 titik terakhir).
    const chartWindowDays = daysBetween(startYmd, todayYmd);
    const monthlyChartUnit: 'day' | 'week' = chartWindowDays > 90 ? 'week' : 'day';
    let monthlyChart =
      monthlyChartUnit === 'week' ? buildWeeklyChart(startYmd, todayYmd) : buildDailyChart(startYmd, todayYmd);
    if (monthlyChart.length > 90) monthlyChart = monthlyChart.slice(-90);
    // Sumber "Pola Mingguan": 90 hari terakhir (harian, dibatasi ketersediaan
    // data) — stabil lintas periode, tetap harian meski tren mingguan.
    const earliestDoneYmd = [...globalDoneDays].sort().at(0) ?? todayYmd;
    const patternStart = earliestDoneYmd > shiftYmd(todayYmd, -89) ? earliestDoneYmd : shiftYmd(todayYmd, -89);
    const patternChart = buildDailyChart(patternStart, todayYmd);

    // ── Performa kategori habit (periode) ──
    const categoryCounts = new Map<string, number>();
    for (const log of allCompleted) {
      const ymd = ymdOf(log.date as Date);
      if (ymd < startYmd || ymd > todayYmd) continue;
      const habit = habits.find((h) => h.id === log.habitId);
      if (!habit) continue;
      categoryCounts.set(habit.category, (categoryCounts.get(habit.category) ?? 0) + 1);
    }
    const categoryChart = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || (a.category < b.category ? -1 : 1));

    // ── Fokus hari ini (L-8: priority dari habit) ──
    // Task 37: hanya habit yang JADWALNYA hari ini (habit mingguan tidak
    // ikut menagih di hari kosongnya).
    // BUGHUNT-47 (47-c #2): habit libur (vacationMode) juga disaring — dulu
    // focusToday memuatnya sebagai pending → hero Beranda "X dari Y"
    // menghitung habit libur, TIDAK KONSISTEN dengan KPI "Hari Ini %" &
    // tracker yang sama-sama mengecualikannya (Task 39 #4).
    const focusToday = tracking
      .filter(
        (h) =>
          !h.vacationMode &&
          jakartaDateString(h.startDate as Date) <= todayYmd &&
          isScheduledOn(schedByHabit.get(h.id) ?? { kind: 'daily' }, todayYmd),
      )
      .map((h) => ({
        id: h.id,
        name: h.name,
        emoji: h.emoji,
        priority: h.priority,
        completed: todayCompleted.has(h.id),
        // CONNECTED-APP: kapabilitas habit — dipakai Beranda untuk memutuskan
        // bisa-diselesaikan-1-tap (normal) vs butuh tracker (amount/trackTime/
        // avoid). Additive; klien lama mengabaikan field tambahan.
        habitType: h.habitType,
        trackTime: !!h.trackTime,
        difficulty: h.difficulty,
        target: h.target ?? 0,
        value: logsByHabit.get(h.id)?.find((l) => l.ymd === todayYmd)?.value ?? 0,
      }));

    // ── Terakhir dikerjakan + streak ──
    const lastDone = tracking.map((h) => {
      const logs = logsByHabit.get(h.id) ?? [];
      const lastDate = logs.length ? logs.map((l) => l.ymd).sort().at(-1) ?? null : null;
      // Task 37: streak per-habit sadar jadwal (hari di luar jadwal tidak putus).
      // Task 39 (#4c): habit avoid — streak = hari BERSIH berturut sejak
      // kambuh terakhir (invers), konsisten dengan kartu tracker.
      // Task 60-c: streak per-habit kini juga (a) sadar-liburan — interval
      // permanen = hari netral, mode aktif legacy = beku (dulu hero streak
      // 0/2 saat semua habit libur padahal kartu tracker membekukan 10);
      // (b) dibatasi lantai startDate (dulu habit baru bisa "streak lintas
      // masa" bila ada log pra-mulai); (c) avoid memakai computeAvoidStreak
      // bersama yang menghitung hari bersih HARI INI (audit 59-b2 off-by-one).
      const sched = schedByHabit.get(h.id);
      const logSet = new Set(logs.map((l) => l.ymd));
      const vacPred = vacPredByHabit.get(h.id);
      const walkOpts = {
        startDate: jakartaDateString(h.startDate as Date),
        onVacation: !!h.vacationMode,
        vacationDay: vacPred,
      };
      const streak =
        h.habitType === 'avoid'
          ? computeAvoidStreak(logSet, todayYmd, sched, walkOpts)
          : computeStreakFromSet(logSet, todayYmd, sched, walkOpts);
      return { id: h.id, name: h.name, emoji: h.emoji, lastDate, streak };
    });

    // ── Waktu terlacak (habit trackTime, menit = Σ value periode) ──
    const timeTracked = tracking
      .filter((h) => h.trackTime)
      .map((h) => {
        const logs = (logsByHabit.get(h.id) ?? []).filter((l) => l.ymd >= startYmd && l.ymd <= todayYmd);
        return { id: h.id, name: h.name, emoji: h.emoji, minutes: logs.reduce((s, l) => s + l.value, 0) };
      });

    // ── Overview keuangan bulan berjalan ──
    // Task 70 (audit 70-c #5): monthTx sudah terfilter bulan berjalan di
    // where Prisma — saringan JS startsWith(prefix) dihapus.
    let monthIncome = 0;
    let monthExpense = 0;
    const spentByCategory = new Map<string, number>();
    for (const tx of monthTx) {
      if (tx.type === 'income') monthIncome += tx.amount;
      else if (tx.type === 'expense') {
        monthExpense += tx.amount;
        spentByCategory.set(tx.category, (spentByCategory.get(tx.category) ?? 0) + tx.amount);
      }
    }
    const budgetTotal = budgetRows.reduce((s, b) => s + b.amount, 0);
    const budgetSpent = budgetRows.reduce((s, b) => s + (spentByCategory.get(b.category) ?? 0), 0);

    return NextResponse.json({
      greeting: { userName: settings?.userName ?? 'User' },
      kpi: {
        totalHabits,
        // Task 36 — jumlah habit yang sudah diwisuda (graduatedAt terisi).
        // Dipakai KPI Total Habit: "🎓 N lulus" — bukti pernah menyelesaikan.
        graduatedCount: habits.filter((h) => h.graduatedAt).length,
        activeToday,
        successToday,
        weeklyRate,
        monthlyRate,
        consistencyScore,
        currentStreak,
        bestStreak,
        totalXp,
        currentLevel,
        moodAvg,
        sleepAvg,
        energyAvg,
        todayXp,
        // Task 62 (Opsi B) — musim pohon mingguan (tahap reset tiap Senin).
        weeklyXp,
        seasonStartYmd,
        completion7d,
        completion30d,
      },
      bestHabit,
      worstHabit,
      weeklyChart,
      monthlyChart,
      // 'day' | 'week' — granularitas monthlyChart (judul chart klien jujur).
      monthlyChartUnit,
      patternChart,
      categoryChart,
      focusToday,
      lastDone,
      timeTracked,
      quote: pickDailyQuote(),
      financeOverview: {
        monthIncome: Math.round(monthIncome),
        monthExpense: Math.round(monthExpense),
        monthNet: Math.round(monthIncome - monthExpense),
        budgetTotal: Math.round(budgetTotal),
        budgetSpent: Math.round(budgetSpent),
      },
    });
  } catch (error) {
    return handleApiError(error, 'dashboard:GET');
  }
}
