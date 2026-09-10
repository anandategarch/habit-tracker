// components/habit-tracker/dashboard-types.ts — kontrak tipe tab Dashboard.
//
// Dua "bahasa" tipe di file ini:
//  1. `DashboardApiPayload` — bentuk payload /api/dashboard sesuai kontrak
//     rebuild (recovery/API-CONTRACT.md). Semua field opsional + nullable
//     supaya tahan terhadap drift kecil di sisi API.
//  2. `DashboardData` — bentuk data yang dikonsumsi dashboard.tsx (file
//     hasil recovery). Konversi 1→2 dilakukan `toDashboardData` di
//     src/lib/dashboard/contract.ts (dipanggil di queryFn parent).

export type Period = '7d' | '1m' | '3m' | 'all';

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: '7 Hari' },
  { value: '1m', label: '30 Hari' },
  { value: '3m', label: '90 Hari' },
  { value: 'all', label: 'Semua' },
];

export interface MotivationalQuote {
  quote: string;
  translation?: string;
  author?: string;
}

// ── Bentuk payload /api/dashboard (kontrak recovery) ───────────────────────

export interface DashboardApiKpi {
  totalHabits?: number;
  activeToday?: number;
  successToday?: number;
  weeklyRate?: number;
  monthlyRate?: number;
  consistencyScore?: number;
  /** Streak GLOBAL hari ini (≥1 habit selesai/hari) — dari route (M-1). */
  currentStreak?: number;
  bestStreak?: number;
  totalXp?: number;
  currentLevel?: number;
  moodAvg?: number | null;
  sleepAvg?: number | null;
  energyAvg?: number | null;
  todayXp?: number;
  completion7d?: number;
  completion30d?: number;
}

export interface DashboardApiDay {
  date: string; // 'yyyy-MM-dd' (hari Jakarta)
  completed?: number;
  missed?: number;
}

export interface DashboardApiHabitLite {
  id?: string;
  name?: string;
  emoji?: string;
}

export interface DashboardApiPayload {
  greeting?: { userName?: string } | null;
  kpi?: DashboardApiKpi | null;
  bestHabit?: (DashboardApiHabitLite & { rate?: number }) | null;
  worstHabit?: (DashboardApiHabitLite & { rate?: number }) | null;
  weeklyChart?: DashboardApiDay[] | null;
  monthlyChart?: DashboardApiDay[] | null;
  /** Granularitas monthlyChart — 'week' = agregasi mingguan (M-3). */
  monthlyChartUnit?: 'day' | 'week';
  /** Sumber "Pola Mingguan" — harian 90 hari terakhir (M-3). */
  patternChart?: DashboardApiDay[] | null;
  categoryChart?: { category?: string; count?: number }[] | null;
  focusToday?: (DashboardApiHabitLite & { completed?: boolean; priority?: string })[] | null;
  lastDone?: (DashboardApiHabitLite & { lastDate?: string | null; streak?: number })[] | null;
  timeTracked?: (DashboardApiHabitLite & { minutes?: number })[] | null;
  quote?: { text?: string; author?: string } | null;
  financeOverview?:
    | {
        monthIncome?: number;
        monthExpense?: number;
        monthNet?: number;
        budgetTotal?: number;
        budgetSpent?: number;
      }
    | null;
}

// ── Bentuk data yang dikonsumsi komponen dashboard ─────────────────────────

export interface WeeklyChartDatum {
  /** 'yyyy-MM-dd' — dipakai bar mingguan → openTrackerDate(date). */
  date: string;
  /** Nama hari lengkap Indonesia, mis. 'Senin'. */
  day: string;
  /** Persentase penyelesaian 0–100. */
  rate: number;
}

export interface CategoryPerformance {
  category: string;
  count: number;
}

export interface MonthlyChartDatum {
  date: string;
  completed: number;
  missed: number;
}

export interface StackedBarDatum {
  label: string;
  completed: number;
  missed: number;
}

export interface WeeklyPatternDatum {
  day: string;
  rate: number;
}

export interface TimeTrackedHabitSummary {
  id: string;
  name: string;
  emoji: string;
  minutes: number;
}

export interface LastDoneHabitSummary {
  id: string;
  name: string;
  emoji: string;
  lastDate: string | null;
  streak: number;
}

export interface FinanceOverviewData {
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
  budgetTotal: number;
  budgetSpent: number;
}

export interface BestWorstHabit {
  /** Ada bila API mengirim id → tile bisa 1-klik ke analisis habit. */
  id?: string;
  name: string;
  icon: string;
  rate: number;
}

export interface TodayFocusItem {
  id: string;
  name: string;
  icon: string;
  priority?: string;
}

export interface HabitDetailStat {
  id: string;
  name: string;
  icon: string;
  streak: number;
  rate: number;
  completed: number;
  total: number;
}

export interface DashboardData {
  // KPI
  totalHabits: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  successToday: number;
  /** KPI "7 Hari" — completion rolling 7 hari (L-3). */
  weeklyCompletion: number;
  /** KPI "30 Hari" — completion rolling 30 hari (L-3). */
  monthlyCompletion: number;
  /** Cincin "Minggu Ini" — rate minggu kalender berjalan (L-3). */
  weekToDateRate: number;
  /** Cincin "Bulan Ini" — rate bulan kalender berjalan (L-3). */
  monthToDateRate: number;
  totalXP: number;
  currentLevel: number;
  /** 0–100 (progres XP menuju level berikutnya). */
  levelProgress: number;
  productivityScore: number;
  moodAverage: number | null;
  sleepAverage: number | null;
  energyAverage: number | null;
  // Chart
  weeklyChartData: WeeklyChartDatum[];
  categoryPerformance: CategoryPerformance[];
  monthlyChartData: MonthlyChartDatum[];
  /** Granularitas monthlyChartData — 'week' = agregasi mingguan (M-3). */
  chartUnit: 'day' | 'week';
  stackedBarData: StackedBarDatum[];
  weeklyPattern: WeeklyPatternDatum[];
  // Section
  bestHabit: BestWorstHabit;
  worstHabit: BestWorstHabit;
  todayFocus: TodayFocusItem[];
  lastDoneSummary: LastDoneHabitSummary[];
  timeTrackedSummary: TimeTrackedHabitSummary[];
  financeOverview: FinanceOverviewData;
  habitDetailStats: HabitDetailStat[];
}
