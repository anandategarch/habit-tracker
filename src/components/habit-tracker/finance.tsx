'use client';

// ── Finance (tab "Keuangan") ────────────────────────────────────────────────
// Task 71-d (split god files): file ini kini komposisi tipis —
//  * sub-tab navigation        → finance-subtab-nav.tsx
//  * sub-screen routing + dynamic imports + query sub-screen
//    (dashboard/budgets/last-done) → finance-tab-router.tsx
//  * fokus drill-down global (FinanceFocus) + state txFilter
//    → use-transactions-focus.ts
//  * query transaksi + filter/grouping → use-transactions-query.ts
//  * search/chip filter sub-tab Transaksi → transactions-filter-bar.tsx
//    (dari finance-transactions.tsx), baris transaksi → transaction-row.tsx
// Yang tetap di sini: header (navigasi bulan + aksi cepat), data bersama
// (sources + categories) + helper kategori/sumber, MoneyParticles, dan
// komposisi semua dialog (tx/budget/delete/category/source).

import { useCallback, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Settings2,
  CalendarDays,
} from 'lucide-react';
import { format, id as idLocale } from '@/lib/date-utils';
// PERF-FIX (FIX-TIER3 / Fix 15): replaced `date-fns` with native Intl-based
// utility module. Output is identical for the patterns used here
// ('yyyy-MM', 'MMMM yyyy' with id locale) — verified via test script in
// worklog FIX-TIER3 entry.
import { jakartaMonthString } from '@/lib/timezone';
import { useAppStore, type FinanceSubTab } from '@/store/app-store';
import { MoneyParticles } from './money-particles';
import { useFinanceMutations } from '@/hooks/use-finance-mutations';
// Split-out dialog components (SPLIT-PHASE2-UI):
import { FinanceTxDialog } from './finance-tx-dialog';
import { FinanceBudgetDialogs } from './finance-budget-dialogs';
import { FinanceDeleteDialogs } from './finance-delete-dialogs';
import { FinanceCategoryDialogs } from './finance-category-dialogs';
import { FinanceSourceDialogs } from './finance-source-dialogs';
// Split-out sub-tab pieces (Task 71-d):
import { FinanceSubTabNav } from './finance-subtab-nav';
import { FinanceTabRouter } from './finance-tab-router';
import { useTransactionsFocus, defaultTxFilter } from './use-transactions-focus';
import { useTransactionsQuery } from './use-transactions-query';

// Types & shared imports
import type {
  FinanceCategory,
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
  // LOW-h: efek auto-migrate emoji (POST /api/finance/categories/migrate-emojis
  // + flag localStorage emoji_migrated) dihapus — endpoint itu tidak pernah
  // ada (405 via fallback [id] route) sehingga efek hanya menyetel flag
  // lokal tanpa efek samping nyata. useQueryClient ikut tidak terpakai.
  // ONE-CLICK-3: activeSubTab lifted from local useState to the global
  // store — previously it reset to 'overview' every time the user left the
  // Finance tab (page.tsx only mounts the active tab). Now it survives tab
  // switches AND any component can deep-link to a sub-tab in one call via
  // openFinanceSubTab / openFinanceFocus (e.g. dashboard budget-status card
  // → Budgets sub-tab; budget category card → Transactions filtered).
  const activeSubTab = useAppStore(s => s.financeSubTab);
  const setActiveSubTab = useAppStore(s => s.setFinanceSubTab);

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
      const json = (await res.json()) as { sources?: FundSource[] };
      return json.sources ?? [];
    },
    staleTime: 30_000,
  });

  // BUG-FIN-1 (Task 30): fallback FALLBACK_SOURCES (id: '') DIHAPUS — opsi
  // "palsu" ini membuat dialog transaksi menawarkan sumber yang pasti ditolak
  // API (400 "Sumber dana tidak ditemukan") saat DB belum punya sumber.
  // Instalasi baru kini di-seed sumber default oleh GET /api/finance/sources,
  // dan kondisi "tanpa sumber" jujur menampilkan daftar kosong (transaksi
  // tetap bisa disimpan tanpa sumber; sumber bisa ditambah di Sumber Dana).
  const getActiveSources = useCallback(() => sources, [sources]);

  // ── Mutations hook (SPLIT-PHASE2-UI) ──
  // All dialog/form state + CRUD handlers live in this hook.
  const mutations = useFinanceMutations({ getActiveSources });
  const { setSelectedTxIds } = mutations;

  // Filter state sub-tab Transaksi + konsumsi fokus drill-down global
  // (FinanceFocus) — useTransactionsFocus (Task 71-d).
  const {
    txFilter, setTxFilter, txFocusDate, setTxFocusDate,
  } = useTransactionsFocus({ sources, sourcesLoading });

  // BUGFIX POST-1 #4: Reset selectedTxIds saat ganti bulan supaya stale tx IDs
  // dari bulan sebelumnya tidak persist di multi-select UI.
  // BUGFIX INFINITE-LOOP: Jangan include `mutations` di dependency array —
  // mutations adalah object baru setiap render (dari hook), jadi useEffect
  // terus fire → setSelectedTxIds → re-render → mutations baru → infinite loop
  // (React error #185). setSelectedTxIds adalah stable reference (useState setter),
  // jadi aman untuk exclude dari deps.
  // BUGHUNT-47 (47-d #7): chip tanggal drill-down (mis. "8 Sep ×") di-reset
  // saat bulan berganti — dulu filter tanggal bulan lama menyaring bulan baru
  // → daftar transaksi bulan baru tampak KOSONG padahal ada datanya.
  // Chip tanggal milik bulannya sendiri TIDAK direset (drill-down heatmap
  // mengatur tanggal + bulan sekaligus — keduanya harus selaras).
  useEffect(() => {
    if (txFocusDate && txFocusDate.slice(0, 7) !== selectedMonth) {
      setTxFocusDate(null);
    }
    setSelectedTxIds(new Set());
  }, [selectedMonth, setSelectedTxIds, txFocusDate]);

  // BUGHUNT-54 (3-a #3): bulk-select juga direset saat FILTER berubah
  // (kategori/tipe/sumber/pencarian via txFilter) atau tanggal fokus —
  // seleksi lama bisa menunjuk transaksi yang sudah disembunyikan filter;
  // "Hapus" massal tidak boleh menghapus transaksi tak terlihat (stale ids).
  useEffect(() => {
    setSelectedTxIds(new Set());
  }, [txFilter, txFocusDate, setSelectedTxIds]);

  // Pipeline data transaksi (query + filter client + grouping per-hari) —
  // useTransactionsQuery (Task 71-d). Query key & payload persis seperti
  // sebelum pemisahan (month + txFilter + sourceFilterId, keepPreviousData).
  const { transactions, filteredTransactions, groupedTransactions } = useTransactionsQuery({
    activeSubTab,
    selectedMonth,
    txFilter,
    txFocusDate,
    sources,
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<FinanceCategory[]>({
    queryKey: ['finance', 'categories'],
    queryFn: async () => {
      const res = await fetch('/api/finance/categories');
      if (!res.ok) return [];
      const json = (await res.json()) as { categories?: FinanceCategory[] };
      return json.categories ?? [];
    },
    staleTime: 60_000, // categories rarely change
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

  // Task 31 (bug bulan UTC): panah bulan dulu membangun tanggal LOKAL lalu
  // dibaca komponen UTC oleh format() — bagi pengguna UTC+ (Jakarta +7)
  // tgl-1 lokal = akhir bulan lalu di UTC: "berikutnya" tidak berpindah
  // sama sekali dan "sebelumnya" melompat 2 bulan. Bangun Date.UTC.
  const goToPrevMonth = () => { const [y, m] = selectedMonth.split('-').map(Number); setSelectedMonth(format(new Date(Date.UTC(y, m - 2, 1)), 'yyyy-MM')); };
  const goToNextMonth = () => { const [y, m] = selectedMonth.split('-').map(Number); setSelectedMonth(format(new Date(Date.UTC(y, m, 1)), 'yyyy-MM')); };
  const goToThisMonth = () => { setSelectedMonth(jakartaMonthString()); };

  const monthOptions = useMemo(() => {
    // Task 31: pusatkan daftar pada bulan berjalan JAKARTA (konsisten dengan
    // default store) dan bangun via Date.UTC — format() membaca komponen UTC;
    // build lokal membuat label/value bergeser −1 bulan bagi pengguna UTC+.
    const [ny, nm] = jakartaMonthString().split('-').map(Number);
    const opts: { value: string; label: string }[] = [];
    for (let i = -24; i <= 24; i++) {
      const d = new Date(Date.UTC(ny, nm - 1 + i, 1));
      opts.push({ value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy', { locale: idLocale }) });
    }
    return opts;
  }, []);

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

      {/* Task 41: header sektor seragam (eyebrow + ikon + subteks) — dulu
          finance langsung loncat ke month picker tanpa identitas sektor. */}
      <PageHeader
        title="Keuangan"
        subtitle="Catat arus kas dan pantau kesehatan finansialmu"
        icon={Wallet}
        eyebrow="Sektor"
      />

      {/* Header — compact on mobile: month picker + action buttons in 2 rows */}
      <div className="flex flex-col gap-2">
        {/* Row 1: Month navigation */}
        {/* LOW-c: tombol prev/next bulan diberi aria-label + ukuran ≥40px
            (target sentuh minimum a11y). */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={goToPrevMonth} aria-label="Bulan sebelumnya"><CalendarDays className="h-4 w-4" /></Button>
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
          {/* LOW-b: label "Hari ini" menyesatkan — aksi ini kembali ke BULAN
              berjalan, bukan hari. */}
          {selectedMonth !== jakartaMonthString() && (
            <Button variant="ghost" size="sm" className="text-xs h-7 shrink-0" onClick={goToThisMonth}>Bulan ini</Button>
          )}
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={goToNextMonth} aria-label="Bulan berikutnya"><CalendarDays className="h-4 w-4 rotate-180" /></Button>
        </div>
        {/* Row 2: Quick actions — horizontal scroll on mobile, wrap on desktop */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 sm:overflow-visible sm:pb-0 sm:flex-wrap">
          <Button size="sm" className="shrink-0 bg-destructive hover:bg-destructive text-white anim-press" onClick={() => mutations.openNewTx('expense')}><ArrowDownRight className="h-4 w-4" />Pengeluaran</Button>
          <Button size="sm" className="shrink-0 anim-press" onClick={() => mutations.openNewTx('income')}><ArrowUpRight className="h-4 w-4" />Pemasukan</Button>
          <Button size="sm" variant="outline" className="shrink-0 anim-press" onClick={() => mutations.setCatDialogOpen(true)}><Settings2 className="h-4 w-4" />Kategori</Button>
          <Button size="sm" variant="outline" className="shrink-0 anim-press" onClick={() => mutations.setSourceDialogOpen(true)}><Wallet className="h-4 w-4" />Sumber Dana</Button>
        </div>
      </div>

      {/* Sub Tabs — sub-tab nav (finance-subtab-nav.tsx) + konten per sub-tab
          (finance-tab-router.tsx, dynamic imports + query sub-screen). */}
      {/* LOW-i: saat keluar dari sub-tab Transaksi, filter transaksi direset
          ke default — filter lama (kategori/sumber/tipe/search) tidak bocor ke
          kunjungan berikutnya (deep-link openFinanceFocus tetap bekerja: fokus
          diterapkan efek setelah pindah tab, dan reset hanya untuk v ≠
          'transactions'). */}
      <Tabs value={activeSubTab} onValueChange={(v) => {
        setActiveSubTab(v as FinanceSubTab);
        if (v !== 'transactions') {
          setTxFilter(defaultTxFilter());
          setTxFocusDate(null); // CONNECTED-APP: chip tanggal ikut bersih
        }
      }}>
        <FinanceSubTabNav />
        <FinanceTabRouter
          activeSubTab={activeSubTab}
          selectedMonth={selectedMonth}
          transactions={transactions}
          filteredTransactions={filteredTransactions}
          groupedTransactions={groupedTransactions}
          txFilter={txFilter}
          onFilterChange={setTxFilter}
          focusDate={txFocusDate}
          onClearFocusDate={() => setTxFocusDate(null)}
          selectedTxIds={mutations.selectedTxIds}
          onToggleSelectTx={mutations.toggleSelectTx}
          onToggleSelectAll={() => mutations.toggleSelectAll(filteredTransactions.map(t => t.id))}
          onEditTx={mutations.openEditTx}
          onDeleteTx={(id) => { mutations.setDeletingId(id); mutations.setDeleteDialogOpen(true); }}
          onBulkDelete={() => mutations.setBulkDeleteOpen(true)}
          onGoToPrevMonth={goToPrevMonth}
          onQuickAddExpense={() => mutations.openNewTx('expense')}
          onAddBudget={() => { mutations.setBudgetForm({ category: '', amount: '', period: 'monthly' }); mutations.setBudgetDialogOpen(true); }}
          onEditBudget={mutations.openEditBudget}
          onDeleteBudget={mutations.handleDeleteBudget}
          getCategoryMeta={getCategoryMeta}
          getCategoryList={getCategoryList}
          getActiveSources={getActiveSources}
          getSourceEmoji={getSourceEmoji}
        />
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
