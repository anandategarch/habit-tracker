'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Plus,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Trash2,
  Edit3,
  Search,
  CalendarDays,
  BarChart3,
  PieChart,
  LineChart,
  Settings2,
  Info,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ReferenceLine,
} from 'recharts';

function ChartInfo({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0" aria-label="Info">
            <Info className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
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

interface BudgetItem {
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

interface DashboardData {
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

interface AnalyticsData {
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

// ── Types ────────────────────────────────────────────────────────────────────

interface FinanceCategory {
  id: string;
  type: string;
  name: string;
  emoji: string;
  color: string;
  order: number;
  trackLastDone: boolean;
}

interface LastDoneItem {
  category: string;
  emoji: string;
  color: string;
  type: string;
  lastDate: string | null;
  daysAgo: number | null;
  lastAmount: number | null;
  description: string | null;
}

interface FundSource {
  id: string;
  name: string;
  emoji: string;
  order: number;
}

// ── Fallback constants (used when API hasn't loaded yet) ─────────────────────

const FALLBACK_EXPENSE = [
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

const FALLBACK_INCOME = [
  { value: 'Gaji', emoji: '💰', color: '#22c55e' },
  { value: 'Freelance', emoji: '💻', color: '#06b6d4' },
  { value: 'Investasi', emoji: '📈', color: '#f59e0b' },
  { value: 'Bisnis', emoji: '🏢', color: '#8b5cf6' },
  { value: 'Lainnya', emoji: '💸', color: '#78716c' },
];

const FALLBACK_SOURCES = [
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

// Format raw digits to display with dot thousand separator: 12000 → "12.000"
const formatNominalInput = (value: string): string => {
  const raw = value.replace(/[^\d]/g, '');
  if (!raw) return '';
  return raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// Parse formatted value back to raw number string: "12.000" → "12000"
const parseNominalInput = (value: string): string => {
  return value.replace(/[^\d]/g, '');
};

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

const CHART_COLORS = ['#ef4444', '#f97316', '#eab308', '#a855f7', '#ec4899', '#3b82f6', '#6366f1', '#14b8a6', '#22c55e', '#78716c'];

// ── Component ────────────────────────────────────────────────────────────────

export default function Finance() {
  const { selectedMonth, setSelectedMonth, refreshKey, triggerRefresh } = useAppStore();
  const [activeSubTab, setActiveSubTab] = useState('overview');

  // Data states
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<FinanceCategory | null>(null);
  const [sources, setSources] = useState<FundSource[]>([]);
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [sourceFormOpen, setSourceFormOpen] = useState(false);
  const [lastDoneData, setLastDoneData] = useState<LastDoneItem[]>([]);
  const [editingSource, setEditingSource] = useState<FundSource | null>(null);
  const [sourceForm, setSourceForm] = useState({ name: '', emoji: '💵' });
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [budgetEditOpen, setBudgetEditOpen] = useState(false);

  // Form states
  const [txForm, setTxForm] = useState({ type: 'expense', amount: '', category: '', description: '', date: '', notes: '', source: 'Kas' });
  const [budgetForm, setBudgetForm] = useState({ category: '', amount: '', period: 'monthly' });
  const [catForm, setCatForm] = useState({ type: 'expense' as string, name: '', emoji: '📦', color: '#78716c', trackLastDone: false });
  const [submitting, setSubmitting] = useState(false);

  // Filter states
  const [txFilter, setTxFilter] = useState<{ type: string; category: string; source: string; search: string }>({ type: 'all', category: 'all', source: 'all', search: '' });

  // ── Derived category helpers ──────────────────────────────────────────────

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');

  const getCategoryMeta = useCallback((cat: string) => {
    const found = categories.find(c => c.name === cat);
    if (found) return { emoji: found.emoji, color: found.color };
    return { emoji: '📦', color: '#78716c' };
  }, [categories]);

  const getCategoryList = useCallback((type: string) => {
    const cats = categories.filter(c => c.type === type);
    if (cats.length > 0) return cats.map(c => ({ value: c.name, emoji: c.emoji, color: c.color }));
    return type === 'expense' ? FALLBACK_EXPENSE : FALLBACK_INCOME;
  }, [categories]);

  const getActiveSources = useCallback(() => {
    if (sources.length > 0) return sources;
    return FALLBACK_SOURCES.map(s => ({ id: '', name: s.value, emoji: s.emoji, order: 0 }));
  }, [sources]);

  const getSourceEmoji = useCallback((name: string) => {
    const found = sources.find(s => s.name === name);
    if (found) return found.emoji;
    return FALLBACK_SOURCES.find(s => s.value === name)?.emoji || '💵';
  }, [sources]);

  // ── Data Fetching ─────────────────────────────────────────────────────────

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/categories');
      if (res.ok) setCategories(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/sources');
      if (res.ok) setSources(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/finance/dashboard?month=${selectedMonth}`);
      if (res.ok) setDashboardData(await res.json());
    } catch { /* silent */ }
  }, [selectedMonth]);

  const fetchTransactions = useCallback(async () => {
    try {
      const params = new URLSearchParams({ month: selectedMonth });
      if (txFilter.type !== 'all') params.set('type', txFilter.type);
      if (txFilter.category !== 'all') params.set('category', txFilter.category);
      if (txFilter.source !== 'all') params.set('source', txFilter.source);
      if (txFilter.search.trim()) params.set('search', txFilter.search.trim());
      const res = await fetch(`/api/finance/transactions?${params}`);
      if (res.ok) setTransactions(await res.json());
    } catch { /* silent */ }
  }, [selectedMonth, txFilter.type, txFilter.category, txFilter.source, txFilter.search]);

  const fetchBudgets = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/budgets');
      if (res.ok) setBudgets(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/analytics?months=6');
      if (res.ok) setAnalyticsData(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchLastDone = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/last-done');
      if (res.ok) setLastDoneData(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchCategories(), fetchSources(), fetchDashboard(), fetchTransactions(), fetchBudgets(), fetchAnalytics(), fetchLastDone()]).finally(() => setLoading(false));
  }, [fetchCategories, fetchSources, fetchDashboard, fetchTransactions, fetchBudgets, fetchAnalytics, fetchLastDone, refreshKey]);

  // ── Transaction CRUD ──────────────────────────────────────────────────────

  const openNewTx = (type: 'income' | 'expense') => {
    setEditingTx(null);
    setTxForm({ type, amount: '', category: '', description: '', date: new Date().toISOString().split('T')[0], notes: '', source: 'Kas' });
    setTxDialogOpen(true);
  };

  const openEditTx = (tx: Transaction) => {
    setEditingTx(tx);
    setTxForm({
      type: tx.type,
      amount: formatNominalInput(String(tx.amount)),
      category: tx.category,
      description: tx.description || '',
      date: tx.date.split('T')[0],
      notes: tx.notes || '',
      source: tx.source || 'Kas',
    });
    setTxDialogOpen(true);
  };

  const handleSubmitTx = async () => {
    const rawAmount = parseNominalInput(txForm.amount);
    if (!rawAmount || parseFloat(rawAmount) <= 0) {
      toast.error('Masukkan jumlah yang valid');
      return;
    }
    if (!txForm.category) {
      toast.error('Pilih kategori');
      return;
    }
    if (!txForm.date) {
      toast.error('Pilih tanggal');
      return;
    }

    const payload = { ...txForm, amount: rawAmount };
    setSubmitting(true);
    try {
      if (editingTx) {
        const res = await fetch(`/api/finance/transactions/${editingTx.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success('Transaksi berhasil diupdate');
        } else {
          toast.error('Gagal mengupdate transaksi');
          return;
        }
      } else {
        const res = await fetch('/api/finance/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success('Transaksi berhasil ditambahkan');
        } else {
          toast.error('Gagal menambahkan transaksi');
          return;
        }
      }
      setTxDialogOpen(false);
      triggerRefresh();
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTx = async () => {
    if (!deletingId) return;
    try {
      const res = await fetch(`/api/finance/transactions/${deletingId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Transaksi berhasil dihapus');
        setDeleteDialogOpen(false);
        setDeletingId(null);
        triggerRefresh();
      } else {
        toast.error('Gagal menghapus transaksi');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    }
  };

  // ── Budget CRUD ───────────────────────────────────────────────────────────

  const handleSubmitBudget = async () => {
    if (!budgetForm.category) {
      toast.error('Pilih kategori');
      return;
    }
    const rawBudgetAmount = parseNominalInput(budgetForm.amount);
    if (!rawBudgetAmount || parseFloat(rawBudgetAmount) <= 0) {
      toast.error('Masukkan jumlah budget yang valid');
      return;
    }

    const budgetPayload = { ...budgetForm, amount: rawBudgetAmount };
    setSubmitting(true);
    try {
      const res = await fetch('/api/finance/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(budgetPayload),
      });
      if (res.ok) {
        toast.success('Budget berhasil disimpan');
        setBudgetDialogOpen(false);
        triggerRefresh();
      } else {
        toast.error('Gagal menyimpan budget');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    try {
      const res = await fetch(`/api/finance/budgets/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Budget berhasil dihapus');
        triggerRefresh();
      }
    } catch {
      toast.error('Gagal menghapus budget');
    }
  };

  const openEditBudget = (b: BudgetItem) => {
    setEditingBudget(b);
    setBudgetForm({
      category: b.category,
      amount: formatNominalInput(String(b.amount)),
      period: b.period,
    });
    setBudgetEditOpen(true);
  };

  const handleSubmitEditBudget = async () => {
    if (!editingBudget) return;
    if (!budgetForm.category) {
      toast.error('Pilih kategori');
      return;
    }
    const rawBudgetAmount = parseNominalInput(budgetForm.amount);
    if (!rawBudgetAmount || parseFloat(rawBudgetAmount) <= 0) {
      toast.error('Masukkan jumlah budget yang valid');
      return;
    }

    const budgetPayload = { category: budgetForm.category, amount: rawBudgetAmount, period: budgetForm.period };
    setSubmitting(true);
    try {
      const res = await fetch(`/api/finance/budgets/${editingBudget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(budgetPayload),
      });
      if (res.ok) {
        toast.success('Budget berhasil diupdate');
        setBudgetEditOpen(false);
        setEditingBudget(null);
        triggerRefresh();
      } else {
        toast.error('Gagal mengupdate budget');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Category CRUD ─────────────────────────────────────────────────────────

  const openNewCat = (type: 'income' | 'expense') => {
    setEditingCat(null);
    setCatForm({ type, name: '', emoji: '📦', color: '#78716c', trackLastDone: false });
    setCatFormOpen(true);
  };

  const openEditCat = (cat: FinanceCategory) => {
    setEditingCat(cat);
    setCatForm({ type: cat.type, name: cat.name, emoji: cat.emoji, color: cat.color, trackLastDone: cat.trackLastDone });
    setCatFormOpen(true);
  };

  const handleSubmitCat = async () => {
    if (!catForm.name.trim()) {
      toast.error('Masukkan nama kategori');
      return;
    }
    setSubmitting(true);
    try {
      if (editingCat) {
        const res = await fetch(`/api/finance/categories/${editingCat.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(catForm),
        });
        if (res.ok) {
          toast.success('Kategori berhasil diupdate');
        } else {
          const err = await res.json();
          toast.error(err.error || 'Gagal mengupdate kategori');
          return;
        }
      } else {
        const res = await fetch('/api/finance/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(catForm),
        });
        if (res.ok) {
          toast.success('Kategori berhasil ditambahkan');
        } else {
          toast.error('Gagal menambahkan kategori');
          return;
        }
      }
      setCatFormOpen(false);
      fetchCategories();
      triggerRefresh();
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCat = async (cat: FinanceCategory) => {
    try {
      const res = await fetch(`/api/finance/categories/${cat.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Kategori berhasil dihapus');
        fetchCategories();
        triggerRefresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Gagal menghapus kategori');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    }
  };

  // ── Source CRUD ─────────────────────────────────────────────────────────

  const openNewSource = () => {
    setEditingSource(null);
    setSourceForm({ name: '', emoji: '💵' });
    setSourceFormOpen(true);
  };

  const openEditSource = (src: FundSource) => {
    setEditingSource(src);
    setSourceForm({ name: src.name, emoji: src.emoji });
    setSourceFormOpen(true);
  };

  const handleSubmitSource = async () => {
    if (!sourceForm.name.trim()) {
      toast.error('Masukkan nama sumber dana');
      return;
    }
    setSubmitting(true);
    try {
      if (editingSource) {
        const res = await fetch(`/api/finance/sources/${editingSource.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sourceForm),
        });
        if (res.ok) {
          toast.success('Sumber dana berhasil diupdate');
        } else {
          const err = await res.json();
          toast.error(err.error || 'Gagal mengupdate');
          return;
        }
      } else {
        const res = await fetch('/api/finance/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sourceForm),
        });
        if (res.ok) {
          toast.success('Sumber dana berhasil ditambahkan');
        } else {
          const err = await res.json();
          toast.error(err.error || 'Gagal menambahkan');
          return;
        }
      }
      setSourceFormOpen(false);
      fetchSources();
      triggerRefresh();
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSource = async (src: FundSource) => {
    try {
      const res = await fetch(`/api/finance/sources/${src.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Sumber dana berhasil dihapus');
        fetchSources();
        triggerRefresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Gagal menghapus');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    }
  };

  // ── Bulk Delete ─────────────────────────────────────────────────────────

  const toggleSelectTx = (id: string) => {
    setSelectedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTxIds.size === filteredTransactions.length) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTxIds.size === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/finance/transactions/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedTxIds) }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.deleted} transaksi berhasil dihapus`);
        setSelectedTxIds(new Set());
        setBulkDeleteOpen(false);
        triggerRefresh();
      } else {
        toast.error('Gagal menghapus transaksi');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Month Navigation ──────────────────────────────────────────────────────

  const goToPrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedMonth(d.toISOString().slice(0, 7));
  };

  const goToNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setSelectedMonth(d.toISOString().slice(0, 7));
  };

  const goToThisMonth = () => {
    setSelectedMonth(new Date().toISOString().slice(0, 7));
  };

  const monthLabel = format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: idLocale });

  const monthOptions = useMemo(() => {
    const now = new Date();
    const opts: { value: string; label: string }[] = [];
    // 2 tahun ke belakang, 2 tahun ke depan
    for (let i = -24; i <= 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      opts.push({
        value: format(d, 'yyyy-MM'),
        label: format(d, 'MMMM yyyy', { locale: idLocale }),
      });
    }
    return opts;
  }, []);

  // ── Render Helpers ────────────────────────────────────────────────────────

  const filteredTransactions = transactions.filter(tx => {
    if (txFilter.search && !tx.description?.toLowerCase().includes(txFilter.search.toLowerCase()) && !tx.category.toLowerCase().includes(txFilter.search.toLowerCase()) && !tx.notes?.toLowerCase().includes(txFilter.search.toLowerCase())) return false;
    return true;
  });

  const incomeChange = dashboardData && dashboardData.previousMonth.income > 0
    ? Math.round(((dashboardData.totalIncome - dashboardData.previousMonth.income) / dashboardData.previousMonth.income) * 100)
    : 0;

  const expenseChange = dashboardData && dashboardData.previousMonth.expense > 0
    ? Math.round(((dashboardData.totalExpense - dashboardData.previousMonth.expense) / dashboardData.previousMonth.expense) * 100)
    : 0;

  // Daily spending chart data
  const dailySpendingChartData = dashboardData ? Object.entries(dashboardData.dailySpending)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({
      date: format(new Date(date), 'd MMM'),
      amount: Math.round(amount),
    })) : [];

  // Category pie chart data
  const categoryPieData = dashboardData ? Object.entries(dashboardData.expenseByCategory)
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value) : [];

  // Group transactions by date with daily totals
  const groupedTransactions = useMemo(() => {
    const sorted = [...filteredTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const groups: { dateKey: string; dateLabel: string; dayName: string; txs: Transaction[]; totalIncome: number; totalExpense: number; net: number }[] = [];
    let currentGroup: typeof groups[0] | null = null;

    for (const tx of sorted) {
      const d = new Date(tx.date);
      const dateKey = d.toISOString().split('T')[0];
      if (!currentGroup || currentGroup.dateKey !== dateKey) {
        currentGroup = {
          dateKey,
          dateLabel: format(d, 'd MMMM', { locale: idLocale }),
          dayName: format(d, 'EEEE', { locale: idLocale }),
          txs: [],
          totalIncome: 0,
          totalExpense: 0,
          net: 0,
        };
        groups.push(currentGroup);
      }
      currentGroup.txs.push(tx);
      if (tx.type === 'income') {
        currentGroup.totalIncome += tx.amount;
        currentGroup.net += tx.amount;
      } else {
        currentGroup.totalExpense += tx.amount;
        currentGroup.net -= tx.amount;
      }
    }
    return groups;
  }, [filteredTransactions]);

  if (loading && !dashboardData) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPrevMonth}>
            <CalendarDays className="h-4 w-4" />
          </Button>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[170px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="capitalize">{opt.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedMonth !== new Date().toISOString().slice(0, 7) && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={goToThisMonth}>
              Hari ini
            </Button>
          )}
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
            <CalendarDays className="h-4 w-4 rotate-180" />
          </Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => openNewTx('expense')} className="bg-red-500 hover:bg-red-600 text-white">
            <ArrowDownRight className="h-4 w-4 mr-1" />
            Pengeluaran
          </Button>
          <Button size="sm" onClick={() => openNewTx('income')}>
            <ArrowUpRight className="h-4 w-4 mr-1" />
            Pemasukan
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCatDialogOpen(true)}>
            <Settings2 className="h-4 w-4 mr-1" />
            Kategori
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSourceDialogOpen(true)}>
            <Wallet className="h-4 w-4 mr-1" />
            Sumber Dana
          </Button>
        </div>
      </div>

      {/* Sub Tabs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">
            <BarChart3 className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Ringkasan
          </TabsTrigger>
          <TabsTrigger value="transactions" className="text-xs sm:text-sm">
            <Wallet className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Transaksi
          </TabsTrigger>
          <TabsTrigger value="budgets" className="text-xs sm:text-sm">
            <Target className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Budget
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs sm:text-sm">
            <PieChart className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Analitik
          </TabsTrigger>
        </TabsList>

        {/* ─── OVERVIEW TAB ─── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {dashboardData && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-green-700 dark:text-green-400">Pemasukan</span>
                      {analyticsData?.sparklineData && analyticsData.sparklineData.length > 1 && (
                        <div className="w-20 h-8">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsLineChart data={analyticsData.sparklineData}>
                              <Line type="monotone" dataKey="income" stroke="#16a34a" strokeWidth={1.5} dot={false} />
                            </RechartsLineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                    <p className="text-xl font-bold text-green-700 dark:text-green-400">{formatRupiah(dashboardData.totalIncome)}</p>
                    {dashboardData.previousMonth.income > 0 && (
                      <p className={cn('text-[11px] mt-1', incomeChange >= 0 ? 'text-green-600' : 'text-red-500')}>
                        {incomeChange >= 0 ? '↑' : '↓'} {Math.abs(incomeChange)}% vs bulan lalu
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-red-700 dark:text-red-400">Pengeluaran</span>
                      {analyticsData?.sparklineData && analyticsData.sparklineData.length > 1 && (
                        <div className="w-20 h-8">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsLineChart data={analyticsData.sparklineData}>
                              <Line type="monotone" dataKey="expense" stroke="#dc2626" strokeWidth={1.5} dot={false} />
                            </RechartsLineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                    <p className="text-xl font-bold text-red-700 dark:text-red-400">{formatRupiah(dashboardData.totalExpense)}</p>
                    {dashboardData.previousMonth.expense > 0 && (
                      <p className={cn('text-[11px] mt-1', expenseChange <= 0 ? 'text-green-600' : 'text-red-500')}>
                        {expenseChange <= 0 ? '↓' : '↑'} {Math.abs(expenseChange)}% vs bulan lalu
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Saldo</span>
                      {analyticsData?.sparklineData && analyticsData.sparklineData.length > 1 && (
                        <div className="w-20 h-8">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsLineChart data={analyticsData.sparklineData}>
                              <Line type="monotone" dataKey="balance" stroke="#2563eb" strokeWidth={1.5} dot={false} />
                            </RechartsLineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                    <p className={cn('text-xl font-bold', dashboardData.balance >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-red-600')}>
                      {formatRupiah(dashboardData.balance)}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {dashboardData.transactionCount} transaksi
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Rata-rata/hari</span>
                      {analyticsData?.sparklineData && analyticsData.sparklineData.length > 1 && (
                        <div className="w-20 h-8">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsLineChart data={analyticsData.sparklineData}>
                              <Line type="monotone" dataKey="dailyAvg" stroke="#d97706" strokeWidth={1.5} dot={false} />
                            </RechartsLineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                    <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{formatRupiah(dashboardData.avgDailyExpense)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Proyeksi: {formatRupiah(dashboardData.projectedMonthlyExpense)}/bulan
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Last Done Tracking Card */}
              {lastDoneData.length > 0 && (
                <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-600" />
                      Terakhir Transaksi
                      <ChartInfo text="Menampilkan kapan terakhir transaksi untuk kategori yang kamu tandai 'Track Terakhir Transaksi' di pengaturan Kategori. Diurutkan dari yang paling lama belum transaksi." />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {lastDoneData.map(item => (
                        <div key={item.category} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card">
                          <span className="text-lg">{item.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{item.category}</p>
                            {item.daysAgo !== null ? (
                              <>
                                <p className={cn('text-[11px]', item.daysAgo <= 3 ? 'text-green-600' : item.daysAgo <= 7 ? 'text-amber-600' : 'text-red-500')}>
                                  {item.daysAgo === 0 ? 'Hari ini' : item.daysAgo === 1 ? 'Kemarin' : `${item.daysAgo} hari lalu`}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {item.lastDate ? format(new Date(item.lastDate), 'EEE, d MMM', { locale: idLocale }) : ''}
                                  {item.lastAmount !== null ? ` · ${formatRupiah(item.lastAmount)}` : ''}
                                </p>
                              </>
                            ) : (
                              <p className="text-[11px] text-muted-foreground italic">Belum ada transaksi</p>
                            )}
                          </div>
                          {item.daysAgo !== null && item.daysAgo > 7 && (
                            <div className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
                              item.daysAgo > 14 ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                            )}>
                              {item.daysAgo > 14 ? '⚠️' : '🕐'} {item.daysAgo}d
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Daily Spending Chart */}
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    Tren Pengeluaran Harian
                    <ChartInfo text="Total pengeluaran per hari dalam bulan yang dipilih. Area merah menunjukkan intensitas pengeluaran. Tanggal tanpa transaksi tidak ditampilkan." />
                  </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {dailySpendingChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={dailySpendingChartData}>
                          <defs>
                            <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                          <RechartsTooltip
                            formatter={(value: number) => [formatRupiah(value), 'Pengeluaran']}
                            contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                          />
                          <Area type="monotone" dataKey="amount" stroke="#ef4444" fill="url(#spendGrad)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                        Belum ada data pengeluaran bulan ini
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Category Breakdown */}
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    Pengeluaran per Kategori
                    <ChartInfo text="Persentase setiap kategori dari total pengeluaran bulan ini. Hanya 6 kategori teratas yang ditampilkan. Persentase = (jumlah kategori) / (total pengeluaran) × 100%." />
                  </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {categoryPieData.length > 0 ? (
                      <div className="space-y-3">
                        {categoryPieData.slice(0, 6).map((item, i) => {
                          const meta = getCategoryMeta(item.name);
                          const total = categoryPieData.reduce((s, c) => s + c.value, 0);
                          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                          return (
                            <div key={item.name} className="flex items-center gap-2">
                              <span className="text-base">{meta.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center text-xs mb-0.5">
                                  <span className="truncate font-medium">{item.name}</span>
                                  <span className="text-muted-foreground ml-1 shrink-0">{pct}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                        Belum ada data
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Budget Overview */}
              {dashboardData.budgetStatus.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Status Budget Bulan Ini
                      <ChartInfo text="Membandingkan total pengeluaran per kategori dengan batas anggaran. Progress bar kuning jika >80%, merah jika melebihi anggaran. Sisa/hari = (sisa anggaran) / (sisa hari di bulan ini)." />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {dashboardData.budgetStatus.map(b => {
                        const meta = getCategoryMeta(b.category);
                        const isOver = (b.percentage || 0) > 100;
                        return (
                          <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                            <span className="text-xl">{meta.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center text-xs mb-1">
                                <span className="font-medium truncate">{b.category}</span>
                                <span className={cn('shrink-0 font-semibold', isOver ? 'text-red-500' : 'text-muted-foreground')}>
                                  {formatRupiah(b.spent || 0)} / {formatRupiah(b.amount)}
                                </span>
                              </div>
                              <Progress
                                value={Math.min((b.percentage || 0), 100)}
                                className={cn('h-2', isOver && '[&>div]:bg-red-500')}
                              />
                              {isOver && (
                                <p className="text-[10px] text-red-500 mt-0.5">Over budget {formatRupiah((b.spent || 0) - b.amount)}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {dashboardData.totalBudget > 0 && (
                      <div className="mt-3 pt-3 border-t flex justify-between text-xs text-muted-foreground">
                        <span>Total Budget: {formatRupiah(dashboardData.totalBudget)}</span>
                        <span>Terpakai: {formatRupiah(dashboardData.totalBudgetSpent)} ({Math.round((dashboardData.totalBudgetSpent / dashboardData.totalBudget) * 100)}%)</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ─── TRANSACTIONS TAB ─── */}
        <TabsContent value="transactions" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari transaksi..."
                value={txFilter.search}
                onChange={e => setTxFilter(f => ({ ...f, search: e.target.value }))}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Select value={txFilter.type} onValueChange={v => setTxFilter(f => ({ ...f, type: v }))}>
              <SelectTrigger className="h-9 w-full sm:w-36 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                <SelectItem value="income">Pemasukan</SelectItem>
                <SelectItem value="expense">Pengeluaran</SelectItem>
              </SelectContent>
            </Select>
            <Select value={txFilter.category} onValueChange={v => setTxFilter(f => ({ ...f, category: v }))}>
              <SelectTrigger className="h-9 w-full sm:w-44 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {getCategoryList('expense').map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.emoji} {c.value}</SelectItem>
                ))}
                {getCategoryList('income').map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.emoji} {c.value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={txFilter.source} onValueChange={v => setTxFilter(f => ({ ...f, source: v }))}>
              <SelectTrigger className="h-9 w-full sm:w-[140px] text-sm">
                <SelectValue placeholder="Sumber" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Sumber</SelectItem>
                {getActiveSources().map(s => (
                  <SelectItem key={s.id || s.name} value={s.name}>{s.emoji} {s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Delete Bar */}
          {selectedTxIds.size > 0 && (
            <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <span className="text-sm font-medium text-red-700 dark:text-red-400">
                {selectedTxIds.size} transaksi dipilih
              </span>
              <div className="flex-1" />
              <Button size="sm" variant="outline" onClick={() => setSelectedTxIds(new Set())}>
                Batal Pilih
              </Button>
              <Button size="sm" className="bg-red-500 hover:bg-red-600" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Hapus ({selectedTxIds.size})
              </Button>
            </div>
          )}

          {/* Transactions Table */}
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-10">
                        <Checkbox
                          checked={filteredTransactions.length > 0 && selectedTxIds.size === filteredTransactions.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="text-xs w-12">Tipe</TableHead>
                      <TableHead className="text-xs">Tanggal</TableHead>
                      <TableHead className="text-xs">Kategori</TableHead>
                      <TableHead className="text-xs">Sumber</TableHead>
                      <TableHead className="text-xs">Deskripsi</TableHead>
                      <TableHead className="text-xs text-right">Jumlah</TableHead>
                      <TableHead className="text-xs w-20 text-center">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                          <Wallet className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          Belum ada transaksi
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions.map(tx => {
                        const meta = getCategoryMeta(tx.category);
                        return (
                          <TableRow key={tx.id} className="group">
                            <TableCell>
                              <Checkbox
                                checked={selectedTxIds.has(tx.id)}
                                onCheckedChange={() => toggleSelectTx(tx.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] px-1.5 py-0',
                                  tx.type === 'income'
                                    ? 'border-green-300 text-green-700 bg-green-50 dark:bg-green-950/30'
                                    : 'border-red-300 text-red-700 bg-red-50 dark:bg-red-950/30'
                                )}
                              >
                                {tx.type === 'income' ? '↑' : '↓'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {format(new Date(tx.date), 'd MMM', { locale: idLocale })}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">{meta.emoji}</span>
                                <span className="text-xs font-medium">{tx.category}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                                {getSourceEmoji(tx.source || 'Kas')} {tx.source || 'Kas'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {tx.description || '-'}
                            </TableCell>
                            <TableCell className={cn('text-xs text-right font-semibold', tx.type === 'income' ? 'text-green-600' : 'text-red-500')}>
                              {tx.type === 'income' ? '+' : '-'}{formatRupiah(tx.amount)}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTx(tx)}>
                                  <Edit3 className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => { setDeletingId(tx.id); setDeleteDialogOpen(true); }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── BUDGETS TAB ─── */}
        <TabsContent value="budgets" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Atur budget pengeluaran per kategori per bulan</p>
            <Button size="sm" onClick={() => { setBudgetForm({ category: '', amount: '', period: 'monthly' }); setBudgetDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" />
              Tambah Budget
            </Button>
          </div>

          {budgets.length === 0 ? (
            <Card>
              <CardContent className="py-16 flex flex-col items-center text-muted-foreground">
                <Target className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">Belum ada budget</p>
                <p className="text-xs mt-1">Atur budget per kategori untuk memantau pengeluaran</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {budgets.map(b => {
                const meta = getCategoryMeta(b.category);
                const dashboardBudget = dashboardData?.budgetStatus.find(db2 => db2.id === b.id);
                const spent = dashboardBudget?.spent || 0;
                const pct = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
                const isOver = pct > 100;
                const remaining = Math.max(0, b.amount - spent);

                // Calculate remaining days in the selected month
                const [bYear, bMonth] = selectedMonth.split('-').map(Number);
                const totalDaysInMonth = new Date(bYear, bMonth, 0).getDate();
                const now = new Date();
                const jakartaNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 7 * 60 * 60000);
                const isCurrentMonth = jakartaNow.getFullYear() === bYear && (jakartaNow.getMonth() + 1) === bMonth;
                const daysLeft = isCurrentMonth ? Math.max(1, totalDaysInMonth - jakartaNow.getDate() + 1) : null;

                return (
                  <Card key={b.id} className={cn('transition-colors group', isOver && 'border-red-300 dark:border-red-800')}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="text-2xl">{meta.emoji}</div>
                          <div>
                            <h3 className="text-sm font-semibold">{b.category}</h3>
                            <p className="text-[10px] text-muted-foreground capitalize">{b.period === 'monthly' ? 'Per Bulan' : 'Per Minggu'}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => openEditBudget(b)}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-500"
                            onClick={() => handleDeleteBudget(b.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Budget</span>
                          <span className="font-semibold">{formatRupiah(b.amount)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Terpakai</span>
                          <span className={cn('font-semibold', isOver ? 'text-red-500' : 'text-foreground')}>
                            {formatRupiah(spent)} ({Math.min(pct, 999)}%)
                          </span>
                        </div>
                        <Progress
                          value={Math.min(pct, 100)}
                          className={cn('h-2.5', isOver && '[&>div]:bg-red-500', !isOver && pct > 80 && '[&>div]:bg-amber-500')}
                        />
                        <div className="flex justify-between text-xs">
                          <span className={cn(isOver ? 'text-red-500 font-medium' : 'text-green-600')}>
                            {isOver ? `Over ${formatRupiah(spent - b.amount)}` : `Sisa ${formatRupiah(remaining)}`}
                          </span>
                          {b.amount > 0 && daysLeft !== null && !isOver && remaining > 0 && (
                            <span className="text-muted-foreground">
                              ~{formatRupiah(remaining / daysLeft)}/hari ({daysLeft} hari tersisa)
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── ANALYTICS TAB ─── */}
        <TabsContent value="analytics" className="space-y-4 mt-4">
          {analyticsData && (
            <>
              {/* Monthly Trend */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <LineChart className="h-4 w-4" />
                    Tren Bulanan (6 Bulan Terakhir)
                    <ChartInfo text="Grafik garis pemasukan (hijau), pengeluaran (merah), dan saldo (biru putus-putus) selama 6 bulan terakhir. Sumbu Y dalam juta (jt). Saldo = pemasukan − pengeluaran." />
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <ResponsiveContainer width="100%" height={280}>
                    <RechartsLineChart data={analyticsData.monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} />
                      <RechartsTooltip
                        formatter={(value: number, name: string) => [formatRupiah(value), name === 'income' ? 'Pemasukan' : name === 'expense' ? 'Pengeluaran' : 'Saldo']}
                        contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                      />
                      <Legend formatter={(value) => value === 'income' ? 'Pemasukan' : value === 'expense' ? 'Pengeluaran' : 'Saldo'} />
                      <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top Categories */}
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    Kategori Pengeluaran Teratas
                    <ChartInfo text="5 kategori dengan total pengeluaran terbesar dalam 6 bulan terakhir." />
                  </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {analyticsData.topCategories.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={analyticsData.topCategories} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                          <YAxis type="category" dataKey="category" width={130} tick={{ fontSize: 10 }} />
                          <RechartsTooltip
                            formatter={(value: number) => [formatRupiah(value), 'Total']}
                            contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                          />
                          <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                            {analyticsData.topCategories.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                        Belum ada data
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Income Sources Pie */}
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    Sumber Pemasukan
                    <ChartInfo text="Distribusi pemasukan berdasarkan kategori dalam 6 bulan terakhir. Persentase dihitung dari total pemasukan." />
                  </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {analyticsData.incomeSources.length > 0 ? (
                      <div className="flex items-center gap-4">
                        <ResponsiveContainer width="50%" height={200}>
                          <RechartsPieChart>
                            <Pie
                              data={analyticsData.incomeSources}
                              dataKey="amount"
                              nameKey="source"
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={3}
                            >
                              {analyticsData.incomeSources.map((_, i) => (
                                <Cell key={i} fill={['#22c55e', '#06b6d4', '#f59e0b', '#8b5cf6', '#78716c'][i % 5]} />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              formatter={(value: number) => formatRupiah(value)}
                              contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                            />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                        <div className="flex-1 space-y-2">
                          {analyticsData.incomeSources.map((s, i) => (
                            <div key={s.source} className="flex items-center gap-2 text-xs">
                              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ['#22c55e', '#06b6d4', '#f59e0b', '#8b5cf6', '#78716c'][i % 5] }} />
                              <span className="flex-1 truncate">{s.source}</span>
                              <span className="font-semibold">{s.percentage}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                        Belum ada data pemasukan
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* ─── NEW CHARTS ─── */}

              {/* 1. Stacked Bar Chart - Monthly Composition by Category */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  Komposisi Pengeluaran Bulanan
                  <ChartInfo text="Komposisi pengeluaran per bulan, ditumpuk berdasarkan kategori. 5 kategori teratas ditampilkan terpisah, sisanya digabungkan menjadi 'Lainnya'. Memudahkan melihat perubahan proporsi tiap bulan." />
                </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {(() => {
                    const comp = analyticsData.monthlyComposition;
                    if (!comp || comp.length === 0) return <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Belum ada data</div>;
                    // Get all categories across all months, find top 5
                    const allCatsMap: Record<string, number> = {};
                    comp.forEach(m => Object.entries(m.categories).forEach(([c, v]) => { allCatsMap[c] = (allCatsMap[c] || 0) + v; }));
                    const sortedCats = Object.entries(allCatsMap).sort(([, a], [, b]) => b - a);
                    const topCats = sortedCats.slice(0, 5).map(([c]) => c);
                    const otherCats = sortedCats.slice(5).map(([c]) => c);

                    const stackedData = comp.map(m => {
                      const row: Record<string, string | number> = { month: m.monthLabel };
                      let otherTotal = 0;
                      topCats.forEach(c => { row[c] = Math.round(m.categories[c] || 0); });
                      otherCats.forEach(c => { otherTotal += (m.categories[c] || 0); });
                      row['Lainnya'] = Math.round(otherTotal);
                      return row;
                    });

                    const allKeys = [...topCats, 'Lainnya'];

                    return (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={stackedData}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} />
                          <RechartsTooltip
                            formatter={(value: number) => formatRupiah(value)}
                            contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} iconSize={8} />
                          {allKeys.map((key, i) => (
                            <Bar key={key} dataKey={key} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* 2. Heatmap Calendar - Spending Intensity */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  Peta Panas Pengeluaran
                  <ChartInfo text="Intensitas pengeluaran harian selama 90 hari terakhir. Abu-abu = rendah, merah = tinggi. Intensitas dihitung relatif terhadap hari pengeluaran tertinggi. Kolom = minggu, baris = hari (Sen-Min)." />
                </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {analyticsData.dailySpending && analyticsData.dailySpending.length > 0 ? (
                    (() => {
                      // Pre-compute percentile thresholds for better color distribution
                      const nonZeroAmounts = analyticsData.dailySpending.filter(d => d.amount > 0).map(d => d.amount).sort((a, b) => a - b);
                      const len = nonZeroAmounts.length;
                      const q1 = len > 0 ? nonZeroAmounts[Math.floor(len * 0.25)] || nonZeroAmounts[0] : 1;
                      const q2 = len > 0 ? nonZeroAmounts[Math.floor(len * 0.5)] || nonZeroAmounts[0] : 1;
                      const q3 = len > 0 ? nonZeroAmounts[Math.floor(len * 0.75)] || nonZeroAmounts[0] : 1;

                      // Pre-compute weeks
                      const weeks: { date: string; amount: number }[][] = [[]];
                      let currentWeekStart = -1;
                      analyticsData.dailySpending.forEach(d => {
                        const day = new Date(d.date + 'T00:00:00').getDay();
                        const adjustedDay = day === 0 ? 6 : day - 1;
                        if (currentWeekStart === -1) currentWeekStart = adjustedDay;
                        if (adjustedDay < currentWeekStart && weeks[weeks.length - 1].length > 0) {
                          weeks.push([]);
                        }
                        currentWeekStart = adjustedDay;
                        weeks[weeks.length - 1].push(d);
                      });

                      function getHeatBg(amount: number | undefined): string {
                        if (amount === undefined || amount <= 0) return 'bg-stone-200 dark:bg-stone-800';
                        // Percentile-based: bottom 25% → light, 25-50% → medium, 50-75% → high, top 25% → intense
                        if (amount <= q1) return 'bg-amber-200 dark:bg-amber-900';
                        if (amount <= q2) return 'bg-amber-400 dark:bg-amber-700';
                        if (amount <= q3) return 'bg-orange-500 dark:bg-orange-600';
                        return 'bg-red-500 dark:bg-red-500';
                      }

                      return (
                        <div className="overflow-x-auto">
                          <div className="min-w-[500px]">
                            {/* Day labels */}
                            <div className="grid grid-cols-[40px_repeat(13,1fr)] gap-[3px] mb-1">
                              <div className="text-[10px] text-muted-foreground" />
                              {(() => {
                                const months: string[] = [];
                                let lastMonth = '';
                                analyticsData.dailySpending.forEach(d => {
                                  const m = d.date.slice(0, 7);
                                  if (m !== lastMonth) { months.push(m); lastMonth = m; }
                                });
                                return months.map(m => (
                                  <div key={m} className="text-[10px] text-muted-foreground text-center">
                                    {new Date(m + '-01').toLocaleDateString('en-US', { month: 'short' })}
                                  </div>
                                ));
                              })()}
                            </div>
                            {/* Day rows */}
                            {[1, 2, 3, 4, 5, 6, 0].map(dow => (
                              <div key={dow} className="grid grid-cols-[40px_repeat(13,1fr)] gap-[3px] mb-[3px]">
                                <div className="text-[10px] text-muted-foreground flex items-center">
                                  {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'][dow === 0 ? 6 : dow - 1]}
                                </div>
                                {weeks.slice(0, 13).map((week, wi) => {
                                  const day = week.find(d => {
                                    const dayOfWeek = new Date(d.date + 'T00:00:00').getDay();
                                    return (dayOfWeek === 0 ? 6 : dayOfWeek - 1) === dow;
                                  });
                                  return (
                                    <div
                                      key={wi}
                                      className={cn('w-full aspect-square rounded-sm', getHeatBg(day?.amount))}
                                      title={day ? `${day.date}: ${formatRupiah(day.amount)}` : 'Tidak ada data'}
                                    />
                                  );
                                })}
                              </div>
                            ))}
                            {/* Color legend */}
                            <div className="flex items-center gap-2 mt-2 justify-end">
                              <span className="text-[9px] text-muted-foreground">Sedikit</span>
                              <div className="flex gap-[2px]">
                                <div className="w-3 h-3 rounded-sm bg-stone-200 dark:bg-stone-800" />
                                <div className="w-3 h-3 rounded-sm bg-amber-200 dark:bg-amber-900" />
                                <div className="w-3 h-3 rounded-sm bg-amber-400 dark:bg-amber-700" />
                                <div className="w-3 h-3 rounded-sm bg-orange-500 dark:bg-orange-600" />
                                <div className="w-3 h-3 rounded-sm bg-red-500 dark:bg-red-500" />
                              </div>
                              <span className="text-[9px] text-muted-foreground">Banyak</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                      Belum ada data
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 3. Savings Trend */}
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    Tren Tabungan
                    <ChartInfo text="Selisih pemasukan dan pengeluaran per bulan. Bar hijau = surplus (menabung), bar merah = defisit (pengeluaran melebihi pemasukan). Persentase perubahan vs bulan sebelumnya ditampilkan." />
                  </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {analyticsData.monthlySavings && analyticsData.monthlySavings.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={analyticsData.monthlySavings}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} />
                          <RechartsTooltip
                            formatter={(value: number) => [formatRupiah(Math.abs(value)), value >= 0 ? 'Surplus' : 'Defisit']}
                            contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                            labelFormatter={(label, payload) => {
                              const item = payload?.[0]?.payload;
                              if (item && item.changePercent !== undefined && item.changePercent !== 0) {
                                return `${label} (${item.changePercent > 0 ? '+' : ''}${item.changePercent}%)`;
                              }
                              return String(label);
                            }}
                          />
                          <ReferenceLine y={0} stroke="#78716c" strokeDasharray="3 3" />
                          <Bar dataKey="savings" name="savings" radius={[4, 4, 0, 0]}>
                            {(analyticsData.monthlySavings || []).map((entry, index) => (
                              <Cell key={index} fill={entry.savings >= 0 ? '#22c55e' : '#ef4444'} fillOpacity={0.8} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Belum ada data</div>
                    )}
                  </CardContent>
                </Card>

                {/* 4. Tornado/Butterfly Chart */}
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    Perbandingan Bulan Ini vs Bulan Lalu
                    <ChartInfo text="Perbandingan pengeluaran per kategori antara bulan ini dan bulan lalu. Bar ke kanan = bulan ini, bar ke kiri = bulan lalu. Memudahkan melihat kategori mana yang naik atau turun." />
                  </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {analyticsData.categoryComparison && analyticsData.categoryComparison.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={analyticsData.categoryComparison.slice(0, 8).map(c => ({
                          category: c.category,
                          'Bulan Lalu': -c.lastMonth,
                          'Bulan Ini': c.thisMonth,
                        }))} layout="vertical" margin={{ left: 110, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(Math.abs(v) / 1000).toFixed(0)}k`} />
                          <YAxis type="category" dataKey="category" width={105} tick={{ fontSize: 10 }} />
                          <RechartsTooltip
                            formatter={(value: number, name: string) => [formatRupiah(Math.abs(value)), name]}
                            contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          <Bar dataKey="Bulan Lalu" fill="#f97316" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="Bulan Ini" fill="#ef4444" radius={[4, 0, 0, 4]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                        Belum cukup data untuk perbandingan
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* 5. Radar Chart - Financial Health Score */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  Skor Kesehatan Keuangan
                  <ChartInfo text="5 dimensi keuangan masing-masing dinilai 0-100: (1) Rasio Tabungan: persentase pemasukan yang tersimpan, (2) Diversifikasi: jumlah kategori pengeluaran yang digunakan, (3) Disiplin Budget: persentase anggaran yang tidak terlampaui, (4) Konsistensi: hari dengan transaksi / hari di bulan, (5) Keseimbangan: rasio kategori pemasukan vs pengeluaran. Skor keseluruhan = rata-rata kelima dimensi." />
                </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {analyticsData.financialHealth ? (
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <div className="relative w-[260px] h-[260px] shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={[
                            { dim: 'Tabungan', score: analyticsData.financialHealth.rasioTabungan },
                            { dim: 'Diversifikasi', score: analyticsData.financialHealth.diversifikasi },
                            { dim: 'Budget', score: analyticsData.financialHealth.disiplinBudget },
                            { dim: 'Konsistensi', score: analyticsData.financialHealth.konsistensi },
                            { dim: 'Keseimbangan', score: analyticsData.financialHealth.keseimbangan },
                          ]}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10 }} style={{ overflow: 'visible' }} />
                            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                            <Radar
                              name="Skor"
                              dataKey="score"
                              stroke="#f97316"
                              fill="#f97316"
                              fillOpacity={0.2}
                              strokeWidth={2}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-3xl font-bold" style={{ color: analyticsData.financialHealth.overallScore >= 70 ? '#22c55e' : analyticsData.financialHealth.overallScore >= 40 ? '#f59e0b' : '#ef4444' }}>
                            {analyticsData.financialHealth.overallScore}
                          </span>
                          <span className="text-[10px] text-muted-foreground">Skor Total</span>
                        </div>
                      </div>
                      <div className="flex-1 space-y-2 w-full max-w-xs">
                        {[
                          { label: 'Rasio Tabungan', score: analyticsData.financialHealth.rasioTabungan, desc: 'Pemasukan vs pengeluaran' },
                          { label: 'Diversifikasi', score: analyticsData.financialHealth.diversifikasi, desc: 'Variasi kategori' },
                          { label: 'Disiplin Budget', score: analyticsData.financialHealth.disiplinBudget, desc: 'Ketaatan budget' },
                          { label: 'Konsistensi', score: analyticsData.financialHealth.konsistensi, desc: 'Frekuensi transaksi' },
                          { label: 'Keseimbangan', score: analyticsData.financialHealth.keseimbangan, desc: 'Kategori masuk vs keluar' },
                        ].map(item => (
                          <div key={item.label} className="space-y-0.5">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium">{item.label}</span>
                              <span className={cn('font-semibold', item.score >= 70 ? 'text-green-600' : item.score >= 40 ? 'text-amber-600' : 'text-red-500')}>
                                {item.score}/100
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${item.score}%`,
                                  backgroundColor: item.score >= 70 ? '#22c55e' : item.score >= 40 ? '#f59e0b' : '#ef4444',
                                }}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Belum ada data</div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Weekly Pattern */}
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    Pola Pengeluaran per Hari
                    <ChartInfo text="Total dan rata-rata pengeluaran per hari dalam seminggu selama 6 bulan terakhir. Berguna untuk melihat pola: hari mana biasanya pengeluaran lebih tinggi." />
                  </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={analyticsData.weeklyPattern}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <RechartsTooltip
                          formatter={(value: number, name: string) => [formatRupiah(value), name === 'total' ? 'Total' : 'Rata-rata']}
                          contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                        />
                        <Bar dataKey="total" fill="#a855f7" radius={[4, 4, 0, 0]} name="total" />
                        <Bar dataKey="avg" fill="#c084fc" radius={[4, 4, 0, 0]} name="avg" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Summary Stats + Largest Expenses */}
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    Ringkasan & Pengeluaran Terbesar
                    <ChartInfo text="Total pemasukan dan pengeluaran 6 bulan terakhir. Rasio tabungan = (pemasukan − pengeluaran) / pemasukan × 100%. Top 5 transaksi pengeluaran terbesar dalam periode." />
                  </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                        <p className="text-[10px] text-muted-foreground mb-1">Total Masuk</p>
                        <p className="text-sm font-bold text-green-600">{formatRupiah(analyticsData.totalIncomeInRange)}</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                        <p className="text-[10px] text-muted-foreground mb-1">Total Keluar</p>
                        <p className="text-sm font-bold text-red-500">{formatRupiah(analyticsData.totalExpenseInRange)}</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                        <p className="text-[10px] text-muted-foreground mb-1">Rasio Tabungan</p>
                        <p className={cn('text-sm font-bold', analyticsData.savingsRate >= 0 ? 'text-blue-600' : 'text-red-500')}>
                          {analyticsData.savingsRate}%
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">5 Pengeluaran Terbesar</p>
                      <div className="space-y-1.5">
                        {analyticsData.largestExpenses.length > 0 ? analyticsData.largestExpenses.map((tx, i) => {
                          const meta = getCategoryMeta(tx.category);
                          return (
                            <div key={tx.id} className="flex items-center gap-2 text-xs">
                              <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                              <span>{meta.emoji}</span>
                              <span className="flex-1 truncate">{tx.description || tx.category}</span>
                              <span className="font-semibold text-red-500 shrink-0">{formatRupiah(tx.amount)}</span>
                            </div>
                          );
                        }) : (
                          <p className="text-xs text-muted-foreground text-center py-4">Belum ada data</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── ADD/EDIT TRANSACTION DIALOG ─── */}
      <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTx ? 'Edit Transaksi' : 'Tambah Transaksi'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Type Toggle */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={txForm.type === 'expense' ? 'default' : 'outline'}
                className={cn(txForm.type === 'expense' && 'bg-red-500 hover:bg-red-600 text-white')}
                onClick={() => setTxForm(f => ({ ...f, type: 'expense', category: '' }))}
              >
                <ArrowDownRight className="h-4 w-4 mr-1" />
                Pengeluaran
              </Button>
              <Button
                type="button"
                variant={txForm.type === 'income' ? 'default' : 'outline'}
                className={cn(txForm.type === 'income' && 'bg-green-500 hover:bg-green-600 text-white')}
                onClick={() => setTxForm(f => ({ ...f, type: 'income', category: '' }))}
              >
                <ArrowUpRight className="h-4 w-4 mr-1" />
                Pemasukan
              </Button>
            </div>

            <div>
              <Label className="text-xs">Jumlah (Rp)</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={txForm.amount}
                onChange={e => setTxForm(f => ({ ...f, amount: formatNominalInput(e.target.value) }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Kategori</Label>
              <Select value={txForm.category} onValueChange={v => setTxForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {getCategoryList(txForm.type).map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.emoji} {c.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Sumber Dana</Label>
              <Select value={txForm.source} onValueChange={v => setTxForm(f => ({ ...f, source: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih sumber" />
                </SelectTrigger>
                <SelectContent>
                  {getActiveSources().map(s => (
                    <SelectItem key={s.id || s.name} value={s.name}>{s.emoji} {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Tanggal</Label>
              <Input
                type="date"
                value={txForm.date}
                onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Deskripsi</Label>
              <Input
                placeholder="Contoh: Makan siang di kantin"
                value={txForm.description}
                onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Catatan (opsional)</Label>
              <Input
                placeholder="Catatan tambahan..."
                value={txForm.notes}
                onChange={e => setTxForm(f => ({ ...f, notes: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setTxDialogOpen(false)}>Batal</Button>
              <Button className="flex-1" onClick={handleSubmitTx} disabled={submitting}>
                {submitting ? 'Menyimpan...' : editingTx ? 'Update' : 'Simpan'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── ADD BUDGET DIALOG ─── */}
      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Kategori Pengeluaran</Label>
              <Select value={budgetForm.category} onValueChange={v => setBudgetForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {getCategoryList('expense').map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.emoji} {c.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Jumlah Budget (Rp)</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={budgetForm.amount}
                onChange={e => setBudgetForm(f => ({ ...f, amount: formatNominalInput(e.target.value) }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Periode</Label>
              <Select value={budgetForm.period} onValueChange={v => setBudgetForm(f => ({ ...f, period: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Bulanan</SelectItem>
                  <SelectItem value="weekly">Mingguan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setBudgetDialogOpen(false)}>Batal</Button>
              <Button className="flex-1" onClick={handleSubmitBudget} disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan Budget'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── EDIT BUDGET DIALOG ─── */}
      <Dialog open={budgetEditOpen} onOpenChange={setBudgetEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Kategori Pengeluaran</Label>
              <Select value={budgetForm.category} onValueChange={v => setBudgetForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {getCategoryList('expense').map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.emoji} {c.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Jumlah Budget (Rp)</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={budgetForm.amount}
                onChange={e => setBudgetForm(f => ({ ...f, amount: formatNominalInput(e.target.value) }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Periode</Label>
              <Select value={budgetForm.period} onValueChange={v => setBudgetForm(f => ({ ...f, period: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Bulanan</SelectItem>
                  <SelectItem value="weekly">Mingguan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setBudgetEditOpen(false)}>Batal</Button>
              <Button className="flex-1" onClick={handleSubmitEditBudget} disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Update Budget'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── DELETE CONFIRMATION ─── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Transaksi?</AlertDialogTitle>
            <AlertDialogDescription>
              Transaksi yang dihapus tidak bisa dikembalikan. Yakin ingin melanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTx} className="bg-red-500 hover:bg-red-600">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── BULK DELETE CONFIRMATION ─── */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {selectedTxIds.size} Transaksi?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak bisa dibatalkan. {selectedTxIds.size} transaksi yang dipilih akan dihapus secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-red-500 hover:bg-red-600">
              Hapus {selectedTxIds.size} Transaksi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── CATEGORY MANAGEMENT DIALOG ─── */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kelola Kategori</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Pengeluaran Categories */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-red-600">📁 Pengeluaran</h3>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openNewCat('expense')}>
                  <Plus className="h-3 w-3 mr-1" /> Tambah
                </Button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                {expenseCategories.map(cat => (
                  <div key={cat.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card group hover:bg-accent/50 transition-colors">
                    <span className="text-lg">{cat.emoji}</span>
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="flex-1 text-sm font-medium truncate">{cat.name}</span>
                    {cat.trackLastDone && <span className="text-[10px] text-amber-600 bg-amber-100 dark:bg-amber-950 dark:text-amber-400 px-1.5 py-0.5 rounded-full shrink-0">track</span>}
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditCat(cat)}>
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => handleDeleteCat(cat)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {expenseCategories.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Belum ada kategori</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Pemasukan Categories */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-green-600">💰 Pemasukan</h3>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openNewCat('income')}>
                  <Plus className="h-3 w-3 mr-1" /> Tambah
                </Button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                {incomeCategories.map(cat => (
                  <div key={cat.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card group hover:bg-accent/50 transition-colors">
                    <span className="text-lg">{cat.emoji}</span>
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="flex-1 text-sm font-medium truncate">{cat.name}</span>
                    {cat.trackLastDone && <span className="text-[10px] text-amber-600 bg-amber-100 dark:bg-amber-950 dark:text-amber-400 px-1.5 py-0.5 rounded-full shrink-0">track</span>}
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditCat(cat)}>
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => handleDeleteCat(cat)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {incomeCategories.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Belum ada kategori</p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── ADD/EDIT CATEGORY DIALOG ─── */}
      <Dialog open={catFormOpen} onOpenChange={(open) => { if (!open) setCatFormOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCat ? 'Edit Kategori' : 'Tambah Kategori'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Tipe</Label>
                <div className="flex gap-2 mt-1">
                  <Badge variant={catForm.type === 'expense' ? 'default' : 'outline'} className={cn('cursor-pointer', catForm.type === 'expense' && 'bg-red-500')} onClick={() => setCatForm(f => ({ ...f, type: 'expense' }))}>
                    Pengeluaran
                  </Badge>
                  <Badge variant={catForm.type === 'income' ? 'default' : 'outline'} className={cn('cursor-pointer', catForm.type === 'income' && 'bg-green-500')} onClick={() => setCatForm(f => ({ ...f, type: 'income' }))}>
                    Pemasukan
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-[60px_1fr] gap-3">
                <div>
                  <Label className="text-xs">Emoji</Label>
                  <Input
                    value={catForm.emoji}
                    onChange={e => setCatForm(f => ({ ...f, emoji: e.target.value }))}
                    className="mt-1 text-center text-lg"
                    maxLength={4}
                  />
                </div>
                <div>
                  <Label className="text-xs">Nama Kategori</Label>
                  <Input
                    placeholder="Contoh: Makan Siang"
                    value={catForm.name}
                    onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Warna</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={catForm.color}
                    onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))}
                    className="w-10 h-10 rounded-lg border cursor-pointer"
                  />
                  <Input
                    value={catForm.color}
                    onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))}
                    className="flex-1 font-mono text-xs"
                    placeholder="#78716c"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 py-1">
                <Checkbox
                  id="trackLastDone"
                  checked={catForm.trackLastDone}
                  onCheckedChange={(checked) => setCatForm(f => ({ ...f, trackLastDone: !!checked }))}
                />
                <label htmlFor="trackLastDone" className="text-xs cursor-pointer select-none">
                  <span className="font-medium">Track Terakhir Transaksi</span>
                  <span className="text-muted-foreground ml-1">Tampilkan kapan terakhir transaksi di kategori ini</span>
                </label>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setCatFormOpen(false)}>Batal</Button>
                <Button className="flex-1" onClick={handleSubmitCat} disabled={submitting}>
                  {submitting ? 'Menyimpan...' : editingCat ? 'Update' : 'Simpan'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      {/* ─── SOURCE MANAGEMENT DIALOG ─── */}
      <Dialog open={sourceDialogOpen} onOpenChange={setSourceDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kelola Sumber Dana</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Kelola akun bank, e-wallet, kas, dll</p>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openNewSource}>
                <Plus className="h-3 w-3 mr-1" /> Tambah
              </Button>
            </div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar">
              {getActiveSources().map(src => (
                <div key={src.id || src.name} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card group hover:bg-accent/50 transition-colors">
                  <span className="text-lg">{src.emoji}</span>
                  <span className="flex-1 text-sm font-medium truncate">{src.name}</span>
                  {src.id && (
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSource(src)}>
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => handleDeleteSource(src)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── ADD/EDIT SOURCE DIALOG ─── */}
      <Dialog open={sourceFormOpen} onOpenChange={(open) => { if (!open) setSourceFormOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingSource ? 'Edit Sumber Dana' : 'Tambah Sumber Dana'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-[60px_1fr] gap-3">
              <div>
                <Label className="text-xs">Emoji</Label>
                <Input
                  value={sourceForm.emoji}
                  onChange={e => setSourceForm(f => ({ ...f, emoji: e.target.value }))}
                  className="mt-1 text-center text-lg"
                  maxLength={4}
                />
              </div>
              <div>
                <Label className="text-xs">Nama Sumber</Label>
                <Input
                  placeholder="Contoh: Bank BCA"
                  value={sourceForm.name}
                  onChange={e => setSourceForm(f => ({ ...f, name: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSourceFormOpen(false)}>Batal</Button>
              <Button className="flex-1" onClick={handleSubmitSource} disabled={submitting}>
                {submitting ? 'Menyimpan...' : editingSource ? 'Update' : 'Simpan'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}