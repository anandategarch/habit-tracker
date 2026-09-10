// components/habit-tracker/category-explorer-types.ts — tipe bersama
// sub-tab Kategori + explorer (per-category drill-down).

export interface CategoryTotal {
  name: string;
  emoji: string;
  color: string;
  /** Total pengeluaran kategori ini pada bulan terpilih. */
  total: number;
  count: number;
  /** Persen dari total pengeluaran bulan (0-100). */
  percentage: number;
}

export interface DailyData {
  day: number;
  date: string;
  label: string;
  dateLabel: string;
  total: number;
  count: number;
  cumulative: number;
  movingAvg: number;
}
