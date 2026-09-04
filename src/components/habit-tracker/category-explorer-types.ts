// ---------------------------------------------------------------------------
// Types
// Extracted from category-explorer.tsx during SPLIT-PHASE3.
// ---------------------------------------------------------------------------

export interface CategoryTotal {
  name: string;
  emoji: string;
  color: string;
  total: number;
  count: number;
  percentage: number;
}

export interface DailyData {
  day: number;
  date: string;
  label: string;
  dateLabel: string; // full date for tooltip (e.g. "15 Jul")
  total: number;
  count: number;
  cumulative: number;
  movingAvg: number; // 7-day rolling average for fluctuation trend
}

export interface CategoryExplorerProps {
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
}
