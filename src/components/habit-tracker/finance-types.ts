// components/habit-tracker/finance-types.ts — tipe & helper keuangan bersama.
// NOTE (rebuild): file ini adalah kontrak bentuk data antara komponen Finance
// (client) dan route /api/finance/* (server). Field mengikuti pemakaian di
// finance.tsx / use-finance-mutations.ts / finance-transactions.tsx yang
// ter-recovery — jangan diubah sembarangan.
export {
  formatNominalInput,
  formatRupiah,
  parseTags,
  serializeTags,
} from '@/lib/money';

export interface Transaction {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  category: string;
  sourceId?: string | null;
  /** Nama sumber dana (denormalized oleh API — dipakai baris transaksi & form edit). */
  source?: string | null;
  sourceName?: string | null;
  sourceEmoji?: string | null;
  description: string;
  notes?: string | null;
  /** string koma (storage) atau array (parseTags di client). */
  tags: string | string[];
  /** ISO 12:00Z dari hari Jakarta. */
  date: string;
  /** Group id untuk hasil split (badge "Split" di baris transaksi). */
  groupId?: string | null;
  transferPairId?: string | null;
  transferDirection?: 'out' | 'in' | null;
  pairedSourceName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface FundSource {
  id: string;
  name: string;
  emoji: string;
  type: 'cash' | 'bank' | 'ewallet';
  initialBalance: number;
  /** Saldo saat ini (dihitung API: initial + income − expense + transfer). */
  balance: number;
  isArchived: boolean;
  /** Urutan tampil (Prisma sortOrder, dipetakan oleh API). */
  order: number;
}

export interface FinanceCategory {
  id: string;
  name: string;
  emoji: string;
  color: string;
  type: 'expense' | 'income';
  /** Kategori dilacak di panel "Terakhir Transaksi" (default false). */
  trackLastDone: boolean;
}

export interface BudgetItem {
  id: string;
  category: string;
  month: string; // 'yyyy-MM'
  /** 'monthly' (budget bulanan) atau 'weekly' (target mingguan explorer). */
  period: string;
  amount: number;
  spent: number;
  remaining: number;
  pct: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  emoji: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string | null;
  completedAt?: string | null;
}

export interface RecurringTransaction {
  id: string;
  name: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  sourceId?: string | null;
  frequency: 'daily' | 'weekly' | 'monthly';
  startDate: string; // ISO +07:00 midnight
  endDate?: string | null;
  lastRun?: string | null;
  isActive: boolean;
}

export interface TransactionRule {
  id: string;
  keyword: string;
  category: string;
  sourceId?: string | null;
  priority: number;
}

export interface SplitRow {
  category: string;
  amount: string;
}

export interface TxFormState {
  type: string;
  amount: string;
  category: string;
  description: string;
  date: string;
  time: string;
  notes: string;
  source: string;
  tags: string[];
}

export interface BudgetFormState {
  category: string;
  amount: string;
  period: string;
}

// ── Payload /api/finance/dashboard?month=yyyy-MM (kontrak API) ────────────
export interface DashboardData {
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
  byCategory: Array<{ category: string; amount: number; emoji: string; color: string }>;
  byDay: Array<{ date: string; amount: number }>;
  dailyAvg: number;
  projection: number;
  noSpendDays: number;
  // ── KPI Dashboard Keuangan (Task 40, DASHBOARD-FIN) — semua optional
  // supaya caller lama / respons API lama tetap valid (FE defensif null).
  savingsRate?: number | null; // % — null saat pemasukan bulan 0
  prevMonthIncome?: number;
  prevMonthExpense?: number;
  budgetTotal?: number;
  budgetSpent?: number;
  totalBalance?: number;
  runwayDays?: number | null; // hari tertutup rata-rata pengeluaran — null saat dailyAvg 0
  topCategory: { category: string; amount: number } | null;
}

// ── /api/finance/last-done → baris "Terakhir Transaksi" di overview.
// Field longgar (fallback overview memakai transaksi bulan berjalan bila
// endpoint kosong), render harus defensif.
export interface LastDoneItem {
  id?: string;
  category: string;
  emoji?: string;
  color?: string;
  description?: string;
  amount?: number;
  type?: 'income' | 'expense' | 'transfer';
  lastDate?: string;
  date?: string;
  count?: number;
}

// ── Fallback kategori/sumber saat API belum punya data (offline-first UX) ──
export const FALLBACK_EXPENSE: Array<{ value: string; emoji: string; color: string }> = [
  { value: 'Makanan & Minuman', emoji: '🍽️', color: '#f59e0b' },
  { value: 'Transportasi', emoji: '🚌', color: '#0ea5e9' },
  { value: 'Belanja', emoji: '🛍️', color: '#f43f5e' },
  { value: 'Hiburan', emoji: '🎬', color: '#8b5cf6' },
  { value: 'Tagihan', emoji: '🧾', color: '#64748b' },
  { value: 'Kesehatan', emoji: '💊', color: '#10b981' },
];

export const FALLBACK_INCOME: Array<{ value: string; emoji: string; color: string }> = [
  { value: 'Gaji', emoji: '💰', color: '#10b981' },
  { value: 'Freelance', emoji: '💼', color: '#0ea5e9' },
];

export const FALLBACK_SOURCES: Array<{ value: string; emoji: string }> = [
  { value: 'Kas', emoji: '👛' },
  { value: 'Bank', emoji: '🏦' },
  { value: 'E-Wallet', emoji: '📱' },
];

// ── Helper tampilan bersama (dipakai transaksi/recap/explorer) ────────────
import { formatRupiah as fmtRupiah } from '@/lib/money';

/**
 * 'Rp 10.500.000' / '10.500.000' / '10500000' → '10500000' (string digit).
 * Mengembalikan STRING (bukan number) — use-finance-mutations (recovery)
 * memakai hasilnya untuk parseInt/parseFloat dan payload amount.
 */
export function parseNominalInput(text: string): string {
  return (text ?? '').replace(/[^\d]/g, '');
}

/** Nominal input teks → angka rupiah bulat (untuk komponen baru). */
export function amountFromInput(text: string): number {
  const digits = parseNominalInput(text);
  return digits ? Number(digits) : 0;
}

/** Kapitalisasi huruf pertama ("senin" → "Senin"). */
export function capitalize(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Rupiah compact pendek: "Rp1,2jt" / "Rp350rb" / "Rp8,5M".
 * Untuk angka < 10rb ditampilkan penuh supaya tidak menyesatkan.
 */
export function compactRupiah(value: number): string {
  if (!Number.isFinite(value)) return 'Rp0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs < 10_000) return sign + fmtRupiah(abs);
  if (abs >= 1_000_000_000) return `${sign}Rp${trimCompact(abs / 1_000_000_000)}M`;
  if (abs >= 1_000_000) return `${sign}Rp${trimCompact(abs / 1_000_000)}jt`;
  // BUG-FIX (Task 40): akhiran "rb" hilang — 500.000 dirender "Rp500" (baca
  // sebagai lima ratus rupiah). Docstring sejak awal bilang "Rp350rb".
  return `${sign}Rp${trimCompact(abs / 1_000)}rb`;
}

/**
 * Sama dengan compactRupiah tapi menjaga angka kecil tampil penuh —
 * dipakai untuk nominal yang tidak boleh ambigu (target budget, rate/hari).
 */
export function compactRupiahSafe(value: number): string {
  if (!Number.isFinite(value)) return 'Rp0';
  const abs = Math.abs(value);
  if (abs < 1_000_000) return fmtRupiah(Math.round(value));
  return compactRupiah(value);
}

function trimCompact(n: number): string {
  const s = n.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s.replace('.', ',');
}

/** Nama bulan Indonesia penuh + tahun ("September 2026"). */
export function monthLabel(ym: string): string {
  const names = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return ym;
  return `${names[m - 1]} ${y}`;
}
