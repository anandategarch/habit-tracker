// ---------------------------------------------------------------------------
// Types
// Extracted from finance-explorer.tsx during SPLIT-PHASE3.
// ---------------------------------------------------------------------------

import type { Transaction } from './finance-types';

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
  /** Task 4-b A.5: row tap in the drill-down transactions view opens the
   *  shared Edit Transaction dialog. Explorer tx rows come from the same
   *  /api/finance/transactions endpoint, so the Transaction shape is
   *  identical — no mapping needed. Wired from finance.tsx
   *  (mutations.openEditTx); the dialog is mounted at finance.tsx root so
   *  it opens regardless of the active sub-tab. */
  onEditTx: (tx: Transaction) => void;
}
