// ── Shared Finance Types, Constants & Utilities ─────────────────────────

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  category: string;
  description: string | null;
  date: string;
  notes: string | null;
  source: string;
  // Split transaction group ID. Null = standalone transaction.
  // Non-null = part of a split group (multiple transactions sharing
  // the same date/source/description but different category/amount).
  groupId?: string | null;
  // PHASE4-POLISH: tags — JSON-encoded array string from the DB. The client
  // parses this into a string[] via parseTags() before rendering. Optional
  // for backward compat with mock/test data that doesn't include the field.
  tags?: string;
  createdAt: string;
  updatedAt: string;
}

// PHASE4-POLISH: parse a transaction's `tags` string (JSON array) into a
// real string[]. Returns [] for null/undefined/empty/invalid input — never
// throws. Used by every component that renders transaction tags.
export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is string => typeof t === 'string' && t.length > 0);
  } catch {
    return [];
  }
}

export interface BudgetItem {
  id: string;
  category: string;
  amount: number;
  period: string;
  createdAt: string;
  updatedAt: string;
  spent?: number;
  remaining?: number;
  percentage?: number;
}

export interface DashboardData {
  month: string;
  totalIncome: number;
  totalExpense: number;
  balance: number; // ACTUAL total from fund sources (not income - expense)
  netCashFlow?: number; // income - expense for the month (for reference)
  transactionCount: number;
  avgDailyExpense: number;
  projectedMonthlyExpense: number;
  expenseByCategory: Record<string, number>;
  incomeByCategory: Record<string, number>;
  dailySpending: Record<string, number>;
  budgetStatus: BudgetItem[];
  totalBudget: number;
  totalBudgetSpent: number;
  previousMonth: {
    month: string;
    income: number;
    expense: number;
  };
}


export interface FinanceCategory {
  id: string;
  type: string;
  name: string;
  emoji: string;
  color: string;
  order: number;
  trackLastDone: boolean;
}

export interface LastDoneItem {
  category: string;
  emoji: string;
  color: string;
  type: string;
  lastDate: string | null;
  daysAgo: number | null;
  lastAmount: number | null;
  description: string | null;
}

export interface FundSource {
  id: string;
  name: string;
  emoji: string;
  balance: number;
  order: number;
}

// ── Constants ────────────────────────────────────────────────────────────

export const FALLBACK_EXPENSE = [
  { value: 'Makanan & Minuman', emoji: '🍽️', color: '#ef4444' },
  { value: 'Transportasi', emoji: '🚗', color: '#f97316' },
  { value: 'Belanja', emoji: '🛍️', color: '#eab308' },
  { value: 'Hiburan', emoji: '🎮', color: '#a855f7' },
  { value: 'Kesehatan', emoji: '🏥', color: '#ec4899' },
  { value: 'Pendidikan', emoji: '📚', color: '#8b5cf6' },
  { value: 'Tagihan & Utilitas', emoji: '📋', color: '#a855f7' },
  { value: 'Tabungan & Investasi', emoji: '🏦', color: '#14b8a6' },
  { value: 'Lainnya', emoji: '📦', color: '#78716c' },
  // Internal movement categories (created by system, not user-created)
  { value: 'Transfer Antar Sumber', emoji: '🔄', color: '#14b8a6' },
  { value: 'Penyesuaian Saldo', emoji: '🔧', color: '#64748b' },
];

export const FALLBACK_INCOME = [
  { value: 'Gaji', emoji: '💰', color: '#22c55e' },
  { value: 'Freelance', emoji: '💻', color: '#06b6d4' },
  { value: 'Investasi', emoji: '📈', color: '#f59e0b' },
  { value: 'Bisnis', emoji: '🏢', color: '#8b5cf6' },
  { value: 'Lainnya', emoji: '💸', color: '#78716c' },
  // Internal movement categories (created by system, not user-created)
  { value: 'Transfer Antar Sumber', emoji: '🔄', color: '#14b8a6' },
  { value: 'Penyesuaian Saldo', emoji: '🔧', color: '#64748b' },
];

export const FALLBACK_SOURCES = [
  { value: 'Kas', emoji: '💵' },
  { value: 'Bank BCA', emoji: '🏦' },
  { value: 'Bank BRI', emoji: '🏦' },
  { value: 'Bank Mandiri', emoji: '🏦' },
  { value: 'Bank BNI', emoji: '🏦' },
  { value: 'Bank BSI', emoji: '🏦' },
  { value: 'Bank Permata', emoji: '🏦' },
  { value: 'GoPay', emoji: '💚' },
  { value: 'OVO', emoji: '💜' },
  { value: 'DANA', emoji: '💙' },
  { value: 'ShopeePay', emoji: '🧡' },
  { value: 'E-Money Lainnya', emoji: '💳' },
];

// ── Utilities ───────────────────────────────────────────────────────────

export const formatNominalInput = (value: string): string => {
  // BUG-4 fix: preserve leading minus sign for negative balances
  const isNegative = value.trim().startsWith('-');
  const raw = value.replace(/[^\d]/g, '');
  if (!raw) return isNegative ? '-' : '';
  const formatted = raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNegative ? `-${formatted}` : formatted;
};

export const parseNominalInput = (value: string): string => {
  // BUG-4 fix: preserve leading minus sign for negative balances
  const isNegative = value.trim().startsWith('-');
  const digits = value.replace(/[^\d]/g, '');
  return isNegative ? `-${digits}` : digits;
};

// ── Cached formatters (performance critical) ───────────────────────────
// Intl.NumberFormat construction is expensive (~0.1-0.5ms per call).
// Previously formatRupiah created a new formatter on EVERY call — including
// every animation frame of CountUpRupiah (60 calls/second × 6+ components =
// 360+ formatter constructions/second → GC pressure → jank/freezing).
// Cache the formatter instance once and reuse.

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const formatRupiah = (amount: number) => {
  return rupiahFormatter.format(amount);
};

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Compact Rupiah format for chart labels: 1.5jt, 350k, 500 */
export const compactRupiah = (n: number): string => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}jt`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
};
