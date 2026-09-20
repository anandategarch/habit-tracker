// components/habit-tracker/category-explorer-detail-data.ts — derivasi data
// BERAT CategoryDetailView, diekstraksi dari category-explorer-detail-view.tsx
// saat SPLIT god-file (Task 71-g). Logika/perhitungan TIDAK berubah:
//
//   • useCategoryDetailData   — 9 dataset turunan dalam satu useMemo
//     (PERF-REACT-1): catTx, chartData + moving average 7 hari, stats,
//     peak hour, B4 vs-bulan-lalu, A2 time-of-day, C9 sumber, A1 DOW,
//     C8 histogram, D11 kepribadian, D12 anomali.
//   • useCategoryWeeklySummary — ringkasan mingguan M1–M5 (MERGE Task 32)
//     + query ['settings'] untuk weekStart pengguna (BUGHUNT-47 47-b #3).
//
// Tipe hasil derivasi diekspor via ReturnType supaya seksi-seksi sibling
// memakai bentuk yang persis sama tanpa deklarasi ganda.

'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AppSettings } from '@/lib/settings-types';
import { compactRupiahSafe } from './category-explorer-helpers';
import type { CategoryTotal, DailyData } from './category-explorer-types';
import type { Transaction } from './finance-types';

// ── Module-scope constants (hoisted out of component for reuse) ──────────
//
// PERF-REACT-1 fix: `new Intl.DateTimeFormat(...)` was being constructed
// inside per-transaction loops (peak-hour + time-of-day), creating hundreds
// of formatter objects per render for a category with many transactions.
// Hoisting the formatter to module scope means it is created once on module
// load and reused for the lifetime of the app.
// H3: Transaction.date menyimpan komponen UTC = jam dinding Jakarta —
// pembacaan jam HARUS pakai komponen UTC (timeZone 'UTC'), BUKAN
// 'Asia/Jakarta' (menggeser +7: 19.58 terbaca 02.58). formatTxTime dari
// lib/finance-helpers sudah benar (membaca getUTCHours).
const JAKARTA_HOUR_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  hour: '2-digit',
  hour12: false,
});

/** Label hari singkat (Min–Sab) — dipakai derivasi DOW + seksi Pola per Hari. */
export const DOW_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// ── useCategoryDetailData ────────────────────────────────────────────────

export interface CategoryDetailDataArgs {
  transactions: Transaction[];
  prevTransactions: Transaction[];
  cat: CategoryTotal;
  selectedMonth: string;
}

/**
 * PERF-REACT-1 fix: ALL 9 heavy derived datasets (catTx filter/sort,
 * dailyMap, chartData with 7-day moving avg, peakHour, timeOfDayMap,
 * sourceList, dowMap, histogram, anomalies) are wrapped in a single
 * useMemo so they only recompute when transactions, prevTransactions,
 * cat, or selectedMonth changes. Previously every render iterated
 * catTx 5+ times and constructed two `new Intl.DateTimeFormat(...)`
 * instances inside per-tx loops. The formatter is now hoisted to
 * module scope (JAKARTA_HOUR_FORMAT above) and reused.
 */
export function useCategoryDetailData({
  transactions,
  prevTransactions,
  cat,
  selectedMonth,
}: CategoryDetailDataArgs) {
  return useMemo(() => {
    // Filter transactions for this category
    const catTx = transactions
      .filter((t) => t.category === cat.name)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Build daily breakdown for chart
    const [yy, mm] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(yy, mm, 0).getDate();
    const dailyMap = new Map<number, { total: number; count: number }>();
    for (const tx of catTx) {
      // H3: bucket hari dari komponen UTC ISO (slice) — konvensi storage =
      // jam dinding Jakarta; jakartaDateKey lama menggeser +7 (bucket salah).
      const day = parseInt(tx.date.slice(8, 10), 10);
      const existing = dailyMap.get(day) ?? { total: 0, count: 0 };
      existing.total += tx.amount || 0;
      existing.count += 1;
      dailyMap.set(day, existing);
    }

    let cumulative = 0;
    const chartData: DailyData[] = [];
    // Build raw daily totals first for moving average calculation
    const rawTotals: number[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const data = dailyMap.get(d);
      rawTotals.push(data?.total ?? 0);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const data = dailyMap.get(d);
      cumulative += data?.total ?? 0;
      const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
      const dateObj = new Date(Number(selectedMonth.split('-')[0]), Number(selectedMonth.split('-')[1]) - 1, d);
      const dayLabel = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      const axisLabel = d % 5 === 0 || d === 1 ? dayLabel : '';
      // 7-day moving average centered on current day (3 days before + current + 3 after)
      // Shows fluctuation trend instead of cumulative (which always goes up).
      const windowStart = Math.max(0, d - 4); // 0-indexed, 3 days before
      const windowEnd = Math.min(daysInMonth, d + 3); // 3 days after
      const window = rawTotals.slice(windowStart, windowEnd);
      const movingAvg = window.length > 0
        ? Math.round(window.reduce((s, v) => s + v, 0) / window.length)
        : 0;
      chartData.push({
        day: d,
        date: dateStr,
        label: axisLabel,
        dateLabel: dayLabel,
        total: data?.total ?? 0,
        count: data?.count ?? 0,
        cumulative,
        movingAvg,
      });
    }

    // Stats
    const avgPerTx = catTx.length > 0 ? Math.round(cat.total / catTx.length) : 0;
    const activeDays = dailyMap.size;
    const avgPerDay = activeDays > 0 ? Math.round(cat.total / activeDays) : 0;
    const maxTx = catTx.reduce((max, t) => (t.amount > max.amount ? t : max), catTx[0] ?? { amount: 0, description: '', date: '' });
    const maxDay = Array.from(dailyMap.entries()).reduce(
      (max, [day, v]) => (v.total > max.total ? { day, total: v.total } : max),
      { day: 0, total: 0 }
    );

    // Peak hour pattern (uses hoisted JAKARTA_HOUR_FORMAT instead of
    // creating a new Intl.DateTimeFormat per iteration)
    const hourMap = new Map<number, number>();
    for (const tx of catTx) {
      const h = parseInt(JAKARTA_HOUR_FORMAT.format(new Date(tx.date)), 10) % 24;
      hourMap.set(h, (hourMap.get(h) ?? 0) + 1);
    }
    const peakHour = Array.from(hourMap.entries()).reduce(
      (max, [h, count]) => (count > max.count ? { hour: h, count } : max),
      { hour: 0, count: 0 }
    );

    // ── B4: vs Last Month comparison ──────────────────────────────────
    const prevCatTx = prevTransactions.filter((t) => t.category === cat.name);
    const prevTotal = prevCatTx.reduce((s, t) => s + (t.amount || 0), 0);
    const vsLastMonthPct = prevTotal > 0
      ? Math.round(((cat.total - prevTotal) / prevTotal) * 100)
      : null;
    const vsLastMonthDir = vsLastMonthPct === null ? 'unknown'
      : vsLastMonthPct > 0 ? 'up'
      : vsLastMonthPct < 0 ? 'down'
      : 'same';

    // ── A2: Time-of-day distribution ──────────────────────────────────
    const timeOfDayMap = {
      pagi: { label: '🌅 Pagi (5-12)', count: 0, total: 0, hours: '05:00-11:59' },
      siang: { label: '☀️ Siang (12-17)', count: 0, total: 0, hours: '12:00-16:59' },
      sore: { label: '🌆 Sore (17-22)', count: 0, total: 0, hours: '17:00-21:59' },
      malam: { label: '🌙 Malam (22-5)', count: 0, total: 0, hours: '22:00-04:59' },
    };
    for (const tx of catTx) {
      const h = parseInt(JAKARTA_HOUR_FORMAT.format(new Date(tx.date)), 10) % 24;
      if (h >= 5 && h < 12) { timeOfDayMap.pagi.count++; timeOfDayMap.pagi.total += tx.amount || 0; }
      else if (h >= 12 && h < 17) { timeOfDayMap.siang.count++; timeOfDayMap.siang.total += tx.amount || 0; }
      else if (h >= 17 && h < 22) { timeOfDayMap.sore.count++; timeOfDayMap.sore.total += tx.amount || 0; }
      else { timeOfDayMap.malam.count++; timeOfDayMap.malam.total += tx.amount || 0; }
    }
    const maxTimeSlot = Math.max(
      timeOfDayMap.pagi.count, timeOfDayMap.siang.count,
      timeOfDayMap.sore.count, timeOfDayMap.malam.count, 1
    );
    const topTimeSlot = Object.entries(timeOfDayMap).reduce(
      (max, [key, v]) => v.count > max.count ? { key, ...v } : max,
      { key: '', label: '', count: 0, total: 0, hours: '' }
    );

    // ── C9: Source breakdown ──────────────────────────────────────────
    const sourceMap = new Map<string, number>();
    for (const tx of catTx) {
      // FIX import mismatch: Transaction.source opsional (string | null |
      // undefined) — fallback label supaya Map key selalu string.
      const srcKey = tx.source ?? tx.sourceName ?? 'Tanpa Sumber';
      sourceMap.set(srcKey, (sourceMap.get(srcKey) ?? 0) + (tx.amount || 0));
    }
    const sourceList = Array.from(sourceMap.entries())
      .map(([name, total]) => ({
        name,
        total,
        percentage: cat.total > 0 ? Math.round((total / cat.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // ── E15: Daily average for chart reference line ───────────────────
    const dailyAverage = activeDays > 0 ? Math.round(cat.total / activeDays) : 0;

    // ── A1: Day-of-week breakdown ─────────────────────────────────────
    const dowMap = new Array(7).fill(0).map(() => ({ total: 0, count: 0 }));
    for (const tx of catTx) {
      // H3: DOW dari komponen UTC ISO (getUTCDay) — konvensi storage = jam
      // dinding Jakarta; jakartaDateKey lama menggeser +7 (hari bisa salah).
      const dow = new Date(tx.date).getUTCDay();
      dowMap[dow].total += tx.amount || 0;
      dowMap[dow].count += 1;
    }
    const dowTop = dowMap.reduce<{ idx: number; total: number; count: number }>(
      (max, d, i) => (d.total > max.total ? { idx: i, total: d.total, count: d.count } : max),
      { idx: 0, total: 0, count: 0 }
    );
    const dowData = dowMap.map((d, i) => ({
      day: DOW_NAMES[i],
      total: d.total,
      count: d.count,
      pct: cat.total > 0 ? Math.round((d.total / cat.total) * 100) : 0,
    }));

    // ── C8: Amount distribution histogram ─────────────────────────────
    const histogram = (() => {
      if (catTx.length === 0) return [];
      // Determine bucket boundaries from max tx
      const max = Math.max(...catTx.map((t) => t.amount || 0), 1);
      // Create 5 buckets: 0-20%, 20-40%, 40-60%, 60-80%, 80-100% of max
      const bucketSize = max / 5;
      const buckets = new Array(5).fill(0).map((_, i) => ({
        range: `${compactRupiahSafe(Math.round(i * bucketSize))}-${compactRupiahSafe(Math.round((i + 1) * bucketSize))}`,
        count: 0,
        total: 0,
      }));
      for (const tx of catTx) {
        const amt = tx.amount || 0;
        let idx = Math.floor(amt / bucketSize);
        if (idx >= 5) idx = 4; // clamp max into last bucket
        if (idx < 0) idx = 0;
        buckets[idx].count++;
        buckets[idx].total += amt;
      }
      return buckets;
    })();
    const histMaxCount = Math.max(...histogram.map((b) => b.count), 1);
    const dominantBucket = histogram.reduce<{ idx: number; range: string; count: number; total: number }>(
      (max, b, i) => (b.count > max.count ? { idx: i, range: b.range, count: b.count, total: b.total } : max),
      { idx: 0, range: '', count: 0, total: 0 }
    );

    // ── D11: Personality tag ──────────────────────────────────────────
    const personalityTag = (() => {
      if (catTx.length === 0) return null;
      // Check weekend dominance
      const weekendCount = dowMap[0].count + dowMap[6].count; // Sun + Sat
      const weekendPct = catTx.length > 0 ? weekendCount / catTx.length : 0;
      // Check morning dominance
      const morningPct = catTx.length > 0 ? timeOfDayMap.pagi.count / catTx.length : 0;
      // Check frequency (transactions per active day)
      const freq = activeDays > 0 ? catTx.length / activeDays : 0;
      // Check if high spender (>30% of grand total)
      const isHighSpender = cat.percentage >= 30;

      if (isHighSpender) {
        return { tag: 'Pengeluar Besar', emoji: '💸', desc: '>30% dari total pengeluaran bulan ini' };
      }
      if (freq >= 1.5) {
        return { tag: 'Ritual Harian', emoji: '🔄', desc: 'Rata-rata lebih dari 1× per hari aktif' };
      }
      if (weekendPct >= 0.5) {
        return { tag: 'Boros Akhir Pekan', emoji: '🎉', desc: `${Math.round(weekendPct * 100)}% transaksi di weekend` };
      }
      if (morningPct >= 0.7) {
        return { tag: 'Ritual Pagi', emoji: '🌅', desc: `${Math.round(morningPct * 100)}% transaksi di pagi hari` };
      }
      if (catTx.length < 4) {
        return { tag: 'Sekali-sekali', emoji: '🍃', desc: 'Kurang dari 4× per bulan' };
      }
      return { tag: 'Pengeluar Stabil', emoji: '⚖️', desc: 'Pola spending yang konsisten' };
    })();

    // ── D12: Anomaly detection ────────────────────────────────────────
    const anomalies = (() => {
      if (catTx.length < 3) return []; // need at least 3 for meaningful average
      const amounts = catTx.map((t) => t.amount || 0);
      const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const variance = amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length;
      const sd = Math.sqrt(variance);
      if (sd === 0) return [];
      return catTx
        .map((tx) => {
          const z = (tx.amount - mean) / sd;
          return { tx, zScore: Math.round(z * 100) / 100, mean: Math.round(mean) };
        })
        .filter((a) => a.zScore > 1.5) // 1.5σ above normal
        .sort((a, b) => b.zScore - a.zScore);
    })();

    const primaryColor = cat.color || '#22c55e';

    return {
      catTx,
      chartData,
      avgPerTx,
      activeDays,
      avgPerDay,
      maxTx,
      maxDay,
      peakHour,
      vsLastMonthPct,
      vsLastMonthDir,
      prevTotal,
      timeOfDayMap,
      maxTimeSlot,
      topTimeSlot,
      sourceList,
      dailyAverage,
      dowData,
      dowTop,
      histogram,
      histMaxCount,
      dominantBucket,
      personalityTag,
      anomalies,
      primaryColor,
    };
    // Deps note: `cat` is included (rather than just `cat.name`) so the
    // memo recomputes whenever the parent's `categoryTotals` re-derives
    // (e.g. if `getCategoryMeta` changes the emoji/color, or any cat.*
    // field updates). `cat.name` alone would miss the getCategoryMeta
    // edge case. Functionally equivalent to the audit's recommendation
    // for the common case (transactions/selectedMonth change), stricter
    // for the rare case.
  }, [transactions, prevTransactions, cat, selectedMonth]);
}

/** Bentuk hasil derivasi per-kategori (dipakai props seksi sibling). */
export type CategoryDetailData = ReturnType<typeof useCategoryDetailData>;

// ── useCategoryWeeklySummary ─────────────────────────────────────────────

/**
 * MERGE Task 32 (Opsi A): ringkasan mingguan M1–M5 — transplant dari
 * drill-down Eksplorasi lama. BUGHUNT-47: (1) firstDow mengikuti weekStart
 * pengguna; (2) tiap kartu kini menampilkan RENTANG TANGGALNYA (mis.
 * "Minggu 2 · 7–13") supaya tidak ambigu minggu mana yang dimaksud.
 */
export function useCategoryWeeklySummary(chartData: DailyData[], selectedMonth: string) {
  // BUGHUNT-47 (47-b #3): weekStart pengguna dihormati — kalender habit &
  // weeklyRate sudah mengikuti AppSettings.weekStart, tapi bucket mingguan
  // finance hardcode Senin-awal → user weekStart=Minggu mendapat kartu
  // "Minggu 2" yang bergeser 1 hari (transaksi hari Minggu masuk minggu
  // yang salah → "minggu 2 tidak masuk padahal ada transaksi").
  const { data: settings = null } = useQuery<AppSettings | null>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
  });
  const weekStartsOn = settings?.weekStart === 0 ? 0 : 1;

  const weekly = useMemo(() => {
    const [yy, mm] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(yy, mm, 0).getDate();
    const firstDow = (new Date(Date.UTC(yy, mm - 1, 1)).getUTCDay() + 7 - weekStartsOn) % 7;
    const weekCount = Math.ceil((firstDow + daysInMonth) / 7);
    const buckets = Array.from({ length: weekCount }, () => ({ total: 0, count: 0 }));
    for (const row of chartData) {
      const w = Math.floor((firstDow + row.day - 1) / 7);
      if (w >= 0 && w < weekCount) {
        buckets[w].total += row.total;
        buckets[w].count += row.count;
      }
    }
    return buckets.map((b, i) => {
      const startDay = Math.max(1, 7 * i - firstDow + 1);
      const endDay = Math.min(7 * (i + 1) - firstDow, daysInMonth);
      return {
        name: `Minggu ${i + 1}`,
        rangeLabel: startDay === endDay ? `${startDay}` : `${startDay}–${endDay}`,
        ...b,
      };
    });
  }, [chartData, selectedMonth, weekStartsOn]);

  return weekly;
}

/** Baris ringkasan mingguan ("Minggu 1", rentang tanggal, total, count). */
export type CategoryWeeklySummary = ReturnType<typeof useCategoryWeeklySummary>;
