// components/habit-tracker/calendar-helpers.ts — helper MURNI (tanpa state)
// kalender heatmap: rotasi weekday per weekStart, warna sel heatmap, label
// aria hari, opsi dropdown bulan, dan data legenda.
// Dipecah dari calendar-view.tsx (Task 71-j) — threshold & teks identik.

import { format, eeeeIdFormatter } from '@/lib/date-utils';
import type { DayData } from './calendar-types';

// ── Weekday ────────────────────────────────────────────────────────────────
// Urutan weekday mengikuti weekStart pengguna (AppSettings.weekStart: 0 =
// Minggu, 1 = Senin — default Senin).
const WEEKDAYS_BASE = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function weekStartsOnNum(weekStart: number | string | null | undefined): 0 | 1 {
  if (weekStart === 0 || weekStart === 'sunday') return 0;
  return 1; // Senin (default UI Pengaturan)
}

export function rotateWeekdays(weekStartsOn: 0 | 1): string[] {
  return [...WEEKDAYS_BASE.slice(weekStartsOn), ...WEEKDAYS_BASE.slice(0, weekStartsOn)];
}

// ── Warna sel heatmap ───────────────────────────────────────────────────────
// Heatmap Aurora teal berjenjang. 0% = tint destructive (hari terlacak tapi
// kosong = status, bukan level panas); sel tinggi butuh teks putih (AA).
export function getHeatmapColor(rate: number | null): string {
  if (rate === null) return 'bg-muted/60';
  if (rate === 0) return 'bg-destructive/25 dark:bg-destructive/15';
  if (rate < 50) return 'bg-teal-200/70 dark:bg-teal-900/50';
  if (rate < 75) return 'bg-teal-400/80 dark:bg-teal-700/60';
  return 'bg-teal-600 dark:bg-teal-500';
}

export function getHeatmapTextColor(rate: number | null): string {
  if (rate === null) return 'text-muted-foreground';
  if (rate === 0) return 'text-destructive dark:text-destructive/80';
  if (rate >= 75) return 'text-white';
  return 'text-foreground';
}

export function getDayNumTextColor(day: DayData): string {
  if (day.completionRate !== null && day.completionRate >= 75) return 'text-white font-bold';
  if (day.isToday) return 'text-primary font-bold';
  if (!day.isCurrentMonth) return 'text-muted-foreground';
  return 'text-foreground';
}

export function getHeatmapHover(rate: number | null): string {
  if (rate === null || rate === 0) return 'hover:bg-accent/60';
  return 'hover:brightness-105 hover:ring-1 hover:ring-ring/60';
}

// ── Label aria ──────────────────────────────────────────────────────────────
// Label aria Indonesia, mis. "Rabu 15 Januari 2025, 3 dari 5 habit selesai".
export function buildDayAriaLabel(day: DayData): string {
  const d = day.date;
  const dateLabel = `${eeeeIdFormatter(d)} ${d.getUTCDate()} ${format(d, 'MMMM')} ${format(d, 'yyyy')}`;
  if (!day.isCurrentMonth) return dateLabel;
  if (day.completionRate === null) return `${dateLabel}, belum ada data`;
  if (day.totalHabits > 0) {
    return `${dateLabel}, ${day.completedHabits} dari ${day.totalHabits} habit selesai`;
  }
  return `${dateLabel}, semua catatan selesai`;
}

// ── Opsi bulan (dropdown navigasi) ──────────────────────────────────────────
const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

export function generateMonthOptions(): { value: string; label: string }[] {
  // Basis bulan = komponen lokal browser (grid kalender memang lokal); label
  // dibangun dari Date.UTC supaya format() tidak meleset di TZ non-UTC.
  const now = new Date();
  const y0 = now.getFullYear();
  const m0 = now.getMonth();
  const options: { value: string; label: string }[] = [];
  for (let i = -12; i <= 3; i++) {
    const total = m0 + i;
    const y = y0 + Math.floor(total / 12);
    const m = ((total % 12) + 12) % 12;
    const d = new Date(Date.UTC(y, m, 1));
    options.push({
      value: `${y}-${pad2(m + 1)}`,
      label: format(d, 'MMMM yyyy'),
    });
  }
  return options;
}

// Heatmap legend — mirror threshold getHeatmapColor.
export const HEATMAP_LEGEND: { label: string; color: string }[] = [
  { label: 'Tidak ada data', color: 'bg-muted/60' },
  { label: '0%', color: 'bg-destructive/25 dark:bg-destructive/15' },
  { label: '1–49%', color: 'bg-teal-200/70 dark:bg-teal-900/50' },
  { label: '50–74%', color: 'bg-teal-400/80 dark:bg-teal-700/60' },
  { label: '75–100%', color: 'bg-teal-600 dark:bg-teal-500' },
];
