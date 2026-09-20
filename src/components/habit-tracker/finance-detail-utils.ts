'use client';

// components/habit-tracker/finance-detail-utils.ts — util kecil lokal sektor
// detail "Perdetail Dashboard Finance" (diekstrak verbatim dari
// finance-detail-sections.tsx, Task 71-i; dipakai semua sektor finance-detail-*).

import { jakartaDateString } from '@/lib/jakarta-date';
import { MONTHS_ID } from '@/lib/finance-helpers';
import { dateFromYMD } from '@/lib/timezone';

export const WEEKDAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export type Stagger = { stagger: number };

export function daysInMonthOf(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  if (m === 2) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return leap ? 29 : 28;
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

export function monthShort(ym: string): string {
  const m = Number(ym.slice(5, 7));
  return MONTHS_ID[m - 1] ?? ym;
}

export function weekdayShort(ymd: string): string {
  const d = dateFromYMD(ymd);
  return WEEKDAYS_ID[d.getUTCDay()] ?? '';
}

/** Selisih hari dari hari ini (Jakarta) ke ymd — positif = masa depan. */
export function daysFromToday(ymd: string): number {
  const today = jakartaDateString();
  return Math.round((dateFromYMD(ymd).getTime() - dateFromYMD(today).getTime()) / 86_400_000);
}

export function frequencyLabel(freq: string): string {
  if (freq === 'daily') return 'harian';
  if (freq === 'weekly') return 'mingguan';
  return 'bulanan';
}
