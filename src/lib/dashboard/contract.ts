// lib/dashboard/contract.ts — adapter payload /api/dashboard (kontrak
// recovery/API-CONTRACT.md) → DashboardData yang dikonsumsi dashboard.tsx.
//
// Prinsip:
//  * TIDAK menduplikasi logika lib/dashboard-helpers yang sudah ada —
//    calcLevel/levelProgress dipakai langsung di sini.
//  * Semua field kontrak dibaca defensif (opsional) dan dinormalisasi ke
//    bentuk tegas; NaN/Infinity tidak pernah lolos ke UI.
//  * Label hari/tanggal Indonesia via lib/date-utils (eeeIdFormatter dst.)
//    pada Date yang dibangun dari YMD (konvensi TZ app — bukan parse lokal).
//  * Fix 11-c: streak (currentStreak/bestStreak) TIDAK lagi dihitung klien —
//    /api/dashboard kini mengirim keduanya (GLOBAL, satu sumber kebenaran);
//    KPI "7/30 Hari" memakai completion7d/30d (rolling), cincin "Minggu/Bulan
//    Ini" memakai weeklyRate/monthlyRate (calendar-to-date) — label jujur.

import {
  calcLevel,
  levelProgress,
} from '@/lib/dashboard-helpers';
import {
  eeeIdFormatter,
  eeeeIdFormatter,
  mmmDdIdFormatter,
} from '@/lib/date-utils';
import { dateFromYMD } from '@/lib/timezone';
import { isValidYMD } from '@/lib/timezone';
import type {
  BestWorstHabit,
  DashboardApiDay,
  DashboardApiPayload,
  DashboardData,
  LastDoneHabitSummary,
  MonthlyChartDatum,
  Period,
  StackedBarDatum,
  TimeTrackedHabitSummary,
  TodayFocusItem,
  WeeklyPatternDatum,
} from '@/components/habit-tracker/dashboard-types';

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Persentase pembulatan 0–100 dengan pembagi nol aman. */
const pct = (part: number, whole: number): number =>
  whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0;

const FALLBACK_BEST: BestWorstHabit = { name: 'Belum ada data', icon: '🏆', rate: 0 };
const FALLBACK_WORST: BestWorstHabit = { name: 'Belum ada data', icon: '🌱', rate: 0 };

// Pola mingguan diurut Senin..Minggu (weekStartsOn 1 — default locale app).
const PATTERN_DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function validDays(raw: unknown): DashboardApiDay[] {
  return list<DashboardApiDay>(raw).filter(
    (d) => d && typeof d === 'object' && isValidYMD((d as DashboardApiDay).date),
  );
}

interface ApiHabitWithRate {
  id?: string;
  name?: string;
  emoji?: string;
  rate?: number;
}

function mapBestWorst(raw: ApiHabitWithRate | null | undefined, fallback: BestWorstHabit): BestWorstHabit {
  if (!raw || typeof raw !== 'object' || !raw.name) return fallback;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : undefined,
    name: raw.name,
    icon: raw.emoji || fallback.icon,
    rate: num(raw.rate),
  };
}

/**
 * Konversi payload /api/dashboard → DashboardData.
 * `period` dipakai untuk memilih sumber data chart bertumpuk (7d → mingguan,
 * selain itu → 30 hari) mengikuti pola chart-builders lama.
 */
export function toDashboardData(payload: DashboardApiPayload, period: Period): DashboardData {
  const raw = (payload && typeof payload === 'object' ? payload : {}) as DashboardApiPayload;
  const kpi = (raw.kpi && typeof raw.kpi === 'object' ? raw.kpi : {}) as NonNullable<DashboardApiPayload['kpi']>;

  const weeklyChart = validDays(raw.weeklyChart);
  const monthlyChart = validDays(raw.monthlyChart);
  // Fix 11-c M-3: sumber "Pola Mingguan" — patternChart (harian 90 hari
  // terakhir dari API) bila ada; fallback monthlyChart harian.
  const patternChart = validDays(raw.patternChart);
  const patternSource = patternChart.length > 0 ? patternChart : monthlyChart;
  // Granularitas monthlyChart ('day' default) — judul chart klien jujur.
  const chartUnit: 'day' | 'week' = raw.monthlyChartUnit === 'week' ? 'week' : 'day';

  // ── Chart mingguan: nama hari penuh + rate per hari ────────────────────
  const weeklyChartData = weeklyChart.map((d) => {
    const completed = num(d.completed);
    const missed = num(d.missed);
    return {
      date: d.date,
      day: eeeeIdFormatter(dateFromYMD(d.date)),
      rate: pct(completed, completed + missed),
    };
  });

  // ── Chart 30 hari (tren) ──────────────────────────────────────────────
  const monthlyChartData: MonthlyChartDatum[] = monthlyChart.map((d) => ({
    date: d.date,
    completed: num(d.completed),
    missed: num(d.missed),
  }));

  // ── Bar bertumpuk "Detail": 7d → label hari pendek, lainnya '8 Sep' ────
  const stackedSource = period === '7d' ? weeklyChart : monthlyChart;
  const stackedBarData: StackedBarDatum[] = stackedSource.map((d) => {
    const day = dateFromYMD(d.date);
    return {
      label: period === '7d' ? eeeIdFormatter(day) : mmmDdIdFormatter(day),
      completed: num(d.completed),
      missed: num(d.missed),
    };
  });

  // ── Pola mingguan: rata-rata per hari-of-week ─────────────────────────
  // Fix 11-c M-3: dari patternChart (90 hari terakhir) — stabil lintas
  // periode dan tetap harian meski monthlyChart mingguan.
  const buckets = Array.from({ length: 7 }, () => ({ completed: 0, missed: 0 }));
  for (const d of patternSource) {
    const dow = dateFromYMD(d.date).getUTCDay(); // 0=Min..6=Sab
    const idx = (dow + 6) % 7; // Senin-first
    buckets[idx].completed += num(d.completed);
    buckets[idx].missed += num(d.missed);
  }
  const weeklyPattern: WeeklyPatternDatum[] = buckets.map((b, i) => ({
    day: PATTERN_DAYS[i],
    rate: pct(b.completed, b.completed + b.missed),
  }));

  // ── Streak (M-1): langsung dari kpi API — klien tidak lagi ────────
  // menghitung (dulu dihitung dari peta chart 7/30 hari → bestStreak
  // per-habit API bisa < currentStreak klien → KPI kontradiksi).
  const currentStreak = num(kpi.currentStreak);

  const totalXP = num(kpi.totalXp);
  const currentLevel =
    typeof kpi.currentLevel === 'number' && Number.isFinite(kpi.currentLevel)
      ? kpi.currentLevel
      : calcLevel(totalXP);

  // ── Fokus hari ini: hanya yang belum selesai (ChartInfo section parent) ─
  const todayFocus: TodayFocusItem[] = list<NonNullable<DashboardApiPayload['focusToday']>[number]>(
    raw.focusToday,
  )
    .filter((h) => h && typeof h === 'object' && h.id && h.name && !h.completed)
    .map((h) => ({
      id: h.id as string,
      name: h.name as string,
      icon: h.emoji || '✅',
      priority: typeof h.priority === 'string' ? h.priority : undefined,
    }));

  const lastDoneSummary: LastDoneHabitSummary[] = list<
    NonNullable<DashboardApiPayload['lastDone']>[number]
  >(raw.lastDone)
    .filter((h) => h && typeof h === 'object' && h.id && h.name)
    .map((h) => ({
      id: h.id as string,
      name: h.name as string,
      emoji: h.emoji || '✅',
      lastDate: isValidYMD(h.lastDate) ? (h.lastDate as string) : null,
      streak: num(h.streak),
    }));

  const timeTrackedSummary: TimeTrackedHabitSummary[] = list<
    NonNullable<DashboardApiPayload['timeTracked']>[number]
  >(raw.timeTracked)
    .filter((h) => h && typeof h === 'object' && h.id && h.name)
    .map((h) => ({
      id: h.id as string,
      name: h.name as string,
      emoji: h.emoji || '⏱️',
      minutes: num(h.minutes),
    }));

  const finance = (raw.financeOverview && typeof raw.financeOverview === 'object'
    ? raw.financeOverview
    : {}) as NonNullable<DashboardApiPayload['financeOverview']>;

  return {
    // KPI — konsistensi skor dipakai "Tingkat Selesai" + "Skor".
    // Fix 11-c L-3: "7/30 Hari" = completion rolling (completion7d/30d);
    // cincin "Minggu/Bulan Ini" = weekToDateRate/monthToDateRate
    // (calendar-to-date — jatuh ke rolling bila API tidak mengirim).
    totalHabits: num(kpi.totalHabits),
    // Task 36 — jumlah habit lulus (default 0 bila API lama tidak mengirim).
    graduatedCount: num(kpi.graduatedCount),
    completionRate: num(kpi.consistencyScore),
    currentStreak,
    longestStreak: num(kpi.bestStreak),
    successToday: num(kpi.successToday),
    weeklyCompletion: num(kpi.completion7d ?? kpi.weeklyRate),
    monthlyCompletion: num(kpi.completion30d ?? kpi.monthlyRate),
    weekToDateRate: num(kpi.weeklyRate),
    monthToDateRate: num(kpi.monthlyRate),
    totalXP,
    currentLevel,
    levelProgress: levelProgress(totalXP).pct,
    productivityScore: num(kpi.consistencyScore),
    moodAverage: numOrNull(kpi.moodAvg),
    sleepAverage: numOrNull(kpi.sleepAvg),
    energyAverage: numOrNull(kpi.energyAvg),

    weeklyChartData,
    categoryPerformance: list<{ category?: string; count?: number }>(raw.categoryChart)
      .filter((c) => c && typeof c === 'object' && c.category)
      .map((c) => ({ category: String(c.category), count: num(c.count) })),
    monthlyChartData,
    chartUnit,
    stackedBarData,
    weeklyPattern,

    bestHabit: mapBestWorst(raw.bestHabit, FALLBACK_BEST),
    worstHabit: mapBestWorst(raw.worstHabit, FALLBACK_WORST),
    todayFocus,
    lastDoneSummary,
    timeTrackedSummary,
    financeOverview: {
      monthIncome: num(finance.monthIncome),
      monthExpense: num(finance.monthExpense),
      monthNet: num(finance.monthNet),
      budgetTotal: num(finance.budgetTotal),
      budgetSpent: num(finance.budgetSpent),
    },
    // Kontrak rebuild belum mengirim statistik per-habit — section
    // "Performa Per Habit" di parent otomatis tersembunyi selama kosong
    // (passthrough bila API kelak menambahkannya).
    habitDetailStats: list<DashboardData['habitDetailStats'][number]>(
      (raw as { habitDetailStats?: unknown }).habitDetailStats,
    ),
  };
}
