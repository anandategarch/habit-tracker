// components/habit-tracker/calendar-types.ts — tipe bersama kalender heatmap
// (sub-tab "Riwayat"). Dipecah dari calendar-view.tsx (Task 71-j) — tipe baru
// milik jalur calendar-* sendiri, daily-tracker-types/helpers tetap READ-ONLY.

export interface DayData {
  date: Date; // UTC-midnight (konvensi date-utils)
  dayStr: string; // yyyy-MM-dd
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  completionRate: number | null; // null = tidak ada data
  mood: number | null;
  totalHabits: number;
  completedHabits: number;
}

/** Ringkasan bulan kalender: rata-rata, hari terbaik/terburuk, hari terlacak. */
export interface MonthSummary {
  avg: number;
  best: DayData | null;
  worst: DayData | null;
  entries: number;
}
