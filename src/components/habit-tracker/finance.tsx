'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import {
  Card,
  CardContent,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Plus,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Trash2,
  Edit3,
  BarChart3,
  PieChart,
  Settings2,
  CalendarDays,
} from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';

// Lazy-loaded sub-components
const FinanceOverview = dynamic(() => import('./finance-overview'), {
  ssr: false,
  loading: () => (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    </div>
  ),
});
import FinanceTransactions from './finance-transactions';
import FinanceBudgets from './finance-budgets';

// Lazy load analytics — this is where ALL heavy Recharts live
const FinanceAnalytics = dynamic(() => import('./finance-analytics'), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <Skeleton className="h-[300px] rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-[280px] rounded-xl" />
        <Skeleton className="h-[280px] rounded-xl" />
      </div>
    </div>
  ),
});

// Types & shared imports
import type {
  Transaction,
  BudgetItem,
  DashboardData,
  FinanceCategory,
  LastDoneItem,
  FundSource,
} from './finance-types';
import {
  FALLBACK_EXPENSE,
  FALLBACK_INCOME,
  EMOJI_OPTIONS,
  FALLBACK_SOURCES,
  formatNominalInput,
  parseNominalInput,
  formatRupiah,
  capitalize,
} from './finance-types';

// ── Component ────────────────────────────────────────────────────────────────

export default function Finance() {
  const selectedMonth = useAppStore(s => s.selectedMonth);
  const setSelectedMonth = useAppStore(s => s.setSelectedMonth);
  const triggerRefresh = useAppStore(s => s.triggerRefresh);
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState('overview');

  // Filter states (declared early because useQuery depends on txFilter)
  const [txFilter, setTxFilter] = useState<{ type: string; category: string; source: string; search: string }>({ type: 'all', category: 'all', source: 'all', search: '' });

  // ── Data Fetching (TanStack Query) ─────────────────────────────────────
  // All fetch calls migrated from manual useEffect + useState to useQuery.
  // Benefits: automatic dedup, caching, background refetch, race-free.

  // Shared data (categories + sources) — fetched on mount, cached for all sub-components
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<FinanceCategory[]>({
    queryKey: ['finance', 'categories'],
    queryFn: async () => {
      const res = await fetch('/api/finance/categories');
      if (!res.ok) return [];
      return res.json() as Promise<FinanceCategory[]>;
    },
    staleTime: 60_000, // categories rarely change
  });

  // Auto-migrate legacy emoji (separate effect — NOT inside queryFn to avoid infinite loop)
  // Uses localStorage (shared across tabs) instead of sessionStorage (per-tab) to
  // prevent multi-tab race condition where two tabs both trigger migration POST.
  useEffect(() => {
    if (categories.length > 0 && categories.some((c: FinanceCategory) => c.emoji === '📦')) {
      if (!localStorage.getItem('emoji_migrated')) {
        localStorage.setItem('emoji_migrated', '1');
        fetch('/api/finance/categories/migrate-emojis', { method: 'POST' })
          .then((r) => { if (r.ok) queryClient.invalidateQueries({ queryKey: ['finance', 'categories'] }); })
          .catch(() => { localStorage.removeItem('emoji_migrated'); /* retry next time */ });
      }
    }
  }, [categories, queryClient]);

  const { data: sources = [], isLoading: sourcesLoading } = useQuery<FundSource[]>({
    queryKey: ['finance', 'sources'],
    queryFn: async () => {
      const res = await fetch('/api/finance/sources');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  // Tab-specific data — fetched on demand based on activeSubTab + selectedMonth
  const { data: dashboardData } = useQuery<DashboardData>({
    queryKey: ['finance', 'dashboard', selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/finance/dashboard?month=${selectedMonth}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: activeSubTab === 'overview' || activeSubTab === 'budgets',
    staleTime: 30_000,
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['finance', 'transactions', selectedMonth, txFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ month: selectedMonth });
      if (txFilter.type !== 'all') params.set('type', txFilter.type);
      if (txFilter.category !== 'all') params.set('category', txFilter.category);
      if (txFilter.source !== 'all') params.set('source', txFilter.source);
      if (txFilter.search.trim()) params.set('search', txFilter.search.trim());
      const res = await fetch(`/api/finance/transactions?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: activeSubTab === 'transactions',
    staleTime: 15_000,
  });

  const { data: budgets = [] } = useQuery<BudgetItem[]>({
    queryKey: ['finance', 'budgets'],
    queryFn: async () => {
      const res = await fetch('/api/finance/budgets');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: activeSubTab === 'budgets',
    staleTime: 30_000,
  });

  const { data: lastDoneData = [] } = useQuery<LastDoneItem[]>({
    queryKey: ['finance', 'last-done'],
    queryFn: async () => {
      const res = await fetch('/api/finance/last-done');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: activeSubTab === 'overview',
    staleTime: 60_000,
  });

  const sharedLoading = categoriesLoading || sourcesLoading;

  // Dialog states
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<FinanceCategory | null>(null);
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [sourceFormOpen, setSourceFormOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<FundSource | null>(null);
  const [sourceForm, setSourceForm] = useState({ name: '', emoji: '💵', balance: 0 });
  const [balanceEditId, setBalanceEditId] = useState<string | null>(null);
  const [balanceEditValue, setBalanceEditValue] = useState('');
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [budgetEditOpen, setBudgetEditOpen] = useState(false);
  const [deletingSource, setDeletingSource] = useState<FundSource | null>(null);

  // Form states
  const [txForm, setTxForm] = useState({ type: 'expense', amount: '', category: '', description: '', date: '', notes: '', source: 'Kas' });
  const [budgetForm, setBudgetForm] = useState({ category: '', amount: '', period: 'monthly' });
  const [catForm, setCatForm] = useState({ type: 'expense' as string, name: '', emoji: '📦', color: '#78716c', trackLastDone: false });
  const [submitting, setSubmitting] = useState(false);

  // ── Category helpers ──────────────────────────────────────────────────────

  const ALL_KNOWN_EMOJIS = useMemo(() => {
    const map = new Map<string, { emoji: string; color: string }>();
    [...FALLBACK_EXPENSE, ...FALLBACK_INCOME].forEach(c => map.set(c.value, { emoji: c.emoji, color: c.color }));
    return map;
  }, []);

  const resolveEmoji = useCallback((cat: FinanceCategory) => {
    if (cat.emoji !== '📦') return cat;
    const known = ALL_KNOWN_EMOJIS.get(cat.name);
    return known ? { ...cat, emoji: known.emoji, color: known.color || cat.color } : cat;
  }, [ALL_KNOWN_EMOJIS]);

  const getCategoryMeta = useCallback((cat: string) => {
    if (!cat) return { emoji: '📦', color: '#78716c' };
    const trimmed = cat.trim();
    // Exact match first (fast path)
    const found = categories.find(c => c.name === trimmed);
    if (found) {
      if (found.emoji === '📦') {
        const known = ALL_KNOWN_EMOJIS.get(trimmed);
        if (known) return { emoji: known.emoji, color: known.color || found.color };
      }
      return { emoji: found.emoji, color: found.color };
    }
    // Case-insensitive fallback
    const foundCI = categories.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (foundCI) {
      if (foundCI.emoji === '📦') {
        const known = ALL_KNOWN_EMOJIS.get(trimmed);
        if (known) return { emoji: known.emoji, color: known.color || foundCI.color };
      }
      return { emoji: foundCI.emoji, color: foundCI.color };
    }
    // Fallback to known emoji map
    const known = ALL_KNOWN_EMOJIS.get(trimmed) || ALL_KNOWN_EMOJIS.get(trimmed.toLowerCase());
    if (known) return known;
    // First letter as emoji for custom categories without emoji
    return { emoji: '📦', color: '#78716c' };
  }, [categories, ALL_KNOWN_EMOJIS]);

  const getCategoryList = useCallback((type: string) => {
    const cats = categories.filter(c => c.type === type);
    if (cats.length > 0) return cats.map(c => {
      if (c.emoji === '📦') {
        const known = ALL_KNOWN_EMOJIS.get(c.name);
        if (known) return { value: c.name, emoji: known.emoji, color: known.color || c.color };
      }
      return { value: c.name, emoji: c.emoji, color: c.color };
    });
    return type === 'expense' ? FALLBACK_EXPENSE : FALLBACK_INCOME;
  }, [categories, ALL_KNOWN_EMOJIS]);

  const getActiveSources = useCallback(() => {
    if (sources.length > 0) return sources;
    return FALLBACK_SOURCES.map(s => ({ id: '', name: s.value, emoji: s.emoji, balance: 0, order: 0 }));
  }, [sources]);

  const getSourceEmoji = useCallback((name: string) => {
    const found = sources.find(s => s.name === name);
    if (found) return found.emoji;
    return FALLBACK_SOURCES.find(s => s.value === name)?.emoji || '💵';
  }, [sources]);

  // ── Note: All fetch logic now handled by useQuery hooks above ─────────────
  // (Previously: 4 fetch functions + 2 useEffects with AbortController)
  // TanStack Query handles: dedup, caching, background refetch, race conditions.

  // ── Helper: invalidate all finance queries after a mutation ─────────────
  // Replaces the old triggerRefresh() + fetchCategories() + fetchSources() pattern.
  // Invalidation causes TanStack Query to refetch active queries in the background.
  const invalidateFinance = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['finance'] });
    // Also notify other components (e.g. dashboard) that data changed
    triggerRefresh();
  }, [queryClient, triggerRefresh]);

  // ── Transaction CRUD ──────────────────────────────────────────────────────

  const openNewTx = (type: 'income' | 'expense') => {
    setEditingTx(null);
    setTxForm({ type, amount: '', category: '', description: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '', source: 'Kas' });
    setTxDialogOpen(true);
  };

  const openEditTx = (tx: Transaction) => {
    setEditingTx(tx);
    setTxForm({
      type: tx.type, amount: formatNominalInput(String(tx.amount)), category: tx.category,
      description: tx.description || '', date: tx.date.split('T')[0], notes: tx.notes || '', source: tx.source || 'Kas',
    });
    setTxDialogOpen(true);
  };

  const handleSubmitTx = async () => {
    const rawAmount = parseNominalInput(txForm.amount);
    if (!rawAmount || parseFloat(rawAmount) <= 0) { toast.error('Masukkan jumlah yang valid'); return; }
    if (!txForm.category) { toast.error('Pilih kategori'); return; }
    if (!txForm.date) { toast.error('Pilih tanggal'); return; }
    const payload = { ...txForm, amount: rawAmount };
    setSubmitting(true);
    try {
      if (editingTx) {
        const res = await fetch(`/api/finance/transactions/${editingTx.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (res.ok) toast.success('Transaksi berhasil diupdate'); else { toast.error('Gagal mengupdate transaksi'); return; }
      } else {
        const res = await fetch('/api/finance/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (res.ok) toast.success('Transaksi berhasil ditambahkan'); else { toast.error('Gagal menambahkan transaksi'); return; }
      }
      setTxDialogOpen(false);
      invalidateFinance();
    } catch { toast.error('Terjadi kesalahan'); } finally { setSubmitting(false); }
  };

  const handleDeleteTx = async () => {
    if (!deletingId) return;
    try {
      const res = await fetch(`/api/finance/transactions/${deletingId}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Transaksi berhasil dihapus'); setDeleteDialogOpen(false); setDeletingId(null); invalidateFinance(); }
      else toast.error('Gagal menghapus transaksi');
    } catch { toast.error('Terjadi kesalahan'); }
  };

  // ── Budget CRUD ───────────────────────────────────────────────────────────

  const handleSubmitBudget = async () => {
    if (!budgetForm.category) { toast.error('Pilih kategori'); return; }
    const rawBudgetAmount = parseNominalInput(budgetForm.amount);
    if (!rawBudgetAmount || parseFloat(rawBudgetAmount) <= 0) { toast.error('Masukkan jumlah budget yang valid'); return; }
    const budgetPayload = { ...budgetForm, amount: rawBudgetAmount };
    setSubmitting(true);
    try {
      const res = await fetch('/api/finance/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(budgetPayload) });
      if (res.ok) { toast.success('Budget berhasil disimpan'); setBudgetDialogOpen(false); invalidateFinance(); }
      else toast.error('Gagal menyimpan budget');
    } catch { toast.error('Terjadi kesalahan'); } finally { setSubmitting(false); }
  };

  const handleDeleteBudget = async (id: string) => {
    try {
      const res = await fetch(`/api/finance/budgets/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Budget berhasil dihapus'); invalidateFinance(); }
    } catch { toast.error('Gagal menghapus budget'); }
  };

  const openEditBudget = (b: BudgetItem) => {
    setEditingBudget(b);
    setBudgetForm({ category: b.category, amount: formatNominalInput(String(b.amount)), period: b.period });
    setBudgetEditOpen(true);
  };

  const handleSubmitEditBudget = async () => {
    if (!editingBudget) return;
    if (!budgetForm.category) { toast.error('Pilih kategori'); return; }
    const rawBudgetAmount = parseNominalInput(budgetForm.amount);
    if (!rawBudgetAmount || parseFloat(rawBudgetAmount) <= 0) { toast.error('Masukkan jumlah budget yang valid'); return; }
    const budgetPayload = { category: budgetForm.category, amount: rawBudgetAmount, period: budgetForm.period };
    setSubmitting(true);
    try {
      const res = await fetch(`/api/finance/budgets/${editingBudget.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(budgetPayload) });
      if (res.ok) { toast.success('Budget berhasil diupdate'); setBudgetEditOpen(false); setEditingBudget(null); invalidateFinance(); }
      else toast.error('Gagal mengupdate budget');
    } catch { toast.error('Terjadi kesalahan'); } finally { setSubmitting(false); }
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
    if (!catForm.name.trim()) { toast.error('Masukkan nama kategori'); return; }
    setSubmitting(true);
    try {
      if (editingCat) {
        const res = await fetch(`/api/finance/categories/${editingCat.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catForm) });
        if (res.ok) toast.success('Kategori berhasil diupdate'); else { const err = await res.json(); toast.error(err.error || 'Gagal mengupdate kategori'); return; }
      } else {
        const res = await fetch('/api/finance/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catForm) });
        if (res.ok) toast.success('Kategori berhasil ditambahkan'); else { toast.error('Gagal menambahkan kategori'); return; }
      }
      setCatFormOpen(false);
      invalidateFinance();
    } catch { toast.error('Terjadi kesalahan'); } finally { setSubmitting(false); }
  };

  const handleDeleteCat = async (cat: FinanceCategory) => {
    try {
      const res = await fetch(`/api/finance/categories/${cat.id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Kategori berhasil dihapus'); invalidateFinance(); }
      else { const err = await res.json(); toast.error(err.error || 'Gagal menghapus kategori'); }
    } catch { toast.error('Terjadi kesalahan'); }
  };

  // ── Source CRUD ─────────────────────────────────────────────────────────

  const openNewSource = () => { setEditingSource(null); setSourceForm({ name: '', emoji: '💵', balance: 0 }); setSourceFormOpen(true); };
  const openEditSource = (src: FundSource) => { setEditingSource(src); setSourceForm({ name: src.name, emoji: src.emoji, balance: src.balance || 0 }); setSourceFormOpen(true); };

  const handleSubmitSource = async () => {
    if (!sourceForm.name.trim()) { toast.error('Masukkan nama sumber dana'); return; }
    setSubmitting(true);
    try {
      if (editingSource) {
        const res = await fetch(`/api/finance/sources/${editingSource.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sourceForm) });
        if (res.ok) toast.success('Sumber dana berhasil diupdate'); else { const err = await res.json(); toast.error(err.error || 'Gagal mengupdate'); return; }
      } else {
        const res = await fetch('/api/finance/sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sourceForm) });
        if (res.ok) toast.success('Sumber dana berhasil ditambahkan'); else { const err = await res.json(); toast.error(err.error || 'Gagal menambahkan'); return; }
      }
      setSourceFormOpen(false); invalidateFinance();
    } catch { toast.error('Terjadi kesalahan'); } finally { setSubmitting(false); }
  };

  const handleDeleteSource = async (src: FundSource) => {
    try {
      const res = await fetch(`/api/finance/sources/${src.id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Sumber dana berhasil dihapus'); invalidateFinance(); }
      else { const err = await res.json(); toast.error(err.error || 'Gagal menghapus'); }
    } catch { toast.error('Terjadi kesalahan'); }
  };

  const handleSaveBalance = async (sourceId: string) => {
    const raw = parseNominalInput(balanceEditValue);
    const val = parseFloat(raw);
    if (isNaN(val)) { setBalanceEditId(null); return; }
    try {
      const res = await fetch(`/api/finance/sources/${sourceId}/balance`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ balance: val }) });
      if (res.ok) { toast.success('Saldo berhasil diupdate'); queryClient.invalidateQueries({ queryKey: ['finance', 'sources'] }); }
    } catch { toast.error('Gagal update saldo'); }
    setBalanceEditId(null); setBalanceEditValue('');
  };

  // ── Bulk Delete ─────────────────────────────────────────────────────────

  const toggleSelectTx = (id: string) => {
    setSelectedTxIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const toggleSelectAll = () => {
    if (selectedTxIds.size === filteredTransactions.length) setSelectedTxIds(new Set());
    else setSelectedTxIds(new Set(filteredTransactions.map(t => t.id)));
  };

  const handleBulkDelete = async () => {
    if (selectedTxIds.size === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/finance/transactions/bulk-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: Array.from(selectedTxIds) }) });
      if (res.ok) { const data = await res.json(); toast.success(`${data.deleted} transaksi berhasil dihapus`); setSelectedTxIds(new Set()); setBulkDeleteOpen(false); invalidateFinance(); }
      else toast.error('Gagal menghapus transaksi');
    } catch { toast.error('Terjadi kesalahan'); } finally { setSubmitting(false); }
  };

  // ── Month Navigation ──────────────────────────────────────────────────────

  const goToPrevMonth = () => { const [y, m] = selectedMonth.split('-').map(Number); setSelectedMonth(format(new Date(y, m - 2, 1), 'yyyy-MM')); };
  const goToNextMonth = () => { const [y, m] = selectedMonth.split('-').map(Number); setSelectedMonth(format(new Date(y, m, 1), 'yyyy-MM')); };
  const goToThisMonth = () => { setSelectedMonth(format(new Date(), 'yyyy-MM')); };
  const monthLabel = useMemo(() => format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: idLocale }), [selectedMonth]);

  const monthOptions = useMemo(() => {
    const now = new Date();
    const opts: { value: string; label: string }[] = [];
    for (let i = -24; i <= 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      opts.push({ value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy', { locale: idLocale }) });
    }
    return opts;
  }, []);

  // ── Render Helpers ────────────────────────────────────────────────────────

  const filteredTransactions = useMemo(() => transactions.filter(tx => {
    if (txFilter.type !== 'all' && tx.type !== txFilter.type) return false;
    if (txFilter.category !== 'all' && tx.category !== txFilter.category) return false;
    if (txFilter.source !== 'all' && tx.source !== txFilter.source) return false;
    if (txFilter.search && !tx.description?.toLowerCase().includes(txFilter.search.toLowerCase()) && !tx.category.toLowerCase().includes(txFilter.search.toLowerCase()) && !tx.notes?.toLowerCase().includes(txFilter.search.toLowerCase())) return false;
    return true;
  }), [transactions, txFilter]);

  const dailySpendingChartData = useMemo(() => dashboardData ? Object.entries(dashboardData.dailySpending)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date: format(new Date(date), 'd MMM'), amount: Math.round(amount) })) : [], [dashboardData]);

  const categoryPieData = useMemo(() => dashboardData ? Object.entries(dashboardData.expenseByCategory)
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value) : [], [dashboardData]);

  const groupedTransactions = useMemo(() => {
    const sorted = [...filteredTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const groups: { dateKey: string; dateLabel: string; dayName: string; txs: Transaction[]; totalIncome: number; totalExpense: number; net: number }[] = [];
    let currentGroup: typeof groups[0] | null = null;
    for (const tx of sorted) {
      const d = new Date(tx.date);
      const dateKey = format(d, 'yyyy-MM-dd');
      if (!currentGroup || currentGroup.dateKey !== dateKey) {
        currentGroup = { dateKey, dateLabel: format(d, 'd MMMM', { locale: idLocale }), dayName: format(d, 'EEEE', { locale: idLocale }), txs: [], totalIncome: 0, totalExpense: 0, net: 0 };
        groups.push(currentGroup);
      }
      currentGroup.txs.push(tx);
      if (tx.type === 'income') { currentGroup.totalIncome += tx.amount; currentGroup.net += tx.amount; }
      else { currentGroup.totalExpense += tx.amount; currentGroup.net -= tx.amount; }
    }
    return groups;
  }, [filteredTransactions]);

  const expenseCategories = categories.filter(c => c.type === 'expense').map(resolveEmoji);
  const incomeCategories = categories.filter(c => c.type === 'income').map(resolveEmoji);

  // ── Loading State ─────────────────────────────────────────────────────────

  if (sharedLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2"><Skeleton className="h-10 w-48" /><Skeleton className="h-10 w-32" /></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPrevMonth}><CalendarDays className="h-4 w-4" /></Button>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[170px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-64">
              {monthOptions.map((opt) => (<SelectItem key={opt.value} value={opt.value}><span className="capitalize">{opt.label}</span></SelectItem>))}
            </SelectContent>
          </Select>
          {selectedMonth !== format(new Date(), 'yyyy-MM') && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={goToThisMonth}>Hari ini</Button>
          )}
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextMonth}><CalendarDays className="h-4 w-4 rotate-180" /></Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => openNewTx('expense')} className="bg-red-500 hover:bg-red-600 text-white"><ArrowDownRight className="h-4 w-4 mr-1" />Pengeluaran</Button>
          <Button size="sm" onClick={() => openNewTx('income')}><ArrowUpRight className="h-4 w-4 mr-1" />Pemasukan</Button>
          <Button size="sm" variant="outline" onClick={() => setCatDialogOpen(true)}><Settings2 className="h-4 w-4 mr-1" />Kategori</Button>
          <Button size="sm" variant="outline" onClick={() => setSourceDialogOpen(true)}><Wallet className="h-4 w-4 mr-1" />Sumber Dana</Button>
        </div>
      </div>

      {/* Sub Tabs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="text-xs sm:text-sm"><BarChart3 className="h-3.5 w-3.5 mr-1" />Ringkasan</TabsTrigger>
          <TabsTrigger value="transactions" className="text-xs sm:text-sm"><Wallet className="h-3.5 w-3.5 mr-1" />Transaksi</TabsTrigger>
          <TabsTrigger value="budgets" className="text-xs sm:text-sm"><Target className="h-3.5 w-3.5 mr-1" />Budget</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs sm:text-sm"><PieChart className="h-3.5 w-3.5 mr-1" />Analitik</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {dashboardData ? (
            <FinanceOverview
              dashboardData={dashboardData}
              lastDoneData={lastDoneData}
              getCategoryMeta={getCategoryMeta}
              dailySpendingChartData={dailySpendingChartData}
              categoryPieData={categoryPieData}
            />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <FinanceTransactions
            filteredTransactions={filteredTransactions}
            groupedTransactions={groupedTransactions}
            selectedTxIds={selectedTxIds}
            txFilter={txFilter}
            getCategoryList={getCategoryList}
            getActiveSources={getActiveSources}
            getCategoryMeta={getCategoryMeta}
            getSourceEmoji={getSourceEmoji}
            onFilterChange={setTxFilter}
            onToggleSelectTx={toggleSelectTx}
            onToggleSelectAll={toggleSelectAll}
            onEditTx={openEditTx}
            onDeleteTx={(id) => { setDeletingId(id); setDeleteDialogOpen(true); }}
            onBulkDelete={() => setBulkDeleteOpen(true)}
          />
        </TabsContent>

        <TabsContent value="budgets" className="mt-4">
          <FinanceBudgets
            budgets={budgets}
            dashboardData={dashboardData ?? null}
            selectedMonth={selectedMonth}
            getCategoryMeta={getCategoryMeta}
            onAddBudget={() => { setBudgetForm({ category: '', amount: '', period: 'monthly' }); setBudgetDialogOpen(true); }}
            onEditBudget={openEditBudget}
            onDeleteBudget={handleDeleteBudget}
          />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <FinanceAnalytics getCategoryMeta={getCategoryMeta} />
        </TabsContent>
      </Tabs>

      {/* ─── ADD/EDIT TRANSACTION DIALOG ─── */}
      <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingTx ? 'Edit Transaksi' : 'Tambah Transaksi'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={txForm.type === 'expense' ? 'default' : 'outline'} className={cn(txForm.type === 'expense' && 'bg-red-500 hover:bg-red-600 text-white')} onClick={() => setTxForm(f => ({ ...f, type: 'expense', category: '' }))}><ArrowDownRight className="h-4 w-4 mr-1" />Pengeluaran</Button>
              <Button type="button" variant={txForm.type === 'income' ? 'default' : 'outline'} className={cn(txForm.type === 'income' && 'bg-primary hover:bg-primary text-white')} onClick={() => setTxForm(f => ({ ...f, type: 'income', category: '' }))}><ArrowUpRight className="h-4 w-4 mr-1" />Pemasukan</Button>
            </div>
            <div><Label className="text-xs">Jumlah (Rp)</Label><Input type="text" inputMode="numeric" placeholder="0" value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: formatNominalInput(e.target.value) }))} className="mt-1" /></div>
            <div><Label className="text-xs">Kategori</Label><Select value={txForm.category} onValueChange={v => setTxForm(f => ({ ...f, category: v }))}><SelectTrigger className="mt-1"><SelectValue placeholder="Pilih kategori" /></SelectTrigger><SelectContent>{getCategoryList(txForm.type).map(c => (<SelectItem key={c.value} value={c.value}>{c.emoji} {c.value}</SelectItem>))}</SelectContent></Select></div>
            <div><Label className="text-xs">Sumber Dana</Label><Select value={txForm.source} onValueChange={v => setTxForm(f => ({ ...f, source: v }))}><SelectTrigger className="mt-1"><SelectValue placeholder="Pilih sumber" /></SelectTrigger><SelectContent>{getActiveSources().map(s => (<SelectItem key={s.id || s.name} value={s.name}>{s.emoji} {s.name}</SelectItem>))}</SelectContent></Select></div>
            <div><Label className="text-xs">Tanggal</Label><Input type="date" value={txForm.date} onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">Deskripsi</Label><Input placeholder="Contoh: Makan siang di kantin" value={txForm.description} onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">Catatan (opsional)</Label><Input placeholder="Catatan tambahan..." value={txForm.notes} onChange={e => setTxForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" /></div>
            <div className="flex gap-2 pt-2"><Button variant="outline" className="flex-1" onClick={() => setTxDialogOpen(false)}>Batal</Button><Button className="flex-1" onClick={handleSubmitTx} disabled={submitting}>{submitting ? 'Menyimpan...' : editingTx ? 'Update' : 'Simpan'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── ADD BUDGET DIALOG ─── */}
      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Tambah Budget</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs">Kategori Pengeluaran</Label><Select value={budgetForm.category} onValueChange={v => setBudgetForm(f => ({ ...f, category: v }))}><SelectTrigger className="mt-1"><SelectValue placeholder="Pilih kategori" /></SelectTrigger><SelectContent>{getCategoryList('expense').map(c => (<SelectItem key={c.value} value={c.value}>{c.emoji} {c.value}</SelectItem>))}</SelectContent></Select></div>
            <div><Label className="text-xs">Jumlah Budget (Rp)</Label><Input type="text" inputMode="numeric" placeholder="0" value={budgetForm.amount} onChange={e => setBudgetForm(f => ({ ...f, amount: formatNominalInput(e.target.value) }))} className="mt-1" /></div>
            <div><Label className="text-xs">Periode</Label><Select value={budgetForm.period} onValueChange={v => setBudgetForm(f => ({ ...f, period: v }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Bulanan</SelectItem><SelectItem value="weekly">Mingguan</SelectItem></SelectContent></Select></div>
            <div className="flex gap-2 pt-2"><Button variant="outline" className="flex-1" onClick={() => setBudgetDialogOpen(false)}>Batal</Button><Button className="flex-1" onClick={handleSubmitBudget} disabled={submitting}>{submitting ? 'Menyimpan...' : 'Simpan Budget'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── EDIT BUDGET DIALOG ─── */}
      <Dialog open={budgetEditOpen} onOpenChange={setBudgetEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Budget</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs">Kategori Pengeluaran</Label><Select value={budgetForm.category} onValueChange={v => setBudgetForm(f => ({ ...f, category: v }))}><SelectTrigger className="mt-1"><SelectValue placeholder="Pilih kategori" /></SelectTrigger><SelectContent>{getCategoryList('expense').map(c => (<SelectItem key={c.value} value={c.value}>{c.emoji} {c.value}</SelectItem>))}</SelectContent></Select></div>
            <div><Label className="text-xs">Jumlah Budget (Rp)</Label><Input type="text" inputMode="numeric" placeholder="0" value={budgetForm.amount} onChange={e => setBudgetForm(f => ({ ...f, amount: formatNominalInput(e.target.value) }))} className="mt-1" /></div>
            <div><Label className="text-xs">Periode</Label><Select value={budgetForm.period} onValueChange={v => setBudgetForm(f => ({ ...f, period: v }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Bulanan</SelectItem><SelectItem value="weekly">Mingguan</SelectItem></SelectContent></Select></div>
            <div className="flex gap-2 pt-2"><Button variant="outline" className="flex-1" onClick={() => setBudgetEditOpen(false)}>Batal</Button><Button className="flex-1" onClick={handleSubmitEditBudget} disabled={submitting}>{submitting ? 'Menyimpan...' : 'Update Budget'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── DELETE CONFIRMATION ─── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus Transaksi?</AlertDialogTitle><AlertDialogDescription>Transaksi yang dihapus tidak bisa dikembalikan. Yakin ingin melanjutkan?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleDeleteTx} className="bg-red-500 hover:bg-red-600">Hapus</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── BULK DELETE CONFIRMATION ─── */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus {selectedTxIds.size} Transaksi?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak bisa dibatalkan. {selectedTxIds.size} transaksi yang dipilih akan dihapus secara permanen.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleBulkDelete} className="bg-red-500 hover:bg-red-600">Hapus {selectedTxIds.size} Transaksi</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── CATEGORY MANAGEMENT DIALOG ─── */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Kelola Kategori</DialogTitle></DialogHeader>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-red-600">📁 Pengeluaran</h3>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openNewCat('expense')}><Plus className="h-3 w-3 mr-1" />Tambah</Button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                {expenseCategories.map(cat => (
                  <div key={cat.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card group hover:bg-accent/50 transition-colors">
                    <span className="text-lg">{cat.emoji}</span>
                    <span className="flex-1 text-sm font-medium truncate">{cat.name}</span>
                    {cat.trackLastDone && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">track</span>}
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditCat(cat)}><Edit3 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => handleDeleteCat(cat)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-primary">💰 Pemasukan</h3>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openNewCat('income')}><Plus className="h-3 w-3 mr-1" />Tambah</Button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                {incomeCategories.map(cat => (
                  <div key={cat.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card group hover:bg-accent/50 transition-colors">
                    <span className="text-lg">{cat.emoji}</span>
                    <span className="flex-1 text-sm font-medium truncate">{cat.name}</span>
                    {cat.trackLastDone && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">track</span>}
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditCat(cat)}><Edit3 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => handleDeleteCat(cat)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── CATEGORY FORM DIALOG ─── */}
      <Dialog open={catFormOpen} onOpenChange={(open) => { if (!open) setCatFormOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingCat ? 'Edit Kategori' : 'Tambah Kategori'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-[60px_1fr] gap-3">
              <div><Label className="text-xs">Emoji</Label><Input value={catForm.emoji} onChange={e => setCatForm(f => ({ ...f, emoji: e.target.value }))} className="mt-1 text-center text-lg" maxLength={4} /></div>
              <div><Label className="text-xs">Nama</Label><Input placeholder="Contoh: Makanan" value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
            </div>
            <div><Label className="text-xs">Warna</Label><Input type="color" value={catForm.color} onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))} className="mt-1 h-10 w-16 cursor-pointer" /></div>
            <div className="flex items-center gap-2"><input type="checkbox" id="trackLastDone" checked={catForm.trackLastDone} onChange={e => setCatForm(f => ({ ...f, trackLastDone: e.target.checked }))} className="rounded border-gray-300" /><Label htmlFor="trackLastDone" className="text-xs">Track terakhir transaksi</Label></div>
            <div className="flex gap-2 pt-2"><Button variant="outline" className="flex-1" onClick={() => setCatFormOpen(false)}>Batal</Button><Button className="flex-1" onClick={handleSubmitCat} disabled={submitting}>{submitting ? 'Menyimpan...' : editingCat ? 'Update' : 'Simpan'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── SOURCE MANAGEMENT DIALOG ─── */}
      <Dialog open={sourceDialogOpen} onOpenChange={setSourceDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Kelola Sumber Dana</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl bg-gradient-to-br from-primary/10 to-teal-50 dark:to-teal-950/30 border border-primary/20 p-4">
              <p className="text-xs text-primary font-medium mb-1">Total Saldo Semua Sumber</p>
              <p className="text-2xl font-bold text-primary">{formatRupiah(sources.reduce((s, src) => s + (src.balance || 0), 0))}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Kelola akun bank, e-wallet, kas, dll</p>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openNewSource}><Plus className="h-3 w-3 mr-1" />Tambah</Button>
            </div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar">
              {getActiveSources().map(src => (
                <div key={src.id || src.name} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-card group hover:bg-accent/50 transition-colors">
                  <span className="text-lg">{src.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{src.name}</p>
                    {balanceEditId === src.id ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-muted-foreground">Rp</span>
                        <Input autoFocus className="h-6 text-xs w-28 px-1.5 py-0" value={balanceEditValue} onChange={e => setBalanceEditValue(formatNominalInput(e.target.value))} onKeyDown={e => { if (e.key === 'Enter') handleSaveBalance(src.id); if (e.key === 'Escape') setBalanceEditId(null); }} onBlur={() => handleSaveBalance(src.id)} />
                      </div>
                    ) : (
                      <button className="text-xs font-semibold hover:underline cursor-pointer" style={{ color: (src.balance || 0) >= 0 ? '#059669' : '#dc2626' }} onClick={() => { setBalanceEditId(src.id); setBalanceEditValue(src.balance ? String(Math.abs(src.balance)) : ''); }}>
                        {(src.balance || 0) < 0 ? '-' : ''}{formatRupiah(Math.abs(src.balance || 0))}
                      </button>
                    )}
                  </div>
                  {src.id && (
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSource(src)}><Edit3 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => setDeletingSource(src)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
          <DialogHeader><DialogTitle>{editingSource ? 'Edit Sumber Dana' : 'Tambah Sumber Dana'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-[60px_1fr] gap-3">
              <div><Label className="text-xs">Emoji</Label><Input value={sourceForm.emoji} onChange={e => setSourceForm(f => ({ ...f, emoji: e.target.value }))} className="mt-1 text-center text-lg" maxLength={4} /></div>
              <div><Label className="text-xs">Nama Sumber</Label><Input placeholder="Contoh: Bank BCA" value={sourceForm.name} onChange={e => setSourceForm(f => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
            </div>
            {!editingSource && (
              <div>
                <Label className="text-xs">Saldo Awal</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
                  <Input placeholder="0" value={formatNominalInput(String(sourceForm.balance || ''))} onChange={e => { const raw = e.target.value.replace(/[^\d]/g, ''); setSourceForm(f => ({ ...f, balance: parseInt(raw || '0', 10) })); }} className="pl-10" />
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2"><Button variant="outline" className="flex-1" onClick={() => setSourceFormOpen(false)}>Batal</Button><Button className="flex-1" onClick={handleSubmitSource} disabled={submitting}>{submitting ? 'Menyimpan...' : editingSource ? 'Update' : 'Simpan'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── DELETE SOURCE CONFIRMATION ─── */}
      <AlertDialog open={!!deletingSource} onOpenChange={(open) => { if (!open) setDeletingSource(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Sumber Dana</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus <strong>{deletingSource?.emoji} {deletingSource?.name}</strong>?
              {deletingSource && (deletingSource.balance || 0) !== 0 && (
                <span className="block mt-1 text-amber-600 dark:text-amber-400">Sumber ini memiliki saldo {formatRupiah(deletingSource.balance || 0)}.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingSource(null)}>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => { if (deletingSource) { handleDeleteSource(deletingSource); setDeletingSource(null); } }}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}