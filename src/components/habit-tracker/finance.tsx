'use client';

import { useState, useCallback, useMemo, useEffect, useRef, useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { PageHeader } from '@/components/ui/page-header';
import {
 ArrowUpRight,
 ArrowDownRight,
 Target,
 Wallet,
 Settings2,
 CalendarDays,
 Compass,
 BarChart3,
 PiggyBank,
 Repeat,
 Wand2,
} from 'lucide-react';
import { format, id as idLocale } from '@/lib/date-utils';
// PERF-FIX (FIX-TIER3 / Fix 15): replaced `date-fns` with native Intl-based
// utility module. Output is identical for the patterns used here
// ('yyyy-MM', 'MMMM yyyy' with id locale) — verified via test script in
// worklog FIX-TIER3 entry.
import { jakartaMonthString, dateFromYMD } from '@/lib/timezone';
import { useAppStore, type FinanceFocus, type FinanceSubTab } from '@/store/app-store';
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

 // Filter states (declared early because useQuery depends on txFilter)
 const [txFilter, setTxFilter] = useState<{ type: string; category: string; source: string; search: string }>({ type: 'all', category: 'all', source: 'all', search: '' });
 // CONNECTED-APP: filter tanggal dari drill-down (heatmap hari tertentu /
 // "pengeluaran hari ini") — client-side, ditampilkan sebagai chip yang bisa
 // dilepas di sub-tab Transaksi.
 const [txFocusDate, setTxFocusDate] = useState<string | null>(null);

 // ONE-CLICK-4: consume the global finance focus (set by openFinanceFocus
 // anywhere in the app — dashboard cards, budget cards, daily recap…).
 // Applies the requested transactions filter, then clears the ephemeral
 // focus (same consume-and-clear pattern as quickAddAction). Category is
 // a NAME string, matching txFilter.category semantics.
 const financeFocus = useAppStore(s => s.financeFocus);
 const clearFinanceFocus = useAppStore(s => s.clearFinanceFocus);
 // Latest-ref untuk sources — diisi oleh effect SETELAH query sumber dinyatakan
 // (deklarasi di bawah; hoisting tidak berlaku untuk const). applyFinanceFocus
 // harus identitasnya stabil (pola latest-ref), jadi resolve sourceId lewat ref.
 const sourcesRef = useRef<FundSource[]>([]);
 const applyFinanceFocus = useCallback((focus: FinanceFocus) => {
   setTxFilter(prev => ({
     ...prev,
     // CONNECTED-APP: drill-down kini membawa type + sumber + tanggal:
     //  * txType ('expense' untuk "pengeluaran hari ini", dst.)
     //  * sourceId → resolve nama (semantik txFilter.source)
     //  * date → filter tanggal harian (chip di sub-tab Transaksi)
     type: focus.txType ?? 'all',
     source: focus.sourceId
       ? (sourcesRef.current.find(s => s.id === focus.sourceId)?.name ?? 'all')
       : 'all',
     search: '',
     category: focus.category ?? 'all',
   }));
   setTxFocusDate(focus.date ?? null);
   if (focus.date) {
     // Sinkronkan bulan supaya transaksi tanggal itu benar-benar termuat
     // (daftar transaksi dibatasi selectedMonth).
     const m = focus.date.slice(0, 7);
     if (m !== useAppStore.getState().selectedMonth) setSelectedMonth(m);
   }
 }, []);
 // Stable latest-ref: applyFinanceFocus has empty deps (never changes
 // identity), so the ref is initialized once and never reassigned.
 const applyFocusRef = useRef(applyFinanceFocus);

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
 // Sinkronkan latest-ref sumber untuk applyFinanceFocus (deklarasi ref ada
 // di atas; assignment di sini — setelah `sources` benar-benar dideklarasikan).
 useEffect(() => { sourcesRef.current = sources; }, [sources]);

 // Konsumsi fokus global (dipindah ke sini supaya sourcesLoading sudah
 // terdeklarasi — VERIFY-48 48-b latent): focus bersourceId butuh data
 // sources untuk resolve nama (sourcesRef kosong saat mount dingin →
 // filter sumber diam-diam jatuh). Tunda konsumsi sampai query selesai —
 // pola yang sama dengan konsumsi quick-add 'transfer' di SourceBalance.
 useEffect(() => {
   if (financeFocus) {
     if (financeFocus.sourceId && sourcesLoading) return;
     applyFocusRef.current(financeFocus);
     clearFinanceFocus();
   }
 }, [financeFocus, clearFinanceFocus, sourcesLoading]);

 // ── Mutations hook (SPLIT-PHASE2-UI) ──
 // All dialog/form state + CRUD handlers live in this hook.
 const mutations = useFinanceMutations({ getActiveSources });

 // BUGFIX POST-1 #4: Reset selectedTxIds saat ganti bulan supaya stale tx IDs
 // dari bulan sebelumnya tidak persist di multi-select UI.
 // BUGFIX INFINITE-LOOP: Jangan include `mutations` di dependency array —
 // mutations adalah object baru setiap render (dari hook), jadi useEffect
 // terus fire → setSelectedTxIds → re-render → mutations baru → infinite loop
 // (React error #185). setSelectedTxIds adalah stable reference (useState setter),
 // jadi aman untuk exclude dari deps.
 const { setSelectedTxIds } = mutations;
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

 // SHADCN-PHASE-3 (lihat komentar atas) + M1: parameter `source` API berupa
 // SOURCE-ID — chip filter memakai nama, jadi resolve nama → id dari daftar
 // sumber aktif (hasil resolve ikut queryKey supaya refetch saat daftar
 // sumber selesai dimuat).
 const sourceFilterId = useMemo(
   () => (txFilter.source === 'all' ? '' : (sources.find((s) => s.name === txFilter.source)?.id ?? '')),
   [txFilter.source, sources]
 );

 const { data: transactions = [] } = useQuery<Transaction[]>({
   queryKey: ['finance', 'transactions', selectedMonth, { ...txFilter, search: debouncedSearch }, sourceFilterId],
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
     if (sourceFilterId) params.set('source', sourceFilterId);
     if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
     const res = await fetch(`/api/finance/transactions?${params}`);
     if (!res.ok) return [];
     const json = (await res.json()) as { transactions?: Transaction[] };
     return json.transactions ?? [];
   },
   // SHADCN-PHASE-3: also fetch on the overview tab so the SpendingHeatmap
   // has per-day expense data + counts. The queryKey still includes txFilter
   // + debouncedSearch, but those are at default ('all' / '') when the user
   // hasn't visited the transactions tab, so we get the full month's data.
   // Cache is shared — switching to the transactions tab reuses this data
   // if the filter is unchanged.
   enabled: activeSubTab === 'transactions' || activeSubTab === 'overview',
   staleTime: 15_000,
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

 // ── Render Helpers ────────────────────────────────────────────────────────

 const filteredTransactions = useMemo(() => transactions.filter(tx => {
   // CONNECTED-APP: filter tanggal drill-down (H3: YMD = komponen UTC ISO).
   if (txFocusDate && tx.date.slice(0, 10) !== txFocusDate) return false;
   if (txFilter.type !== 'all' && tx.type !== txFilter.type) return false;
   if (txFilter.category !== 'all' && tx.category !== txFilter.category) return false;
   // M1: API mengirim sourceName (tx.source selalu undefined) — filter
   // sumber dicocokkan dengan sourceName.
   if (txFilter.source !== 'all' && (tx.sourceName ?? tx.source) !== txFilter.source) return false;
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
       ((tx.sourceName ?? tx.source) ?? '').toLowerCase().includes(term) ||
       tx.notes?.toLowerCase().includes(term) ||
       tagsArr.some((t) => t.toLowerCase().includes(term));
     if (!matches) return false;
   }
   return true;
 }), [transactions, txFilter, txFocusDate]);

 const groupedTransactions = useMemo(() => {
   const sorted = [...filteredTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
   const groups: { dateKey: string; dateLabel: string; dayName: string; txs: Transaction[]; totalIncome: number; totalExpense: number; net: number }[] = [];
   // H3: kunci harian dibaca dari KOMPONEN UTC ISO (tx.date.slice(0,10)) —
   // konvensi storage Transaction.date = jam dinding Jakarta sebagai komponen
   // UTC. jakartaDateKey + Intl timeZone 'Asia/Jakarta' lama menggeser +7
   // sehingga transaksi ≥17:00 (mis. 19:58) bergeser ke tanggal berikutnya.
   // Label diformat dari dateFromYMD(dateKey) (UTC midnight) dengan
   // formatter timeZone 'UTC' — komponen label = komponen YMD.
   // Formatter di-hoist keluar loop (mahal dikonstruksi per tx).
   const dateLabelFmt = new Intl.DateTimeFormat('id-ID', {
     timeZone: 'UTC',
     day: 'numeric',
     month: 'long',
   });
   const dayNameFmt = new Intl.DateTimeFormat('id-ID', {
     timeZone: 'UTC',
     weekday: 'long',
   });
   let currentGroup: typeof groups[0] | null = null;
   for (const tx of sorted) {
     const dateKey = tx.date.slice(0, 10);
     if (!currentGroup || currentGroup.dateKey !== dateKey) {
       const d = dateFromYMD(dateKey);
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
     else if (tx.type === 'expense') { currentGroup.totalExpense += tx.amount; currentGroup.net -= tx.amount; }
     // M4: kaki transfer TIDAK dihitung di total harian — satu transfer
     // = 2 baris (keluar+masuk); menghitungnya sebagai pengeluaran membuat
     // grup harian menghitung 2× lipat.
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

     {/* Sub Tabs — icon-only on mobile, icon+label on desktop */}
     {/* LOW-i: saat keluar dari sub-tab Transaksi, filter transaksi direset
         ke default — filter lama (kategori/sumber/tipe/search) tidak bocor ke
         kunjungan berikutnya (deep-link openFinanceFocus tetap bekerja: fokus
         diterapkan efek setelah pindah tab, dan reset hanya untuk v ≠
         'transactions'). */}
     <Tabs value={activeSubTab} onValueChange={(v) => {
       setActiveSubTab(v as FinanceSubTab);
       if (v !== 'transactions') {
         setTxFilter({ type: 'all', category: 'all', source: 'all', search: '' });
         setTxFocusDate(null); // CONNECTED-APP: chip tanggal ikut bersih
       }
     }}>
       <TabsList className="flex w-full gap-0.5 overflow-x-auto scrollbar-hide rounded-xl bg-muted/60 p-1 h-auto">
         <TabsTrigger value="overview" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1 rounded-lg py-1.5 px-3 data-[state=active]:shadow-md"><BarChart3 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Ringkasan</span></TabsTrigger>
         <TabsTrigger value="transactions" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1 rounded-lg py-1.5 px-3 data-[state=active]:shadow-md"><Wallet className="h-3.5 w-3.5" /><span className="hidden sm:inline">Transaksi</span></TabsTrigger>
         <TabsTrigger value="budgets" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1 rounded-lg py-1.5 px-3 data-[state=active]:shadow-md"><Target className="h-3.5 w-3.5" /><span className="hidden sm:inline">Budget</span></TabsTrigger>
         <TabsTrigger value="analysis" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1 rounded-lg py-1.5 px-3 data-[state=active]:shadow-md"><Compass className="h-3.5 w-3.5" /><span className="hidden sm:inline">Analisis</span></TabsTrigger>
         <TabsTrigger value="recurring" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1 rounded-lg py-1.5 px-3 data-[state=active]:shadow-md"><Repeat className="h-3.5 w-3.5" /><span className="hidden sm:inline">Recurring</span></TabsTrigger>
         <TabsTrigger value="rules" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1 rounded-lg py-1.5 px-3 data-[state=active]:shadow-md"><Wand2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Aturan</span></TabsTrigger>
         <TabsTrigger value="savings" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1 rounded-lg py-1.5 px-3 data-[state=active]:shadow-md"><PiggyBank className="h-3.5 w-3.5" /><span className="hidden sm:inline">Tabungan</span></TabsTrigger>
       </TabsList>

       <TabsContent value="overview" className="mt-4 anim-tab-fade-up">
         {dashboardData ? (
           <FinanceOverview
             dashboardData={dashboardData}
             lastDoneData={lastDoneData}
             getCategoryMeta={getCategoryMeta}
             transactions={transactions}
             selectedMonth={selectedMonth}
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
           focusDate={txFocusDate}
           onClearFocusDate={() => setTxFocusDate(null)}
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

       <TabsContent value="analysis" className="mt-4 anim-tab-fade-up">
         {/* Task 4-b A.5 (warisan Eksplorasi): drill-down bukan jalan buntu —
             baris transaksi di detail kategori membuka dialog edit yang
             ter-mount di root finance.tsx. */}
         <FinanceAnalysis getCategoryMeta={getCategoryMeta} onEditTx={mutations.openEditTx} />
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

