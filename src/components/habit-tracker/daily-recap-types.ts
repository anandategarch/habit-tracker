// components/habit-tracker/daily-recap-types.ts — tipe rekap harian keuangan.
//
// Kontrak API: GET /api/finance/daily-recap?date=yyyy-MM-dd →
//   { transactions: Transaction[], totalExpense, totalIncome }
// Statistik turunan (perbandingan, streak, proyeksi, personality tag) dihitung
// client-side dari transaksi hari itu + transaksi bulan berjalan.

import type { Transaction } from './finance-types';

/** Respons /api/finance/daily-recap?date=... */
export interface DailyRecapDay {
  transactions: Transaction[];
  totalExpense: number;
  totalIncome: number;
}

export interface CategoryStat {
  name: string;
  emoji: string;
  color: string;
  total: number;
  count: number;
  avg: number;
  max: number;
}

export interface HourlyStat {
  hour: number;
  total: number;
  count: number;
}

export interface SparkPoint {
  date: string; // 'yyyy-MM-dd'
  label: string; // 'DD'
  dow: string; // 'Sen'…
  total: number;
}

export interface DailyBudgetInfo {
  target: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: 'ok' | 'warn' | 'over';
}

export interface PersonalityTag {
  tag: string;
  emoji: string;
  description: string;
}

export interface RecapComparison {
  changePct: number | null;
  direction: 'up' | 'down' | 'flat';
}

export interface RecapAlert {
  tone: 'info' | 'warning' | 'danger';
  text: string;
}
