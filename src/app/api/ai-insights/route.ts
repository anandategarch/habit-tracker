// GET /api/ai-insights — insight personal (mood/tidur/performa/streak/keuangan).
// Mencoba LLM z-ai-web-dev-sdk (system prompt bahasa Indonesia, analisis data
// nyata); bila SDK gagal / respons tidak valid → fallback statis terhitung.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, round1, ymdOf } from '@/app/api/_lib/api-utils';
import { computeAvoidStreak, computeStreakFromSet, shiftYmd } from '@/lib/dashboard-helpers';
import { isScheduledOn, parseSchedule } from '@/lib/habit-schedule';
import { dateFromYMD, jakartaDateString, jakartaMonthString } from '@/lib/timezone';
import { ensureHabitGraduation } from '@/app/api/_lib/habit-ensure';
import { parseVacationIntervals, vacationDayPredicate } from '@/lib/habit-vacation';
import ZAI from 'z-ai-web-dev-sdk';

export const dynamic = 'force-dynamic';

// Task 60-d (audit 59-b5 LOW-MED): timeout LLM 20s > durasi default fungsi
// Vercel → fallback statis tak pernah sempat jalan (user kena 504 duluan).
// 60 detik = batas Hobby plan.
export const maxDuration = 60;

type InsightType = 'mood' | 'sleep' | 'performance' | 'streak' | 'finance';

interface InsightItem {
  id: string;
  type: InsightType;
  title: string;
  text: string;
  habitId?: string;
}

const VALID_TYPES: ReadonlySet<string> = new Set(['mood', 'sleep', 'performance', 'streak', 'finance']);
const LLM_TIMEOUT_MS = 20_000;

function insightCounter(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `insight-${n}`;
  };
}

/** Ekstrak array JSON dari teks LLM (tolerasi code fence / teks pembuka). */
function parseInsightsArray(raw: string): Array<Record<string, unknown>> | null {
  const cleaned = raw.replace(/```json/gi, '```').replace(/```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((item) => item !== null && typeof item === 'object' && !Array.isArray(item));
  } catch {
    return null;
  }
}

function validInsight(item: Record<string, unknown>): boolean {
  if (typeof item.type !== 'string' || !VALID_TYPES.has(item.type)) return false;
  if (typeof item.title !== 'string' || !item.title.trim() || item.title.length > 120) return false;
  if (typeof item.text !== 'string' || !item.text.trim() || item.text.length > 600) return false;
  if (item.habitId !== undefined && item.habitId !== null && typeof item.habitId !== 'string') return false;
  return true;
}

export async function GET() {
  try {
    // Task 60-d (audit 59-b5): select memuat kolom hasil DDL runtime
    // (scheduleJson dsb.) — pastikan dulu kolomnya ada di DB produksi segar
    // (pola /api/habits; tanpa ini route 500 pada instance pertama).
    await ensureHabitGraduation();
    const todayYmd = jakartaDateString();
    const startYmd30 = shiftYmd(todayYmd, -29);
    const startYmd14 = shiftYmd(todayYmd, -13);
    const month = jakartaMonthString();

    const [settings, habits, allLogs, daily14, monthTx] = await Promise.all([
      db.appSettings.findUnique({ where: { id: 'singleton' }, select: { userName: true } }),
      // Task 39 (#8): habit LULUS keluar dari pool insight — dulu masih
      // dibandingkan dengan habit berjalan (rate/streak campur).
      // Task 60-d (audit 59-b2 MED): habitType + startDate + liburan ikut
      // di-select supaya statistik avoid INVERS (kambuh ≠ sukses) dan
      // streak sadar-liburan — dulu insight MEMUJI kambuh ("terbaik 100%",
      // "sudah N hari") karena relapse dihitung sebagai done.
      db.habit.findMany({
        where: { isActive: true, isArchived: false, graduatedAt: null },
        select: {
          id: true,
          name: true,
          emoji: true,
          category: true,
          difficulty: true,
          habitType: true,
          trackTime: true,
          scheduleJson: true,
          startDate: true,
          vacationMode: true,
          vacationIntervals: true,
        },
        orderBy: { sortOrder: 'asc' },
      }),
      // Task 39 (#8): log TANPA batas 30 hari — window 30 hari tetap
      // diterapkan per keperluan (doneLast30), tapi streak perlu riwayat
      // penuh supaya sepakat dengan dashboard/kartu (dulu terpotong 30).
      db.habitLog.findMany({
        where: { completed: true },
        select: { habitId: true, date: true, value: true },
      }),
      db.dailyLog.findMany({
        where: { date: { gte: dateFromYMD(startYmd14), lte: dateFromYMD(todayYmd) } },
        select: { mood: true, energy: true, sleep: true },
      }),
      db.transaction.findMany({
        where: { type: { in: ['income', 'expense'] }, date: { gte: dateFromYMD(`${month}-01`) } },
        select: { type: true, amount: true, date: true },
      }),
    ]);

    const userName = settings?.userName ?? 'User';

    // ── Ringkasan data untuk LLM & fallback ──
    const doneByHabit = new Map<string, number>();
    for (const log of allLogs) {
      const ymd = ymdOf(log.date as Date);
      if (ymd < startYmd30 || ymd > todayYmd) continue;
      doneByHabit.set(log.habitId, (doneByHabit.get(log.habitId) ?? 0) + 1);
    }
    // Streak berjalan per habit (riwayat penuh — Task 39 #8).
    const habitLogsYmd = new Map<string, Set<string>>();
    for (const log of allLogs) {
      const ymd = ymdOf(log.date as Date);
      if (!habitLogsYmd.has(log.habitId)) habitLogsYmd.set(log.habitId, new Set());
      habitLogsYmd.get(log.habitId)!.add(ymd);
    }
    // Guard 11-c: nama habit yang dikirim ke PROMPT LLM dipotong 40 char
    // (payload ringkas, tahan nama panjang/aneh — output tetap divalidasi;
    // fallback statis memakai nama penuh).
    const llmName = (name: string): string => (name.length > 40 ? `${name.slice(0, 40)}…` : name);
    // Task 60-c: predikat hari-libur per habit (interval permanen — hari
    // netral untuk rate & streak; habit libur TIDAK jadi kandidat best/worst
    // karena rate-nya menyesatkan, pola dashboard BUGHUNT-54 3-c #1b).
    const vacPredByHabit = new Map<string, (ymd: string) => boolean>();
    for (const h of habits) {
      vacPredByHabit.set(
        h.id,
        vacationDayPredicate(parseVacationIntervals(h.vacationIntervals), todayYmd),
      );
    }
    const habitStats = habits.map((h) => {
      // Task 39 (#8): denominator rate30 = hari TERJADWAL dalam 30 hari
      // (bukan 30 mentah) — habit 1×/minggu yang konsisten dinilai 23%
      // padahal sebenarnya 100%. Clamp 100 seperti dashboard.
      // Task 60-d: untuk habit AVOID semantik INVERS — done = hari BERSIH
      // (tanpa log kambuh), bukan jumlah kambuh; hari libur keluar dari
      // denominator supaya tidak difitnah "buruk" saat sedang istirahat.
      const sched = parseSchedule(h.scheduleJson);
      const isAvoid = h.habitType === 'avoid';
      const vacDay = vacPredByHabit.get(h.id) ?? (() => false);
      let scheduledDays = 0;
      for (let c = startYmd30; c <= todayYmd; c = shiftYmd(c, 1)) {
        if (isScheduledOn(sched, c) && !vacDay(c)) scheduledDays += 1;
      }
      // Relapse days dalam jendela (hanya yang terjadwal & tidak libur).
      const relapseDays = (habitLogsYmd.get(h.id) ?? new Set<string>());
      const relapsesWindow = [...relapseDays].filter(
        (d) => d >= startYmd30 && d <= todayYmd && isScheduledOn(sched, d) && !vacDay(d),
      ).length;
      const doneWindow = isAvoid
        ? Math.max(0, scheduledDays - relapsesWindow)
        : doneByHabit.get(h.id) ?? 0;
      return {
        id: h.id,
        name: h.name,
        category: h.category,
        difficulty: h.difficulty,
        tipe: isAvoid ? 'avoid' : 'biasa',
        doneLast30: doneWindow,
        rate30: scheduledDays > 0 ? Math.min(100, Math.round((doneWindow / scheduledDays) * 100)) : 0,
      };
    });

    const moodAvg = daily14.length ? round1(daily14.reduce((s, d) => s + (d.mood ?? 3), 0) / daily14.length) : null;
    const sleepAvg = daily14.length ? round1(daily14.reduce((s, d) => s + (d.sleep ?? 7), 0) / daily14.length) : null;
    const energyAvg = daily14.length ? round1(daily14.reduce((s, d) => s + (d.energy ?? 3), 0) / daily14.length) : null;

    let monthIncome = 0;
    let monthExpense = 0;
    for (const tx of monthTx) {
      if (!ymdOf(tx.date as Date).startsWith(month)) continue;
      if (tx.type === 'income') monthIncome += tx.amount;
      else monthExpense += tx.amount;
    }
    const monthNet = monthIncome - monthExpense;
    const savingRate = monthIncome > 0 ? Math.round((monthNet / monthIncome) * 100) : null;

    interface HabitStreak {
      id: string;
      name: string;
      streak: number;
    }
    const streaks: HabitStreak[] = habits.map((h) => {
      const days = habitLogsYmd.get(h.id) ?? new Set<string>();
      // Task 36: pakai helper bersama (hari aman) supaya insight streak
      // selalu sepakat dengan kartu habit & dashboard — dulu loop manual
      // di sini bisa menilai "streak putus" padahal kartu bilang masih hidup.
      // Task 37: streak sadar jadwal (hari di luar jadwal tidak putus).
      // Task 60-d: avoid = hari BERSIH (invers — dulu kambuh dihitung
      // sebagai streak "sudah N hari"); + sadar-liburan & lantai start.
      const walkOpts = {
        startDate: h.startDate ? jakartaDateString(h.startDate as Date) : null,
        onVacation: !!h.vacationMode,
        vacationDay: vacPredByHabit.get(h.id),
      };
      return {
        id: h.id,
        name: h.name,
        streak:
          h.habitType === 'avoid'
            ? computeAvoidStreak(days, todayYmd, h.scheduleJson, walkOpts)
            : computeStreakFromSet(days, todayYmd, h.scheduleJson, walkOpts),
      };
    });
    const topStreak: HabitStreak | null = streaks.reduce<HabitStreak | null>(
      (best, s) => (best === null || s.streak > best.streak ? s : best),
      null,
    );

    // ── Fallback statis (dihitung dari data nyata, bahasa Indonesia) ──
    const fallback: InsightItem[] = [];
    const genId = insightCounter();

    const sortedByRate = [...habitStats]
      // Task 60-c (pola dashboard 3-c #1b): habit yang SEDANG libur bukan
      // kandidat terbaik/terburuk — rate-nya menyesatkan selama istirahat.
      .filter((s) => {
        const h = habits.find((hh) => hh.id === s.id);
        return !h?.vacationMode;
      })
      .sort((a, b) => b.rate30 - a.rate30);
    const bestHabit = sortedByRate[0] ?? null;
    const worstHabit = sortedByRate.length >= 2 ? sortedByRate[sortedByRate.length - 1] : null;
    const statUnit = (s: { tipe: string }) => (s.tipe === 'avoid' ? 'hari bersih' : 'selesai');

    if (moodAvg !== null) {
      fallback.push({
        id: genId(),
        type: 'mood',
        title: 'Mood kamu stabil',
        text:
          moodAvg >= 4
            ? `Rata-rata mood ${moodAvg.toFixed(1)} dari 5 dalam 14 hari terakhir — suasana hatimu sedang bagus. Pertahankan ritme yang sudah berjalan, ${userName}.`
            : moodAvg >= 3
              ? `Rata-rata mood ${moodAvg.toFixed(1)} dari 5 dalam 14 hari terakhir. Coba sisihkan 10 menit untuk hal yang kamu nikmati — mood kecil naik, hari terasa lebih ringan.`
              : `Rata-rata mood ${moodAvg.toFixed(1)} dari 5 dalam 14 hari terakhir — cukup rendah. Prioritaskan tidur dan aktivitas fisik ringan dulu sebelum menambah target baru.`,
      });
    }
    if (sleepAvg !== null) {
      fallback.push({
        id: genId(),
        type: 'sleep',
        title: sleepAvg !== null && sleepAvg < 7 ? 'Tidur masih kurang' : 'Tidur kamu cukup',
        text:
          sleepAvg < 6
            ? `Rata-rata tidur ${sleepAvg.toFixed(1)} jam — jauh di bawah kebutuhan. Kurangi layar 30 menit sebelum tidur dan majukan jadwal tidur 15 menit tiap minggu.`
            : sleepAvg < 7
              ? `Rata-rata tidur ${sleepAvg.toFixed(1)} jam, masih sedikit di bawah anjuran 7–8 jam. Tidur 30 menit lebih awal bisa membuat konsistensi habit naik terasa.`
              : `Rata-rata tidur ${sleepAvg.toFixed(1)} jam dalam 14 hari terakhir — sudah ideal. Tidur yang cukup adalah fondasi streak terpanjangmu.`,
      });
    }
    if (bestHabit) {
      fallback.push({
        id: genId(),
        type: 'performance',
        title: 'Habit terbaik bulan ini',
        text: `"${bestHabit.name}" ${statUnit(bestHabit)} ${bestHabit.doneLast30} dari 30 hari terakhir (rate ${bestHabit.rate30}%${energyAvg !== null ? `, energi rata-rata ${energyAvg.toFixed(1)}` : ''}). Gunakan momentum ini untuk menautkan habit baru yang lebih sulit.`,
        habitId: bestHabit.id,
      });
    }
    if (worstHabit && worstHabit.rate30 < bestHabit.rate30) {
      fallback.push({
        id: genId(),
        type: 'performance',
        title: 'Habit yang perlu perhatian',
        text: `"${worstHabit.name}" baru ${statUnit(worstHabit)} ${worstHabit.doneLast30} dari 30 hari (${worstHabit.rate30}%). Kecilkan target jadi versi 2 menit dulu — naikkan lagi setelah 5 hari berturut-turut.`,
        habitId: worstHabit.id,
      });
    }
    if (topStreak && topStreak.streak >= 2) {
      // Task 60-d: avoid — "N hari" berarti hari BERSIH (bukan hari selesai).
      const topIsAvoid = habits.find((h) => h.id === topStreak.id)?.habitType === 'avoid';
      fallback.push({
        id: genId(),
        type: 'streak',
        title: 'Streak terpanjang berjalan',
        text: `"${topStreak.name}" sudah ${topStreak.streak} hari ${topIsAvoid ? 'bersih ' : ''}berturut-turut. Jangan putus hari ini — satu centang kecil cukup untuk menjaga rantainya.`,
        habitId: topStreak.id,
      });
    } else {
      fallback.push({
        id: genId(),
        type: 'streak',
        title: 'Waktunya memulai streak baru',
        text: 'Belum ada habit dengan streak aktif minimal 2 hari. Pilih satu habit termudah dan centang hari ini — hari pertama selalu yang paling menentukan.',
      });
    }
    if (monthIncome > 0 || monthExpense > 0) {
      const expenseText = `Pengeluaran bulan ini ${Math.round(monthExpense).toLocaleString('id-ID')} vs pemasukan ${Math.round(monthIncome).toLocaleString('id-ID')}.`;
      fallback.push({
        id: genId(),
        type: 'finance',
        title: monthNet >= 0 ? 'Arus kas masih sehat' : 'Pengeluaran melebihi pemasukan',
        text:
          monthNet >= 0
            ? `${expenseText} Sisa ${Math.round(monthNet).toLocaleString('id-ID')}${savingRate !== null ? ` (tingkat menabung ${savingRate}%)` : ''}. Sisihkan sebagian ke target tabungan sebelum terpakai lain.`
            : `${expenseText} Defisit ${Math.round(-monthNet).toLocaleString('id-ID')}. Tinjau kategori pengeluaran terbesar dan tunda konsumsi non-esensial seminggu.`,
      });
    } else {
      fallback.push({
        id: genId(),
        type: 'finance',
        title: 'Data keuangan masih kosong',
        text: 'Belum ada transaksi bulan ini. Catat minimal pengeluaran harian selama 7 hari agar insight keuangan mulai terbentuk.',
      });
    }

    // ── Coba LLM (z-ai-web-dev-sdk) dengan ringkasan data ──
    let insights = fallback;
    try {
      const summary = {
        aplikasi: 'Rutina (habit + keuangan)',
        pengguna: userName,
        periodeHabit: '30 hari terakhir',
        habit: habitStats.map((h) => ({ ...h, name: llmName(h.name) })),
        catatanHabitAvoid:
          "Habit bertipe 'avoid' berarti MENJAUHI sesuatu: doneLast30 = jumlah hari BERSIH tanpa kambuh dan rate30 = persen hari bersih. JANGAN memuji kambuh; kalau angkanya buruk, bicara tentang hari bersih/strategy menghindar, bukan 'selesai'.",
        moodRata14Hari: moodAvg,
        tidurRata14Hari: sleepAvg,
        energiRata14Hari: energyAvg,
        keuanganBulanIni: {
          bulan: month,
          pemasukan: Math.round(monthIncome),
          pengeluaran: Math.round(monthExpense),
          net: Math.round(monthNet),
          tingkatMenabungPct: savingRate,
        },
        streakBerjalan: streaks.map((s) => ({ ...s, name: llmName(s.name) })),
      };

      const zai = await ZAI.create();
      const llmPromise = zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content:
              'Kamu adalah asisten analitik pribadi pada aplikasi Rutina (habit tracker + keuangan, pengguna Indonesia). ' +
              'Balas HANYA dengan array JSON (tanpa teks lain) berisi 4-6 insight dari data pengguna. ' +
              'Setiap elemen: {"type": "mood" | "sleep" | "performance" | "streak" | "finance", "title": string (maks 60 karakter), "text": string (1-3 kalimat), "habitId": string (opsional, id habit terkait)}. ' +
              'Seluruh teks WAJIB bahasa Indonesia yang hangat, spesifik dengan angka dari data, membangun, tanpa label Inggris. ' +
              "Habit tipe 'avoid' = habit MENJAUHI: doneLast30/rate30-nya mengukur hari BERSIH tanpa kambuh — pujilah hari bersih, jangan pernah menyebut kambuh sebagai pencapaian.",
          },
          {
            role: 'user',
            content: `Analisis data berikut dan buat insight:\n${JSON.stringify(summary)}`,
          },
        ],
        thinking: { type: 'disabled' },
      });
      // Task 61-h (audit 61-c P2-1): handler no-op supaya rejeksi llmPromise
      // yang kalah race (timeout menang duluan) tidak menjadi
      // unhandledRejection pasca-response; hasil Promise.race tidak berubah.
      llmPromise.catch(() => {});
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('LLM timeout')), LLM_TIMEOUT_MS);
      });
      try {
        const completion = await Promise.race([llmPromise, timeoutPromise]);
        const content = String((completion as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content ?? '');
        const parsed = content ? parseInsightsArray(content) : null;

        if (parsed && parsed.length > 0) {
          const valid = parsed.filter(validInsight).slice(0, 8);
          if (valid.length > 0) {
            const llmId = insightCounter();
            insights = valid.map((item) => ({
              id: llmId(),
              type: item.type as InsightType,
              title: (item.title as string).trim(),
              text: (item.text as string).trim(),
              habitId: typeof item.habitId === 'string' && habits.some((h) => h.id === item.habitId) ? item.habitId : undefined,
            }));
          }
        }
      } finally {
        // Task 61-h: timer harus mati begitu race selesai — tanpa ini instance
        // tetap hidup 20 dtk setelah response (boros waktu serverless).
        clearTimeout(timeoutId);
      }
    } catch (llmError) {
      // SDK gagal / timeout / respons tidak valid → pakai fallback statis.
      console.error('[api:ai-insights:GET] LLM gagal, pakai fallback:', llmError);
    }

    return NextResponse.json({ insights });
  } catch (error) {
    return handleApiError(error, 'ai-insights:GET');
  }
}
