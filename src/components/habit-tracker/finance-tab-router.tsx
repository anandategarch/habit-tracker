'use client';

// ── FinanceTabRouter ───────────────────────────────────────────────────────
// Extracted from finance.tsx (Task 71-d — split god files).
//
// Sub-screen routing for the Finance tab: owns the dynamic() imports of all
// 7 sub-screens (+ skeleton fallbacks) and renders the <TabsContent> blocks
// inside the <Tabs> owned by finance.tsx. Also owns the sub-screen-only
// queries (dashboard / budgets / last-done) — query keys, payloads, `enabled`
// gates and staleTime copied VERBATIM from finance.tsx. This component is
// mounted unconditionally (Radix TabsContent itself only mounts the ACTIVE
// sub-screen), so query observer lifecycles are identical to before.

import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import type { FinanceSubTab } from '@/store/app-store';
import type {
  Transaction,
  BudgetItem,
  DashboardData,
  LastDoneItem,
  FundSource,
} from './finance-types';
import type { TxFilterState } from './use-transactions-focus';
import type { GroupedTransaction } from './use-transactions-query';

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

// Lazy load Analysis — MERGE Task 32 (Opsi A): sub-tab "Analisis" = gabungan
// sub-tab lama Eksplorasi + Kategori (70% kembar — pemilih bulan, daftar
// kategori, total, drill-down). Level 1 warisan Eksplorasi (4 kartu bulan +
// Auto-Suggest/Split + daftar kategori), level 2 warisan Kategori
// (CategoryDetailView — analisis per-kategori terkaya) + transplant: baris
// transaksi editable & ringkasan mingguan. Skeleton menyamai tata letak
// level-1 (baris pemilih bulan + kartu + daftar).
const FinanceAnalysis = dynamic(() => import('./finance-analysis'), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <Skeleton className="h-9 w-44 rounded-md" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <Skeleton className="h-[300px] rounded-xl" />
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

interface FinanceTabRouterProps {
  /** Sub-tab aktif (store) — gerbang `enabled` query sub-screen + sinkron
   *  dengan value <Tabs> di finance.tsx. */
  activeSubTab: FinanceSubTab;
  selectedMonth: string;
  /** Transaksi PRA-filter (bulan mentah / hasil pencarian server) dari
   *  useTransactionsQuery — dipakai sub-tab Ringkasan (heatmap). */
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  groupedTransactions: GroupedTransaction[];
  txFilter: TxFilterState;
  onFilterChange: (filter: TxFilterState) => void;
  /** CONNECTED-APP — filter tanggal drill-down aktif. */
  focusDate: string | null;
  onClearFocusDate: () => void;
  selectedTxIds: Set<string>;
  onToggleSelectTx: (id: string) => void;
  onToggleSelectAll: () => void;
  onEditTx: (tx: Transaction) => void;
  onDeleteTx: (id: string) => void;
  onBulkDelete: () => void;
  onGoToPrevMonth: () => void;
  /** Task 49 (PERDETAIL-HARIAN): CTA "Catat pengeluaran" kartu Hari Ini. */
  onQuickAddExpense: () => void;
  onAddBudget: () => void;
  onEditBudget: (b: BudgetItem) => void;
  onDeleteBudget: (id: string) => void | Promise<void>;
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
  getCategoryList: (type: string) => { value: string; emoji: string; color: string }[];
  getActiveSources: () => FundSource[];
  getSourceEmoji: (name: string) => string;
}

export function FinanceTabRouter({
  activeSubTab,
  selectedMonth,
  transactions,
  filteredTransactions,
  groupedTransactions,
  txFilter,
  onFilterChange,
  focusDate,
  onClearFocusDate,
  selectedTxIds,
  onToggleSelectTx,
  onToggleSelectAll,
  onEditTx,
  onDeleteTx,
  onBulkDelete,
  onGoToPrevMonth,
  onQuickAddExpense,
  onAddBudget,
  onEditBudget,
  onDeleteBudget,
  getCategoryMeta,
  getCategoryList,
  getActiveSources,
  getSourceEmoji,
}: FinanceTabRouterProps) {
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

  const { data: budgets = [] } = useQuery<BudgetItem[]>({
    // M5: budget mengikuti selectedMonth — tanpa ?month API selalu memakai
    // bulan berjalan sehingga sub-tab Anggaran tidak berubah saat user
    // navigasi bulan lain.
    queryKey: ['finance', 'budgets', selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/finance/budgets?month=${selectedMonth}`);
      if (!res.ok) return [];
      const json = (await res.json()) as { budgets?: BudgetItem[] };
      return json.budgets ?? [];
    },
    enabled: activeSubTab === 'budgets',
    staleTime: 30_000,
  });

  const { data: lastDoneData = [] } = useQuery<LastDoneItem[]>({
    queryKey: ['finance', 'last-done'],
    queryFn: async () => {
      const res = await fetch('/api/finance/last-done');
      if (!res.ok) return [];
      const json = (await res.json()) as { transactions?: LastDoneItem[] };
      return Array.isArray(json.transactions) ? json.transactions : [];
    },
    enabled: activeSubTab === 'overview',
    staleTime: 60_000,
  });

  return (
    <>
      <TabsContent value="overview" className="mt-4 anim-tab-fade-up">
        {dashboardData ? (
          <FinanceOverview
            dashboardData={dashboardData}
            lastDoneData={lastDoneData}
            getCategoryMeta={getCategoryMeta}
            transactions={transactions}
            selectedMonth={selectedMonth}
            // Task 49 (PERDETAIL-HARIAN): CTA "Catat pengeluaran" kartu
            // Hari Ini — dialog transaksi sama dengan tombol aksi cepat
            // header (prefill tanggal hari ini Jakarta).
            onQuickAddExpense={onQuickAddExpense}
          />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        )}
      </TabsContent>

      <TabsContent value="transactions" className="mt-4 anim-tab-fade-up">
        <FinanceTransactions
          filteredTransactions={filteredTransactions}
          groupedTransactions={groupedTransactions}
          // BUGHUNT-54 (3-a #7): transaksi PRA-filter (bulan mentah) — dasar
          // footer "Total Pengeluaran Hari Ini" + badge truncation pencarian.
          transactions={transactions}
          selectedTxIds={selectedTxIds}
          txFilter={txFilter}
          focusDate={focusDate}
          onClearFocusDate={onClearFocusDate}
          getCategoryList={getCategoryList}
          getActiveSources={getActiveSources}
          getCategoryMeta={getCategoryMeta}
          getSourceEmoji={getSourceEmoji}
          onFilterChange={onFilterChange}
          onToggleSelectTx={onToggleSelectTx}
          onToggleSelectAll={onToggleSelectAll}
          onEditTx={onEditTx}
          onDeleteTx={onDeleteTx}
          onBulkDelete={onBulkDelete}
          selectedMonth={selectedMonth}
          onGoToPrevMonth={onGoToPrevMonth}
        />
      </TabsContent>

      <TabsContent value="budgets" className="mt-4 anim-tab-fade-up">
        <FinanceBudgets
          budgets={budgets}
          dashboardData={dashboardData ?? null}
          selectedMonth={selectedMonth}
          getCategoryMeta={getCategoryMeta}
          onAddBudget={onAddBudget}
          onEditBudget={onEditBudget}
          onDeleteBudget={onDeleteBudget}
        />
      </TabsContent>

      <TabsContent value="analysis" className="mt-4 anim-tab-fade-up">
        {/* Task 4-b A.5 (warisan Eksplorasi): drill-down bukan jalan buntu —
            baris transaksi di detail kategori membuka dialog edit yang
            ter-mount di root finance.tsx. */}
        <FinanceAnalysis getCategoryMeta={getCategoryMeta} onEditTx={onEditTx} />
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
    </>
  );
}
