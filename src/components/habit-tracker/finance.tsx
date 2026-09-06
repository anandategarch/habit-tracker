'use client';

import { useState, useCallback, useMemo, useEffect, useDeferredValue } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
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
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Wallet,
  Settings2,
  CalendarDays,
  Compass,
  BarChart3,
  PieChart,
  PiggyBank,
  Repeat,
  Wand2,
} from 'lucide-react';
import { format, id as idLocale } from '@/lib/date-utils';
// PERF-FIX (FIX-TIER3 / Fix 15): replaced `date-fns` with native Intl-based
// utility module. Output is identical for the patterns used here
// ('yyyy-MM', 'MMMM yyyy' with id locale) — verified via test script in
// worklog FIX-TIER3 entry.
import { jakartaDateKey, jakartaMonthString } from '@/lib/timezone';
import { useAppStore } from '@/store/app-store';
import { MoneyParticles } from './money-particles';
import { useFinanceMutations } from '@/hooks/use-finance-mutations';
// Split-out dialog components (SPLIT-PHASE2-UI):
import { FinanceTxDialog } from './finance-tx-dialog';
import { FinanceBudgetDialogs } from './finance-budget-dialogs';
import { FinanceDeleteDialogs } from './finance-delete-dialogs';
import { FinanceCategoryDialogs } from './finance-category-dialogs';
import { FinanceSourceDialogs } from './finance-source-dialogs';

// Lazy-loaded sub-components.
// FIX-TIER2 / Fix 6: All 5 finance sub-tabs use dynamic() with ssr:false
// + a loading skeleton fallback so the user sees an immediate placeholder
// instead of a blank frame while the chunk fetches. The loading fallbacks
// match each sub-tab's layout (transactions = filter bar + list rows,
// budgets = grid of cards) to minimize visual shift when the chunk resolves.
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
const FinanceTransactions = dynamic(() => import('./finance-transactions'), {
  ssr: false,
  loading: () => (
    <div className="space-y-3 mt-4">
      {/* Filter bar skeleton */}
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-32 rounded-md" />
        <Skeleton className="h-9 w-32 rounded-md" />
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>
      {/* Grouped transaction list skeleton */}
      {[1, 2, 3].map((g) => (
        <div key={g} className="space-y-2">
          <Skeleton className="h-5 w-32 rounded" />
          {[1, 2].map((r) => (
            <Skeleton key={r} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  ),
});
const FinanceBudgets = dynamic(() => import('./finance-budgets'), {
  ssr: false,
  loading: () => (
    <div className="space-y-3 mt-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32 rounded" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  ),
});

// Lazy load explorer — drill-down analytics workspace
const FinanceExplorer = dynamic(() => import('./finance-explorer'), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <Skeleton className="h-[300px] rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    </div>
  ),
});

// Lazy load category explorer — per-category drill-down with charts
const CategoryExplorer = dynamic(() => import('./category-explorer'), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <Skeleton className="h-[300px] rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    </div>
  ),
});

// Lazy load savings goals — Firefly III "piggy banks" inspired feature
// (PHASE2-FINANCE-2). Same skeleton pattern as budgets since the layout is
// a header + grid of cards.
const FinanceSavingsGoals = dynamic(() => import('./finance-savings-goals'), {
  ssr: false,
  loading: () => (
    <div className="space-y-3 mt-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32 rounded" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-44 rounded-2xl" />
        ))}
      </div>
    </div>
  ),
});

// Lazy load recurring transactions — Actual Budget + Firefly III inspired
// auto-create transactions on a schedule (PHASE2-FINANCE-1).
const FinanceRecurring = dynamic(() => import('./finance-recurring'), {
  ssr: false,
  loading: () => (
    <div className="space-y-3 mt-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40 rounded" />
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  ),
});

// Lazy load rule engine — Firefly III inspired auto-categorization rules
// (PHASE2-FINANCE-1).
const FinanceRules = dynamic(() => import('./finance-rules'), {
  ssr: false,
  loading: () => (
    <div className="space-y-3 mt-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32 rounded" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
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
  FALLBACK_SOURCES,
} from './finance-types';

// ── Component ────────────────────────────────────────────────────────────────

export default function Finance() {
  const selectedMonth = useAppStore(s => s.selectedMonth);
  const setSelectedMonth = useAppStore(s => s.setSelectedMonth);
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState('overview');

  // Filter states (declared early because useQuery depends on txFilter)
  const [txFilter, setTxFilter] = useState<{ type: string; category: string; source: string; search: string }>({ type: 'all', category: 'all', source: 'all', search: '' });

  // ── Data Fetching (TanStack Query) ─────────────────────────────────────
  // All fetch calls migrated from manual useEffect + useState to useQuery.
  // Benefits: automatic dedup, caching, background refetch, race-free.

  // Shared data (categories + sources) — fetched on mount, cached for all sub-components.
  // Sources is declared FIRST because useFinanceMutations needs getActiveSources
  // (which depends on sources) — see the hook call below.
  const { data: sources = [], isLoading: sourcesLoading } = useQuery<FundSource[]>({
    queryKey: ['finance', 'sources'],
    queryFn: async () => {
      const res = await fetch('/api/finance/sources');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  const getActiveSources = useCallback(() => {
    if (sources.length > 0) return sources;
    return FALLBACK_SOURCES.map(s => ({ id: '', name: s.value, emoji: s.emoji, balance: 0, order: 0 }));
  }, [sources]);

  // ── Mutations hook (SPLIT-PHASE2-UI) ──
  // All dialog/form state + CRUD handlers live in this hook.
  const mutations = useFinanceMutations({ getActiveSources });

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

  // PERF-FIX (FIX-TIER3 / Fix 18): debounce the search input.
  // Previously `txFilter.search` was used directly in the queryKey, so
  // every keystroke triggered a React Query refetch — even though the
  // API route ignores the `search` param (FIN-BUG-6 fix: Prisma
  // `contains` is case-sensitive on SQLite, so filtering is done
  // client-side). The refetch returned the same data each time, wasting
  // a network round-trip per keystroke.
  //
  // `useDeferredValue` lets the input update immediately (no input lag)
  // while deferring the queryKey update until React's render budget
  // allows — effectively debouncing rapid keystrokes into a single
  // refetch once the user pauses typing. The client-side
  // `filteredTransactions` filter (line ~294) still uses the immediate
  // `txFilter.search`, so the displayed list updates instantly; only
  // the API refetch is debounced.
  const debouncedSearch = useDeferredValue(txFilter.search);

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['finance', 'transactions', selectedMonth, { ...txFilter, search: debouncedSearch }],
    queryFn: async () => {
      // FEAT-SEARCH-ALLTIME: When user types a search query, skip the month
      // param so the search spans ALL periods. This lets users find a
      // transaction from any month without navigating to that month first.
      // When search is empty, fall back to month-scoped view (normal mode).
      const params = new URLSearchParams();
      const isSearching = debouncedSearch.trim().length > 0;
      if (!isSearching) {
        params.set('month', selectedMonth);
      }
      if (txFilter.type !== 'all') params.set('type', txFilter.type);
      if (txFilter.category !== 'all') params.set('category', txFilter.category);
      if (txFilter.source !== 'all') params.set('source', txFilter.source);
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
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

  const getSourceEmoji = useCallback((name: string) => {
    const found = sources.find(s => s.name === name);
    if (found) return found.emoji;
    return FALLBACK_SOURCES.find(s => s.value === name)?.emoji || '💵';
  }, [sources]);

  // ── Month Navigation ──────────────────────────────────────────────────────

  const goToPrevMonth = () => { const [y, m] = selectedMonth.split('-').map(Number); setSelectedMonth(format(new Date(y, m - 2, 1), 'yyyy-MM')); };
  const goToNextMonth = () => { const [y, m] = selectedMonth.split('-').map(Number); setSelectedMonth(format(new Date(y, m, 1), 'yyyy-MM')); };
  const goToThisMonth = () => { setSelectedMonth(jakartaMonthString()); };

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
    // FEAT-SEARCH-ALLTIME: Client-side search filter must match the server-side
    // filter logic (description OR category OR source OR tags) so that
    // instant (non-debounced) filtering doesn't discard source/tags matches
    // that the server correctly returned. Notes is also checked for
    // completeness (client has notes in the Transaction type even though the
    // API select drops it — notes will be undefined, which safely skips).
    if (txFilter.search) {
      const term = txFilter.search.toLowerCase();
      const tagsStr = typeof tx.tags === 'string' ? tx.tags : '';
      let tagsArr: string[] = [];
      try { tagsArr = JSON.parse(tagsStr || '[]'); } catch { /* malformed */ }
      const matches =
        tx.description?.toLowerCase().includes(term) ||
        (tx.category ?? '').toLowerCase().includes(term) ||
        (tx.source ?? '').toLowerCase().includes(term) ||
        tx.notes?.toLowerCase().includes(term) ||
        tagsArr.some((t) => t.toLowerCase().includes(term));
      if (!matches) return false;
    }
    return true;
  }), [transactions, txFilter]);

  const groupedTransactions = useMemo(() => {
    const sorted = [...filteredTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const groups: { dateKey: string; dateLabel: string; dayName: string; txs: Transaction[]; totalIncome: number; totalExpense: number; net: number }[] = [];
    // BUG-6 fix: hoist Intl.DateTimeFormat instances outside the loop.
    // Previously used date-fns format(d, 'yyyy-MM-dd') which reads the
    // BROWSER's local TZ — transactions near midnight Jakarta got grouped
    // under the wrong date. Now use jakartaDateKey() for the date key and
    // Intl.DateTimeFormat with timeZone: 'Asia/Jakarta' for labels.
    // Hoisting avoids creating a new formatter per transaction (expensive).
    const dateLabelFmt = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'long',
    });
    const dayNameFmt = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
    });
    let currentGroup: typeof groups[0] | null = null;
    for (const tx of sorted) {
      const d = new Date(tx.date);
      const dateKey = jakartaDateKey(d);
      if (!currentGroup || currentGroup.dateKey !== dateKey) {
        currentGroup = {
          dateKey,
          dateLabel: dateLabelFmt.format(d),
          dayName: dayNameFmt.format(d),
          txs: [], totalIncome: 0, totalExpense: 0, net: 0,
        };
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
    <div className="space-y-3">
      {/* ANIM-2 / Feature 3: Floating 💰 particles overlay — fires when an
          income transaction is added. Fixed-positioned (covers viewport),
          pointer-events-none, aria-hidden. Auto-cleans after 2.6s. */}
      <MoneyParticles triggerKey={mutations.moneyParticlesKey} />

      {/* Header — compact on mobile: month picker + action buttons in 2 rows */}
      <div className="flex flex-col gap-2">
        {/* Row 1: Month navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={goToPrevMonth}><CalendarDays className="h-4 w-4" /></Button>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full sm:w-[170px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-64">
              {monthOptions.map((opt) => (<SelectItem key={opt.value} value={opt.value}><span className="capitalize">{opt.label}</span></SelectItem>))}
            </SelectContent>
          </Select>
          {/* FIN-BUG-4 fix: use jakartaMonthString() instead of browser-local
              format(new Date(), 'yyyy-MM') — consistent with selectedMonth's
              initial value (from app-store.ts) and avoids TZ-boundary off-by-
              one-month bugs for users behind Jakarta TZ. */}
          {selectedMonth !== jakartaMonthString() && (
            <Button variant="ghost" size="sm" className="text-xs h-7 shrink-0" onClick={goToThisMonth}>Hari ini</Button>
          )}
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={goToNextMonth}><CalendarDays className="h-4 w-4 rotate-180" /></Button>
        </div>
        {/* Row 2: Quick actions — horizontal scroll on mobile, wrap on desktop */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 sm:overflow-visible sm:pb-0 sm:flex-wrap">
          <Button size="sm" className="shrink-0 bg-destructive hover:bg-destructive text-white anim-press anim-pulse-ring" onClick={() => mutations.openNewTx('expense')}><ArrowDownRight className="h-4 w-4" />Pengeluaran</Button>
          <Button size="sm" className="shrink-0 anim-press" onClick={() => mutations.openNewTx('income')}><ArrowUpRight className="h-4 w-4" />Pemasukan</Button>
          <Button size="sm" variant="outline" className="shrink-0 anim-press" onClick={() => mutations.setCatDialogOpen(true)}><Settings2 className="h-4 w-4" />Kategori</Button>
          <Button size="sm" variant="outline" className="shrink-0 anim-press" onClick={() => mutations.setSourceDialogOpen(true)}><Wallet className="h-4 w-4" />Sumber Dana</Button>
        </div>
      </div>

      {/* Sub Tabs — icon-only on mobile, icon+label on desktop */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="flex w-full overflow-x-auto scrollbar-hide">
          <TabsTrigger value="overview" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1"><BarChart3 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Ringkasan</span></TabsTrigger>
          <TabsTrigger value="transactions" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1"><Wallet className="h-3.5 w-3.5" /><span className="hidden sm:inline">Transaksi</span></TabsTrigger>
          <TabsTrigger value="budgets" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1"><Target className="h-3.5 w-3.5" /><span className="hidden sm:inline">Budget</span></TabsTrigger>
          <TabsTrigger value="explorer" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1"><Compass className="h-3.5 w-3.5" /><span className="hidden sm:inline">Explorer</span></TabsTrigger>
          <TabsTrigger value="categories" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1"><PieChart className="h-3.5 w-3.5" /><span className="hidden sm:inline">Kategori</span></TabsTrigger>
          <TabsTrigger value="recurring" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1"><Repeat className="h-3.5 w-3.5" /><span className="hidden sm:inline">Ricurring</span></TabsTrigger>
          <TabsTrigger value="rules" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1"><Wand2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Aturan</span></TabsTrigger>
          <TabsTrigger value="savings" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1"><PiggyBank className="h-3.5 w-3.5" /><span className="hidden sm:inline">Tabungan</span></TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 anim-tab-fade-up">
          {dashboardData ? (
            <FinanceOverview
              dashboardData={dashboardData}
              lastDoneData={lastDoneData}
              getCategoryMeta={getCategoryMeta}
            />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="mt-4 anim-tab-fade-up">
          <FinanceTransactions
            filteredTransactions={filteredTransactions}
            groupedTransactions={groupedTransactions}
            selectedTxIds={mutations.selectedTxIds}
            txFilter={txFilter}
            getCategoryList={getCategoryList}
            getActiveSources={getActiveSources}
            getCategoryMeta={getCategoryMeta}
            getSourceEmoji={getSourceEmoji}
            onFilterChange={setTxFilter}
            onToggleSelectTx={mutations.toggleSelectTx}
            onToggleSelectAll={() => mutations.toggleSelectAll(filteredTransactions.map(t => t.id))}
            onEditTx={mutations.openEditTx}
            onDeleteTx={(id) => { mutations.setDeletingId(id); mutations.setDeleteDialogOpen(true); }}
            onBulkDelete={() => mutations.setBulkDeleteOpen(true)}
            selectedMonth={selectedMonth}
            onGoToPrevMonth={goToPrevMonth}
          />
        </TabsContent>

        <TabsContent value="budgets" className="mt-4 anim-tab-fade-up">
          <FinanceBudgets
            budgets={budgets}
            dashboardData={dashboardData ?? null}
            selectedMonth={selectedMonth}
            getCategoryMeta={getCategoryMeta}
            onAddBudget={() => { mutations.setBudgetForm({ category: '', amount: '', period: 'monthly' }); mutations.setBudgetDialogOpen(true); }}
            onEditBudget={mutations.openEditBudget}
            onDeleteBudget={mutations.handleDeleteBudget}
          />
        </TabsContent>

        <TabsContent value="explorer" className="mt-4 anim-tab-fade-up">
          <FinanceExplorer getCategoryMeta={getCategoryMeta} />
        </TabsContent>

        <TabsContent value="categories" className="mt-4 anim-tab-fade-up">
          <CategoryExplorer getCategoryMeta={getCategoryMeta} />
        </TabsContent>

        <TabsContent value="recurring" className="mt-4 anim-tab-fade-up">
          <FinanceRecurring
            getCategoryList={getCategoryList}
            getActiveSources={getActiveSources}
            getCategoryMeta={getCategoryMeta}
          />
        </TabsContent>

        <TabsContent value="rules" className="mt-4 anim-tab-fade-up">
          <FinanceRules
            getCategoryList={getCategoryList}
            getActiveSources={getActiveSources}
          />
        </TabsContent>

        <TabsContent value="savings" className="mt-4 anim-tab-fade-up">
          <FinanceSavingsGoals />
        </TabsContent>
      </Tabs>

      {/* ─── ADD/EDIT TRANSACTION DIALOG ─── */}
      <FinanceTxDialog
        open={mutations.txDialogOpen}
        onOpenChange={mutations.setTxDialogOpen}
        editingTx={mutations.editingTx}
        txForm={mutations.txForm}
        setTxForm={mutations.setTxForm}
        splitMode={mutations.splitMode}
        setSplitMode={mutations.setSplitMode}
        splitRows={mutations.splitRows}
        setSplitRows={mutations.setSplitRows}
        splitTotal={mutations.splitTotal}
        addSplitRow={mutations.addSplitRow}
        updateSplitRow={mutations.updateSplitRow}
        removeSplitRow={mutations.removeSplitRow}
        calcOpen={mutations.calcOpen}
        setCalcOpen={mutations.setCalcOpen}
        submitting={mutations.submitting}
        onSubmit={mutations.handleSubmitTx}
        getCategoryList={getCategoryList}
        getActiveSources={getActiveSources}
      />

      {/* ─── ADD + EDIT BUDGET DIALOGS ─── */}
      <FinanceBudgetDialogs
        addOpen={mutations.budgetDialogOpen}
        onAddOpenChange={mutations.setBudgetDialogOpen}
        editOpen={mutations.budgetEditOpen}
        onEditOpenChange={mutations.setBudgetEditOpen}
        budgetForm={mutations.budgetForm}
        setBudgetForm={mutations.setBudgetForm}
        submitting={mutations.submitting}
        onSubmitAdd={mutations.handleSubmitBudget}
        onSubmitEdit={mutations.handleSubmitEditBudget}
        getCategoryList={getCategoryList}
      />

      {/* ─── DELETE + BULK DELETE CONFIRMATIONS ─── */}
      <FinanceDeleteDialogs
        deleteOpen={mutations.deleteDialogOpen}
        onDeleteOpenChange={mutations.setDeleteDialogOpen}
        onDelete={mutations.handleDeleteTx}
        bulkDeleteOpen={mutations.bulkDeleteOpen}
        onBulkDeleteOpenChange={mutations.setBulkDeleteOpen}
        onBulkDelete={mutations.handleBulkDelete}
        selectedCount={mutations.selectedTxIds.size}
      />

      {/* ─── CATEGORY MANAGEMENT + FORM DIALOGS ─── */}
      <FinanceCategoryDialogs
        mgmtOpen={mutations.catDialogOpen}
        onMgmtOpenChange={mutations.setCatDialogOpen}
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
        onAddNew={mutations.openNewCat}
        onEdit={mutations.openEditCat}
        onDelete={mutations.handleDeleteCat}
        formOpen={mutations.catFormOpen}
        onFormOpenChange={mutations.setCatFormOpen}
        editingCat={mutations.editingCat}
        catForm={mutations.catForm}
        setCatForm={mutations.setCatForm}
        allCategories={categories}
        submitting={mutations.submitting}
        onSubmit={mutations.handleSubmitCat}
      />

      {/* ─── SOURCE MANAGEMENT + FORM + DELETE DIALOGS ─── */}
      <FinanceSourceDialogs
        mgmtOpen={mutations.sourceDialogOpen}
        onMgmtOpenChange={mutations.setSourceDialogOpen}
        sources={sources}
        getActiveSources={getActiveSources}
        onAddNew={mutations.openNewSource}
        onEdit={mutations.openEditSource}
        balanceEditId={mutations.balanceEditId}
        setBalanceEditId={mutations.setBalanceEditId}
        balanceEditValue={mutations.balanceEditValue}
        setBalanceEditValue={mutations.setBalanceEditValue}
        onSaveBalance={mutations.handleSaveBalance}
        onRequestDelete={(src) => mutations.setDeletingSource(src)}
        formOpen={mutations.sourceFormOpen}
        onFormOpenChange={mutations.setSourceFormOpen}
        editingSource={mutations.editingSource}
        sourceForm={mutations.sourceForm}
        setSourceForm={mutations.setSourceForm}
        submitting={mutations.submitting}
        onSubmit={mutations.handleSubmitSource}
        deletingSource={mutations.deletingSource}
        onCancelDelete={() => mutations.setDeletingSource(null)}
        onConfirmDelete={() => { if (mutations.deletingSource) { mutations.handleDeleteSource(mutations.deletingSource); mutations.setDeletingSource(null); } }}
      />
    </div>
  );
}
