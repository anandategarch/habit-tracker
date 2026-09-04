// ---------------------------------------------------------------------------
// Types
// Extracted from finance-explorer.tsx during SPLIT-PHASE3.
// ---------------------------------------------------------------------------

export type DrillLevel = 'month' | 'week' | 'day' | 'transactions';

export interface MonthData {
  month: string;
  label: string;
  total: number;
}

export interface DayData {
  day: number;
  date: string;
  dayName: string;
  total: number;
  count: number;
}

export interface WeekBudgetData {
  month: string;
  weeks: {
    week: number;
    target: number;
    effectiveTarget: number;
    spent: number;
    remaining: number;
    rollover: boolean;
    rolloverIn: number;
    percentage: number;
    isOverBudget: boolean;
  }[];
  totalTarget: number;
  totalSpent: number;
  suggestedTarget: number;
}

export interface WeekData {
  week: number;
  label: string;
  dateRange: string;
  total: number;
}

export interface FinanceExplorerProps {
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
}
