// components/habit-tracker/dashboard-default-data.ts — nilai fallback saat
// data /api/dashboard belum termuat ATAU fetch gagal (error banner tetap
// ditampilkan parent). Semua nilai netral (0/null/[]) — TIDAK ada angka
// demo palsu (pelajaran audit 8-a: KPI menampilkan default menyesatkan).

import type { DashboardData } from './dashboard-types';

export const DEFAULT_DATA: DashboardData = {
  totalHabits: 0,
  completionRate: 0,
  currentStreak: 0,
  longestStreak: 0,
  successToday: 0,
  weeklyCompletion: 0,
  monthlyCompletion: 0,
  weekToDateRate: 0,
  monthToDateRate: 0,
  totalXP: 0,
  currentLevel: 0,
  levelProgress: 0,
  productivityScore: 0,
  moodAverage: null,
  sleepAverage: null,
  energyAverage: null,

  weeklyChartData: [],
  categoryPerformance: [],
  monthlyChartData: [],
  chartUnit: 'day',
  stackedBarData: [],
  weeklyPattern: [],

  bestHabit: { name: 'Belum ada data', icon: '🏆', rate: 0 },
  worstHabit: { name: 'Belum ada data', icon: '🌱', rate: 0 },
  todayFocus: [],
  lastDoneSummary: [],
  timeTrackedSummary: [],
  financeOverview: {
    monthIncome: 0,
    monthExpense: 0,
    monthNet: 0,
    budgetTotal: 0,
    budgetSpent: 0,
  },
  habitDetailStats: [],
};
