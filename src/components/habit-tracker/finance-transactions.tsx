'use client';

// ── FinanceTransactions ─────────────────────────────────────────────────────
// Sub-tab "Transaksi" — layar daftar transaksi Keuangan.
// Task 71-d (split god files): search bar + chip filter + panel filter
// diekstrak ke transactions-filter-bar.tsx; baris transaksi ke
// transaction-row.tsx. File ini tetap memegang mesin virtualisasi daftar
// (useVirtualizer berlabuh ke [data-slot="app-scroller"]), empty state,
// toolbar multi-select, dan footer total. Semua perilaku dipertahankan.

import { useState, useMemo, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Wallet } from 'lucide-react';
import { jakartaDateString, jakartaMonthString } from '@/lib/timezone';
import { formatRupiah, capitalize } from './finance-types';
import type { Transaction } from './finance-types';
import { useAppStore } from '@/store/app-store';
import { TransactionsFilterBar } from './transactions-filter-bar';
import { TransactionRow } from './transaction-row';
import type { TxFilterState } from './use-transactions-focus';
import type { GroupedTransaction } from './use-transactions-query';

interface FinanceTransactionsProps {
  filteredTransactions: Transaction[];
  groupedTransactions: GroupedTransaction[];
  /** BUGHUNT-54 (3-a #7): transaksi PRA-filter (bulan mentah / hasil pencarian
      server sebelum filter client) — dasar footer "Total Pengeluaran Hari
      Ini" & indikator truncation pencarian. */
  transactions: Transaction[];
  selectedTxIds: Set<string>;
  txFilter: TxFilterState;
  /** CONNECTED-APP — filter tanggal aktif dari drill-down (heatmap / hari ini). */
  focusDate?: string | null;
  /** Lepas chip filter tanggal (kembali ke seluruh bulan). */
  onClearFocusDate?: () => void;
  getCategoryList: (type: string) => { value: string; emoji: string; color: string }[];
  getActiveSources: () => { id: string; name: string; emoji: string; order: number }[];
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
  getSourceEmoji: (name: string) => string;
  onFilterChange: (filter: TxFilterState) => void;
  onToggleSelectTx: (id: string) => void;
  onToggleSelectAll: () => void;
  onEditTx: (tx: Transaction) => void;
  onDeleteTx: (id: string) => void;
  onBulkDelete: () => void;
  // FIN-BUG-7 fix: selectedMonth is needed to decide whether to render
  // the "Total Pengeluaran Hari Ini" footer block — it's only meaningful
  // when viewing the current month (filteredTransactions is scoped to
  // selectedMonth, so today's expense is 0 for any other month).
  selectedMonth: string;
  // DB-MIGRATE-1: callback to navigate to the previous month. Used by the
  // empty-state below — when the current month has no transactions (e.g.
  // user just opened the app at the start of a new month), the empty
  // state offers a one-tap shortcut to view the previous month's data
  // instead of leaving the user staring at "Belum ada transaksi" and
  // wondering whether their data was lost (which was the exact confusion
  // that triggered the DB-migration debug investigation).
  onGoToPrevMonth?: () => void;
}

// PERF-FIX (FIX-TIER3 / Fix 14): Flat row representation for the virtualized
// list. The original component rendered a nested structure (groups → txs),
// which forced the browser to allocate a DOM node for every transaction
// even when off-screen. For months with 100+ transactions this meant
// hundreds of nodes living in the layout. Flattening groups into a single
// row list lets @tanstack/react-virtual only render the visible window.
type FlatRow =
  | { kind: 'header'; group: GroupedTransaction }
  | { kind: 'tx'; tx: Transaction; txIdx: number };

// TASK 61-g (audit 61-a P3): anim-stagger HANYA untuk batch render awal.
// Dulunya kelas itu dipasang di tiap TransactionRow virtualizer — baris
// yang baru mount saat scroll cepat selalu memutar ulang fade-up 0.5s
// sehingga daftar panjang terasa berkedip. Kini hanya ±22 baris datar
// pertama (≈ viewport awal + overscan, lihat komentar BUGHUNT-47 di
// bawah) yang dianimasikan; baris hasil scroll mount tanpa animasi.
const ENTRY_ANIM_FLAT_ROW_LIMIT = 22;

// PERF-FIX: estimateSize callbacks must be stable (not re-created each
// render) — the virtualizer uses referential equality to decide whether
// to re-measure. Hoisting to module scope also avoids a fresh closure
// per render, which would otherwise cause the virtualizer to reset its
// measurements on every render of this component.
function estimateRowSize(row: FlatRow | undefined): number {
  if (!row) return 80;
  // Header rows are short (single-line pill). Transaction rows are compact
  // list rows (avatar 40px + 2-line content, ~64px + 6px margin-bottom
  // ≈ 70px after the PREMIUM-UI restyle). measureElement below self-heals
  // any drift (e.g. rows with the tap-to-expand panel open).
  return row.kind === 'header' ? 34 : 70;
}

export default function FinanceTransactions({
  filteredTransactions,
  groupedTransactions,
  transactions,
  selectedTxIds,
  txFilter,
  focusDate,
  onClearFocusDate,
  getCategoryList,
  getActiveSources,
  getCategoryMeta,
  getSourceEmoji,
  onFilterChange,
  onToggleSelectTx,
  onToggleSelectAll,
  onEditTx,
  onDeleteTx,
  onBulkDelete,
  selectedMonth,
  onGoToPrevMonth,
}: FinanceTransactionsProps) {
  const [showFilters, setShowFilters] = useState(false);
  // CONNECTED-APP: drill-down "hari ini" (footer) → transaksi terfilter.
  const openFinanceFocus = useAppStore(s => s.openFinanceFocus);
  const [multiSelect, setMultiSelect] = useState(false);
  // SHADCN-PHASE-2: tracks which transaction card is currently tap-expanded
  // (shows notes + tags). Null = all collapsed. At most one card expands at
  // a time — tapping a new card collapses the previous. State lives in the
  // parent (not per-row) so virtualized rows can unmount/remount without
  // losing expand state, and so toggling is O(1) without prop-drilling a
  // setter per row.
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  // FIN-BUG-7 fix: only compute + render "today's expense" when viewing
  // the current month. filteredTransactions is scoped to selectedMonth,
  // so for any other month today's expense would always be 0 — rendering
  // "Total Pengeluaran Hari Ini: Rp 0" is misleading. The footer's right
  // side (Total Transaksi count) still shows regardless.
  const isCurrentMonth = selectedMonth === jakartaMonthString();
  const today = jakartaDateString();
  // PERF-FIX: memoize today's-expense computation so it doesn't re-run
  // the filter+reduce on every render (only when filteredTransactions or
  // the today-string change).
  // H3: YMD dibaca dari komponen UTC ISO (slice(0,10)) — jakartaDateKey
  // lama mengonversi +7 sehingga pengeluaran ≥17:00 bergeser ke hari
  // berikutnya (total harian salah).
  // BUGHUNT-54 (3-a #7): hitung dari prop `transactions` PRA-filter (bulan
  // mentah), bukan filteredTransactions — saat filter tipe Pemasukan aktif,
  // footer lama menampilkan "Rp 0" menyesatkan padahal ada pengeluaran hari
  // ini. (H3 tetap: YMD dari komponen UTC ISO slice(0,10).)
  const todayExpense = useMemo(
    () =>
      isCurrentMonth
        ? transactions
            .filter(t => t.date.slice(0, 10) === today && t.type === 'expense')
            .reduce((s, t) => s + (t.amount ?? 0), 0)
        : 0,
    [isCurrentMonth, transactions, today]
  );

  // PERF-FIX (Fix 14): Flatten grouped transactions into a single list of
  // rows (header + tx interleaved). This is the input to the virtualizer.
  // useMemo ensures we don't rebuild the flat list on every render — only
  // when the grouped data actually changes.
  const flatRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = [];
    for (const group of groupedTransactions) {
      rows.push({ kind: 'header', group });
      group.txs.forEach((tx, idx) => rows.push({ kind: 'tx', tx, txIdx: idx }));
    }
    return rows;
  }, [groupedTransactions]);

  // BUGHUNT-47 (bug dilaporkan user: "kategori week 2 tidak masuk padahal
  // sudah ada transaksi"): useWindowVirtualizer mengamati scroll WINDOW —
  // padahal sejak BUGFIX SCROLL-2 arsitektur app menggulir container
  // [data-slot="app-scroller"] di dalamnya (document tidak pernah scroll).
  // window.scrollY permanen 0 → range virtualizer tidak pernah maju →
  // hanya ±22 baris pertama yang ter-mount; sisa bulan jadi ruang kosong
  // (transaksi minggu 2 dst. "hilang"). Kini virtualizer berlabuh ke
  // scroll container sebenarnya + scrollMargin = offset list dalam
  // container (pola resmi TanStack Virtual untuk list dalam elemen yang
  // digulir).
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollerEl, setScrollerEl] = useState<HTMLElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  // Resolve scroll container saat list hadir (saat mount pertama data bisa
  // masih loading → tx-timeline belum ter-render; efek ini jalan ulang begitu
  // baris pertama muncul). Pakai wrapper .tx-timeline sebagai jangkar.
  const hasRows = flatRows.length > 0;
  useEffect(() => {
    if (!hasRows) return;
    const el = listRef.current?.closest('[data-slot="app-scroller"]') as HTMLElement | null;
    setScrollerEl(el);
  }, [hasRows]);

  // Ukur offset list dalam konten scroll (scroll-invariant: rect +
  // scrollTop saling meniadakan). TASK 60-a #3 (temuan 59-b3): efek ini dulu
  // TANPA dependency array → getBoundingClientRect dipaksa TIAP render,
  // termasuk tiap frame scroll (virtualizer me-render ulang saat range
  // bergeser → forced layout per frame). Hasil ukur hanya berubah bila:
  //   (1) anchor tersedia / berganti — scrollerEl resolusi (efek di atas,
  //       termasuk saat baris pertama hadir setelah loading) — tetap jalan
  //       saat mount & pergantian sub-tab (komponen remount);
  //   (2) konten DI ATAS list berubah tinggi — panel filter expand/collapse
  //       (showFilters), toolbar multi-select (multiSelect + jumlah
  //       terpilih), badge pencarian (txFilter.search), chip tanggal
  //       drill-down (focusDate), atau pergantian data (flatRows — identitas
  //       useMemo berubah tiap data baru).
  // Scroll TIDAK termasuk — itulah penghematan utamanya (scroll-invariant).
  // setState dengan nilai sama = no-op React, jadi tidak ada render loop.
  // Perilaku ukur TIDAK berubah — hanya frekuensinya.
  useEffect(() => {
    if (!scrollerEl || !listRef.current) return;
    const next =
      listRef.current.getBoundingClientRect().top +
      scrollerEl.scrollTop -
      scrollerEl.getBoundingClientRect().top;
    setScrollMargin((m) => (m === next ? m : next));
  }, [scrollerEl, showFilters, multiSelect, selectedTxIds.size, txFilter.search, focusDate, flatRows]);

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    estimateSize: (i) => estimateRowSize(flatRows[i]),
    overscan: 12,
    measureElement: (el) => el.getBoundingClientRect().height,
    getScrollElement: () => scrollerEl,
    scrollMargin,
  });

  return (
    <div className="mt-4 space-y-3">
      <TransactionsFilterBar
        txFilter={txFilter}
        onFilterChange={onFilterChange}
        filteredCount={filteredTransactions.length}
        rawCount={transactions.length}
        focusDate={focusDate}
        onClearFocusDate={onClearFocusDate}
        showFilters={showFilters}
        onToggleShowFilters={() => setShowFilters(prev => !prev)}
        multiSelect={multiSelect}
        onToggleMultiSelect={() => {
          setMultiSelect(!multiSelect);
          if (multiSelect) {
            // Clear selections when exiting multi-select
            selectedTxIds.forEach(id => onToggleSelectTx(id));
          }
        }}
        selectedCount={selectedTxIds.size}
        getCategoryList={getCategoryList}
        getActiveSources={getActiveSources}
      />

      {/* ── Multi-select toolbar ──────────────────────────────── */}
      {multiSelect && selectedTxIds.size > 0 && (
        <div className="flex items-center justify-between p-2 px-3 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={filteredTransactions.length > 0 && selectedTxIds.size === filteredTransactions.length}
              onCheckedChange={onToggleSelectAll}
            />
            <span className="text-xs text-muted-foreground">
              {selectedTxIds.size} dari {filteredTransactions.length} dipilih
            </span>
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={onBulkDelete}>
            <Trash2 className="h-3 w-3" /> Hapus
          </Button>
        </div>
      )}

      {/* ── Transaction Timeline ──────────────────────────────── */}
      {filteredTransactions.length === 0 ? (
        <div className="premium-card rounded-2xl">
          {/* PREMIUM-UI: empty state dengan orb ilustrasi halus. CTA
              "Lihat bulan sebelumnya" (DB-MIGRATE-1) dipertahankan. */}
          <div className="premium-empty min-h-[15rem]">
            <div className="premium-empty-orb" aria-hidden="true">
              <Wallet className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm font-semibold mt-2">Belum ada transaksi</p>
            {/* DB-MIGRATE-1: when viewing the current month and it's empty,
                the user may genuinely have no transactions this month (e.g.
                just started a new month, or hasn't logged anything yet) —
                but they may also be panicking that their data was lost
                (this happened during the DB migration). Offer a one-tap
                shortcut to view the previous month so they can quickly
                confirm their old data is still there. Only show this CTA
                when we're on the current month AND a prev-month handler
                was wired up by the parent. */}
            {isCurrentMonth && onGoToPrevMonth ? (
              <div className="mt-2 flex flex-col items-center gap-2">
                <p className="text-xs text-muted-foreground">Belum ada transaksi bulan ini.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={onGoToPrevMonth}
                >
                  Lihat bulan sebelumnya
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Coba ubah filter atau tambah transaksi baru</p>
            )}
          </div>
        </div>
      ) : (
        <div className="tx-timeline space-y-1" ref={listRef}>
          {/*
            BUGHUNT-47: virtualisasi kini berlabuh ke [data-slot="app-scroller"]
            (container scroll sebenarnya) — bukan window. Catatan semantik
            TanStack Virtual: item.start INCLUDES scrollMargin dan
            getTotalSize() EXCLUDES-nya → translateY mengurangi scrollMargin
            (pola resmi dokumentasi). Sticky date pill tetap tidak berlaku
            (posisi absolute) — trade-off yang sama seperti sebelumnya.
          */}
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: 'relative',
              width: '100%',
            }}
          >
            {virtualizer.getVirtualItems().map(vItem => {
              const row = flatRows[vItem.index];
              if (!row) return null;
              return (
                <div
                  key={vItem.key}
                  data-index={vItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vItem.start - scrollMargin}px)`,
                  }}
                >
                  {row.kind === 'header' ? (
                    <div className="tx-date-pill">
                      {row.group.dateLabel}, {capitalize(row.group.dayName)}
                      {row.group.totalExpense > 0 && (
                        <span className="text-rose-600 dark:text-rose-400 ml-1">−{formatRupiah(row.group.totalExpense)}</span>
                      )}
                      {row.group.totalIncome > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 ml-1">+{formatRupiah(row.group.totalIncome)}</span>
                      )}
                    </div>
                  ) : (
                    <TransactionRow
                      tx={row.tx}
                      txIdx={row.txIdx}
                      animateEntry={vItem.index < ENTRY_ANIM_FLAT_ROW_LIMIT}
                      multiSelect={multiSelect}
                      selectedTxIds={selectedTxIds}
                      expandedTxId={expandedTxId}
                      onToggleExpand={(id: string) =>
                        setExpandedTxId(prev => (prev === id ? null : id))
                      }
                      getCategoryMeta={getCategoryMeta}
                      getSourceEmoji={getSourceEmoji}
                      onToggleSelectTx={onToggleSelectTx}
                      onEditTx={onEditTx}
                      onDeleteTx={onDeleteTx}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Total Expense Footer ──────────────────────────────── */}
      {filteredTransactions.length > 0 && (
        <div className="tx-total-footer flex items-center justify-between">
          {/* FIN-BUG-7 fix: only show today-expense block when viewing the
              current month. For other months, today's expense is always 0
              (filteredTransactions is scoped to selectedMonth) — showing
              "Rp 0" was misleading. */}
          {isCurrentMonth && !txFilter.search.trim() ? (
            /* CONNECTED-APP: "pengeluaran hari ini" → transaksi hari ini yang
               difilter (brief #12 — Today's spending → Finance today).
               TASK 59-b3 #3: disembunyikan saat PENCARIAN aktif — prop
               `transactions` berisi hasil pencarian all-time, sehingga
               angka hanya menghitung pengeluaran hari-ini yang kebetulan
               match kata kunci — label "Total Pengeluaran Hari Ini" jadi
               menyesatkan. Tanpa pencarian, angka kembali akurat penuh. */
            <button
              type="button"
              onClick={() => openFinanceFocus({ date: today, txType: 'expense' })}
              aria-label="Lihat transaksi pengeluaran hari ini"
              className="text-left cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <p className="premium-label">Total Pengeluaran Hari Ini</p>
              <p className="text-lg font-bold text-destructive premium-stat transition-opacity hover:opacity-80">{formatRupiah(todayExpense)}</p>
            </button>
          ) : (
            <div />
          )}
          <div className="text-right">
            <p className="premium-label">Total Transaksi</p>
            <p className="text-lg font-bold premium-stat">{filteredTransactions.length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
