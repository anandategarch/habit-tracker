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
  createdAt: string;
  updatedAt: string;
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
  balance: number;
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

export interface AnalyticsData {
  monthlyTrend: { month: string; income: number; expense: number; balance: number }[];
  topCategories: { category: string; amount: number; percentage: number }[];
  categoryBreakdown: Record<string, number>;
  weeklyPattern: { day: string; total: number; avg: number; count: number }[];
  incomeSources: { source: string; amount: number; percentage: number }[];
  savingsRate: number;
  totalIncomeInRange: number;
  totalExpenseInRange: number;
  largestExpenses: { id: string; category: string; description: string | null; amount: number; date: string }[];
  dailySpending: { date: string; amount: number }[];
  monthlyComposition: { month: string; monthLabel: string; categories: Record<string, number> }[];
  monthlySavings: { month: string; monthLabel: string; savings: number; income: number; expense: number; changePercent: number }[];
  categoryComparison: { category: string; thisMonth: number; lastMonth: number; change: number }[];
  financialHealth: {
    rasioTabungan: number;
    diversifikasi: number;
    disiplinBudget: number;
    konsistensi: number;
    keseimbangan: number;
    overallScore: number;
  };
  sparklineData: { date: string; income: number; expense: number; balance: number; dailyAvg: number }[];
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
  { value: 'Pendidikan', emoji: '📚', color: '#3b82f6' },
  { value: 'Tagihan & Utilitas', emoji: '📋', color: '#6366f1' },
  { value: 'Tabungan & Investasi', emoji: '🏦', color: '#14b8a6' },
  { value: 'Lainnya', emoji: '📦', color: '#78716c' },
];

export const FALLBACK_INCOME = [
  { value: 'Gaji', emoji: '💰', color: '#22c55e' },
  { value: 'Freelance', emoji: '💻', color: '#06b6d4' },
  { value: 'Investasi', emoji: '📈', color: '#f59e0b' },
  { value: 'Bisnis', emoji: '🏢', color: '#8b5cf6' },
  { value: 'Lainnya', emoji: '💸', color: '#78716c' },
];

export const EMOJI_OPTIONS = [
  '🍽️','🚗','🛍️','🎮','🏥','📚','📋','🏦','📦','🐱','🐶','🏠','✈️','👕','💊','☕','🍰','🍕','🛒','💰','💳','📱','💻','🔧','👶','🎵','🎬','⚽','🏋️','🎓','⛽','🚕','🛵','📡','💡','🎁','❤️','⭐','🔥','✅','⚙️','📌','🏷️','🥤','🌮','🍱','🧃','🧹','📖','✏️','🪴','🛡️',
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

export const CHART_COLORS = ['#ef4444', '#f97316', '#eab308', '#a855f7', '#ec4899', '#3b82f6', '#6366f1', '#14b8a6', '#22c55e', '#78716c'];

// ── Utilities ───────────────────────────────────────────────────────────

export const formatNominalInput = (value: string): string => {
  const raw = value.replace(/[^\d]/g, '');
  if (!raw) return '';
  return raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const parseNominalInput = (value: string): string => {
  return value.replace(/[^\d]/g, '');
};

export const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);