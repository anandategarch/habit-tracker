'use client';

// ── useTransactionsQuery ───────────────────────────────────────────────────
// Extracted from finance.tsx (Task 71-d — split god files).
//
// Owns the transactions data pipeline for the Finance tab:
//   useDeferredValue(search) → useQuery(['finance','transactions',…])
//   → client-side filteredTransactions → groupedTransactions (per-hari).
// Query keys, payloads, placeholderData (keepPreviousData), enabled gates
// and staleTime are copied VERBATIM from finance.tsx — do not "simplify"
// the queryKey (BUGHUNT-54 3-a #7: filter ikut key untuk cache
// per-konteks, meski payload tidak dikirim ke server).

import { useMemo, useDeferredValue } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { dateFromYMD } from '@/lib/timezone';
// TASK 59-b3 #1: parseTags — parser tag yang benar (storage = string
// dipisah koma). Dipakai filter pencarian transaksi di bawah.
import { parseTags } from '@/lib/money';
import type { FinanceSubTab } from '@/store/app-store';
import type { Transaction, FundSource } from './finance-types';
import type { TxFilterState } from './use-transactions-focus';

export interface GroupedTransaction {
  dateKey: string;
  dateLabel: string;
  dayName: string;
  txs: Transaction[];
  totalIncome: number;
  totalExpense: number;
  net: number;
}

export interface UseTransactionsQueryParams {
  activeSubTab: FinanceSubTab;
  selectedMonth: string;
  txFilter: TxFilterState;
  /** CONNECTED-APP — filter tanggal drill-down aktif (dari useTransactionsFocus). */
  txFocusDate: string | null;
  sources: FundSource[];
}

export function useTransactionsQuery({
  activeSubTab,
  selectedMonth,
  txFilter,
  txFocusDate,
  sources,
}: UseTransactionsQueryParams) {
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
  // `filteredTransactions` filter below still uses the immediate
  // `txFilter.search`, so the displayed list updates instantly; only
  // the API refetch is debounced.
  const debouncedSearch = useDeferredValue(txFilter.search);

  // SHADCN-PHASE-3 + M1: parameter `source` API berupa SOURCE-ID — chip
  // filter memakai nama, jadi resolve nama → id dari daftar sumber aktif
  // (hasil resolve ikut queryKey supaya refetch saat daftar sumber
  // selesai dimuat).
  const sourceFilterId = useMemo(
    () => (txFilter.source === 'all' ? '' : (sources.find((s) => s.name === txFilter.source)?.id ?? '')),
    [txFilter.source, sources]
  );

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['finance', 'transactions', selectedMonth, { ...txFilter, search: debouncedSearch }, sourceFilterId],
    // TASK 59-b3 #2: keepPreviousData — tiap ganti chip filter / bulan
    // membuat queryKey baru; tanpa placeholder, data = [] selama fetch
    // berjalan → UI flash "Belum ada transaksi" (empty state penuh + CTA
    // bulan lalu) untuk round-trip jaringan yang redundan. Data lama tetap
    // tampil sampai data baru tiba.
    placeholderData: keepPreviousData,
    queryFn: async () => {
      // FEAT-SEARCH-ALLTIME: When user types a search query, skip the month
      // param so the search spans ALL periods. This lets users find a
      // transaction from any month without navigating to that month first.
      // When search is empty, fall back to month-scoped view (normal mode).
      //
      // BUGHUNT-54 (3-a #7): filter type/category/source TIDAK lagi dikirim ke
      // server — lapisan filter client (filteredTransactions di bawah) sudah
      // menyaring hal yang sama, sehingga hasil fetch = transaksi bulan mentah
      // (pra-filter) dan bisa dipakai footer "Total Pengeluaran Hari Ini" +
      // badge truncation pencarian. queryKey tetap memuat txFilter supaya
      // cache per-konteks filter tidak tertukar.
      const params = new URLSearchParams();
      const isSearching = debouncedSearch.trim().length > 0;
      if (!isSearching) {
        params.set('month', selectedMonth);
      }
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
      // TASK 59-b3 #1: tags disimpan API sebagai STRING DIPISAH KOMA
      // (schema: "dipisah koma"; route recurring menulis 'berulang') — bukan
      // JSON array. Dulu `JSON.parse(tagsStr)` throw pada string biasa →
      // tagsArr = [] → baris yang HANYA match tag disembunyikan oleh filter
      // instan dan tetap hilang setelah refetch (server mengirimnya!)
      // meski server-side match benar. parseTags menangani string koma,
      // array, null, dan string kosong.
      const tagsArr = parseTags(tx.tags);
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
    const groups: GroupedTransaction[] = [];
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
    let currentGroup: GroupedTransaction | null = null;
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

  return { transactions, filteredTransactions, groupedTransactions };
}
