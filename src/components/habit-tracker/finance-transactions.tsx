'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Trash2, Edit3, Search, X, ChevronDown, Wallet, MoreHorizontal, CircleOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { jakartaDateString, jakartaMonthString } from '@/lib/timezone';
import { format } from '@/lib/date-utils';
import { toast } from 'sonner';
import { formatRupiah, capitalize } from './finance-types';
import { formatDateShort } from '@/lib/finance-helpers';
import type { Transaction } from './finance-types';
import { parseTags } from './finance-types';
import { useAppStore } from '@/store/app-store';

interface GroupedTransaction {
 dateKey: string;
 dateLabel: string;
 dayName: string;
 txs: Transaction[];
 totalIncome: number;
 totalExpense: number;
 net: number;
}

interface FinanceTransactionsProps {
 filteredTransactions: Transaction[];
 groupedTransactions: GroupedTransaction[];
 /** BUGHUNT-54 (3-a #7): transaksi PRA-filter (bulan mentah / hasil pencarian
     server sebelum filter client) — dasar footer "Total Pengeluaran Hari
     Ini" & indikator truncation pencarian. */
 transactions: Transaction[];
 selectedTxIds: Set<string>;
 txFilter: { type: string; category: string; source: string; search: string };
 /** CONNECTED-APP — filter tanggal aktif dari drill-down (heatmap / hari ini). */
 focusDate?: string | null;
 /** Lepas chip filter tanggal (kembali ke seluruh bulan). */
 onClearFocusDate?: () => void;
 getCategoryList: (type: string) => { value: string; emoji: string; color: string }[];
 getActiveSources: () => { id: string; name: string; emoji: string; order: number }[];
 getCategoryMeta: (cat: string) => { emoji: string; color: string };
 getSourceEmoji: (name: string) => string;
 onFilterChange: (filter: { type: string; category: string; source: string; search: string }) => void;
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

// PERF-FIX (FIX-TIER3 / Fix 14): Format time from transaction date.
// Hoisted to module scope — this function is stateless and was previously
// re-created on every render.
// H3: Transaction.date menyimpan komponen UTC = jam dinding Jakarta (jam
// disimpan sebagai jam UTC) → jam dibaca dari KOMPONEN UTC langsung lewat
// format(date,'HH:mm') lib/date-utils (getUTCHours). toLocaleTimeString
// timeZone 'Asia/Jakarta' lama mengonversi +7 → jam tampil digeser 7 jam
// (19:58 → 02.58).
function formatTime(dateStr: string) {
 try {
   return format(new Date(dateStr), 'HH:mm');
 } catch {
   return '';
 }
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

// PREMIUM-UI ("Rutina Aurora"): opsi filter tipe transaksi untuk segmented
// control premium (menggantikan tombol chip merah/hijau generik). Label &
// value dipetakan 1:1 ke txFilter.type — logika onFilterChange tidak berubah.
// FIX-AUDIT-23 (#1): panah arah (↑/↓) dipisah ke field `arrow` sendiri —
// di layar <400px panah disembunyikan (aria-hidden, dekoratif) supaya 3 item
// muat di 320px. Teks label & value SAMA persis — murni presentasi.
const TYPE_OPTIONS = [
 { value: 'all', label: 'Semua', arrow: '' },
 { value: 'income', label: 'Pemasukan', arrow: '↑' },
 { value: 'expense', label: 'Pengeluaran', arrow: '↓' },
] as const;

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
     {/* ── Search Bar ────────────────────────────────────────── */}
     <div className="relative">
       <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
       <Input
         placeholder="Cari transaksi di semua periode..."
         value={txFilter.search}
         onChange={e => onFilterChange({ ...txFilter, search: e.target.value })}
         className="pl-9 h-10 text-sm rounded-xl bg-card border-border"
       />
       {txFilter.search && (
         <button
           onClick={() => onFilterChange({ ...txFilter, search: '' })}
           className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
         >
           <X className="h-4 w-4" />
         </button>
       )}
     </div>

     {/* FEAT-SEARCH-ALLTIME: Badge shown when search is active. Tells the
         user the search spans all periods (not just the selected month)
         and shows result count. Provides a quick clear button. */}
     {txFilter.search.trim() && (
       <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary">
         <Search className="h-3 w-3 shrink-0" />
         <span className="flex-1">
           Mencari di <strong>semua periode</strong> — {filteredTransactions.length} transaksi ditemukan
           {/* BUGHUNT-54 (3-a #9): API membatasi 500 hasil — bila hasil mentah
               tepat 500, tampilkan penanda kemungkinan terpotong. */}
           {transactions.length === 500 && ' · 500+ kemungkinan terpotong'}
         </span>
         <button
           onClick={() => onFilterChange({ ...txFilter, search: '' })}
           className="shrink-0 hover:bg-primary/20 rounded px-1.5 py-0.5 transition-colors"
           aria-label="Hapus pencarian"
         >
           <X className="h-3 w-3" />
         </button>
       </div>
     )}

     {/* ── Filter: segmented control tipe + chips util ──────────── */}
     {/* PREMIUM-UI: toggle Semua/Pemasukan/Pengeluaran kini memakai
         .premium-segment (pill gradien aktif per item, data-active attr).
         Logika onFilterChange/txFilter.type TIDAK berubah. */}
     <div className="flex flex-wrap items-center gap-2">
       <div
         className="premium-segment w-full sm:w-auto min-w-0 overflow-x-auto scrollbar-hide"
         role="group"
         aria-label="Filter tipe transaksi"
       >
         {TYPE_OPTIONS.map((opt) => {
           const isActive = txFilter.type === opt.value;
           return (
             <button
               key={opt.value}
               type="button"
               className="premium-segment-item relative h-9 flex-1 min-w-0 whitespace-nowrap cursor-pointer"
               data-active={isActive ? 'true' : 'false'}
               aria-pressed={isActive}
               onClick={() => onFilterChange({ ...txFilter, type: opt.value })}
             >
               {isActive && (
                 <span
                   aria-hidden="true"
                   className="absolute inset-0 -z-10 rounded-full animate-in fade-in zoom-in-95 duration-200"
                   style={{
                     background:
                       'linear-gradient(135deg, var(--primary), color-mix(in oklch, var(--primary) 55%, #2dd4bf))',
                     boxShadow:
                       '0 2px 8px -2px color-mix(in oklch, var(--primary) 40%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.28)',
                   }}
                 />
               )}
               {opt.arrow && (
                 <span aria-hidden="true" className="hidden min-[400px]:inline">
                   {opt.arrow}&nbsp;
                 </span>
               )}
               {opt.label}
             </button>
           );
         })}
       </div>
       <button
         className="tx-chip tx-chip-inactive flex items-center gap-1"
         onClick={() => setShowFilters(!showFilters)}
       >
         Filter
         <ChevronDown className={cn('h-3 w-3 transition-transform', showFilters && 'rotate-180')} />
       </button>
       {/* CONNECTED-APP — chip tanggal drill-down (heatmap / "hari ini"):
           tampil hanya bila ada, bisa dilepas untuk kembali ke seluruh bulan. */}
       {focusDate && (
         <button
           type="button"
           className="tx-chip tx-chip-active flex items-center gap-1"
           onClick={() => onClearFocusDate?.()}
           aria-label={`Hapus filter tanggal ${focusDate}`}
         >
           {formatDateShort(focusDate)}
           <X className="h-3 w-3" aria-hidden="true" />
         </button>
       )}
       <button
         className={cn(
           'tx-chip',
           multiSelect ? 'tx-chip-active' : 'tx-chip-inactive'
         )}
         onClick={() => {
           setMultiSelect(!multiSelect);
           if (multiSelect) {
             // Clear selections when exiting multi-select
             selectedTxIds.forEach(id => onToggleSelectTx(id));
           }
         }}
       >
         {multiSelect ? `${selectedTxIds.size} dipilih` : 'Pilih'}
       </button>
     </div>

     {/* ── Expanded Filters (category + source) ───────────────── */}
     {showFilters && (
       <div className="space-y-2 p-3 rounded-xl bg-card border border-border">
         <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
           <span className="text-xs text-muted-foreground shrink-0">Kategori:</span>
           <button
             className={cn('tx-chip', txFilter.category === 'all' ? 'tx-chip-active' : 'tx-chip-inactive')}
             onClick={() => onFilterChange({ ...txFilter, category: 'all' })}
           >
             Semua
           </button>
           {getCategoryList('expense').map(c => (
             <button
               key={c.value}
               className={cn('tx-chip', txFilter.category === c.value ? 'tx-chip-active' : 'tx-chip-inactive')}
               onClick={() => onFilterChange({ ...txFilter, category: c.value })}
             >
               {c.emoji} {c.value}
             </button>
           ))}
           {getCategoryList('income').map(c => (
             <button
               key={c.value}
               className={cn('tx-chip', txFilter.category === c.value ? 'tx-chip-active' : 'tx-chip-inactive')}
               onClick={() => onFilterChange({ ...txFilter, category: c.value })}
             >
               {c.emoji} {c.value}
             </button>
           ))}
         </div>
         <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
           <span className="text-xs text-muted-foreground shrink-0">Sumber:</span>
           <button
             className={cn('tx-chip', txFilter.source === 'all' ? 'tx-chip-active' : 'tx-chip-inactive')}
             onClick={() => onFilterChange({ ...txFilter, source: 'all' })}
           >
             Semua
           </button>
           {getActiveSources().map(s => (
             <button
               key={s.id || s.name}
               className={cn('tx-chip', txFilter.source === s.name ? 'tx-chip-active' : 'tx-chip-inactive')}
               onClick={() => onFilterChange({ ...txFilter, source: s.name })}
             >
               {s.emoji} {s.name}
             </button>
           ))}
         </div>
       </div>
     )}

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

// PERF-FIX (Fix 14): Extracted as a separate component so it can be
// memoized in the future (e.g. React.memo) and so the parent's render
// doesn't force re-creation of every visible row's JSX tree. Keeping
// the row's render logic out of the virtualizer map callback also
// makes the code easier to reason about.
interface TransactionRowProps {
 tx: Transaction;
 txIdx: number;
 multiSelect: boolean;
 selectedTxIds: Set<string>;
 // SHADCN-PHASE-2: expand support. expandedTxId is the currently-expanded
 // tx id (owned by parent). onToggleExpand flips it (id -> id, same id -> null).
 expandedTxId: string | null;
 onToggleExpand: (id: string) => void;
 getCategoryMeta: (cat: string) => { emoji: string; color: string };
 getSourceEmoji: (name: string) => string;
 onToggleSelectTx: (id: string) => void;
 onEditTx: (tx: Transaction) => void;
 onDeleteTx: (id: string) => void;
}

function TransactionRow({
 tx,
 txIdx,
 multiSelect,
 selectedTxIds,
 expandedTxId,
 onToggleExpand,
 getCategoryMeta,
 getSourceEmoji,
 onToggleSelectTx,
 onEditTx,
 onDeleteTx,
}: TransactionRowProps) {
 const meta = getCategoryMeta(tx.category);
 const isExpense = tx.type === 'expense';
 // M4: transfer tampil NETRAL (violet, tanpa tanda +/−) — bukan emerald
 // untuk kedua kaki yang mengesankan pemasukan dobel.
 const isTransfer = tx.type === 'transfer';
 // SHADCN-PHASE-2: tap-to-expand state. parseTags is null-safe (returns []
 // for missing/invalid tags), so legacy rows without the column render no
 // expand section. hasExpandContent gates both the onClick handler and the
 // expand panel render — cards with no notes AND no tags are not
 // tappable (the edit button remains the only interaction), avoiding a
 // confusing "tapped but nothing happened" UX.
 const isExpanded = expandedTxId === tx.id;
 const tags = parseTags(tx.tags);
 const hasExpandContent = !!(tx.notes || tags.length > 0);
 // CONNECTED-APP: apakah baris ini benar-benar merespons tap? (lihat className)
 const hasTapAction = multiSelect || hasExpandContent || tx.type !== 'transfer';
 return (
   <div className="relative anim-stagger" style={{ animationDelay: `${Math.min(txIdx, 8) * 30}ms` }}>
     {/* Timeline node — warna diharmonisasi dengan amount (rose / emerald /
         violet netral untuk transfer) */}
     <div
       className="tx-node"
       style={{
         backgroundColor: isTransfer ? '#8b5cf6' : isExpense ? '#f43f5e' : '#10b981',
       }}
     />

     {/* Transaction row — PREMIUM-UI ("Rutina Aurora").
         .premium-list-item: baris kaya dengan hover tint halus; avatar
         emoji squircle (tint warna kategori), judul font-medium, label
         kategori kecil muted, nominal rata kanan tabular-nums
         (emerald + / rose −). Padding dinaikkan via important utility
         (unlayered .premium-list-item hanya set 10px/12px).
         onClick behavior (dipertahankan persis):
         - multiSelect mode: toggle selection.
         - single-select + hasExpandContent: toggle expand.
         - single-select + no expand content: fallback ke edit dialog. */}
     <div
       className={cn(
         'premium-list-item group relative mb-1.5 flex-wrap px-4! py-3!',
         // CONNECTED-APP (button audit): baris transfer tanpa konten expand
         // TIDAK punya aksi tap — jangan tampilkan affordance pointer/aktif
         // (dulu terlihat klikabel padahal tap = no-op).
         hasTapAction ? 'cursor-pointer active:scale-[0.99]' : ''
       )}
       onClick={() => {
         if (multiSelect) {
           onToggleSelectTx(tx.id);
         } else if (hasExpandContent) {
           onToggleExpand(tx.id);
         } else if (tx.type !== 'transfer') {
           // BUGFIX POST-3 #4: Fallback ke edit dialog saat card tidak punya
           // notes/tags untuk expand. Sebelum Phase 2, tap card = edit. Sekarang
           // tap card = expand (jika ada content) atau edit (jika tidak ada).
           // Transfer dikecualikan — dialog edit tidak bisa menyimpannya
           // (API menolak perubahan jumlah/kategori transfer).
           onEditTx(tx);
         }
       }}
     >
       {/* Multi-select checkbox
           BUG-FINANCE-CAL BUG-1: wrap the checkbox in a stopPropagation
           container. Without this, clicking the checkbox bubbles up to the
           tx-card's onClick (which toggles selection in multi-select mode),
           so onCheckedChange AND the parent onClick BOTH fire — net-zero
           selection change. The checkbox appeared broken: clicking it did
           nothing. Now the wrapper swallows the click so only the checkbox's
           onCheckedChange runs. */}
       {multiSelect && (
         <div
           className="absolute top-2 right-2 z-10"
           onClick={(e) => e.stopPropagation()}
         >
           <Checkbox
             checked={selectedTxIds.has(tx.id)}
             onCheckedChange={() => onToggleSelectTx(tx.id)}
           />
         </div>
       )}

       {/* Avatar emoji squircle — tint warna kategori (meta.color hex +
           alpha 12.5% = RRGGBBAA; getCategoryMeta selalu mengembalikan
           6-digit hex, fallback '#78716c'). Ring hairline memberi definisi
           di atas background sage. */}
       <span
         className="h-10 w-10 rounded-xl grid place-items-center text-base shrink-0 ring-1 ring-black/5 dark:ring-white/10"
         style={{ backgroundColor: `${meta.color}20` }}
         aria-hidden="true"
       >
         {meta.emoji}
       </span>

       {/* Content: judul (description → fallback kategori) + waktu */}
       <div className="flex-1 min-w-0">
         <div className="flex items-start justify-between gap-2.5">
           <span className="text-sm font-medium truncate flex items-center gap-1.5 min-w-0">
             {tx.description?.trim() || tx.category}
             {tx.groupId && (
               <span className="text-[9px] px-1 py-0 rounded-full bg-success/10 text-success dark:bg-success/15 dark:text-success/80 font-medium shrink-0">
                 Split
               </span>
             )}
           </span>
           <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
             {formatTime(tx.date)}
           </span>
         </div>

         {/* Meta line: kategori (label kecil muted) + sumber dana.
             Kategori hanya tampil bila judul memakai description —
             hindari duplikasi saat kategori sudah menjadi judul.
             SHADCN-PHASE-2: tag badges tetap di panel tap-to-expand
             di bawah (declutter tampilan default). */}
         <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 min-w-0">
           {tx.description?.trim() && (
             <>
               <span className="truncate">{tx.category}</span>
               <span aria-hidden="true" className="shrink-0">·</span>
             </>
           )}
           {/* BUGHUNT-54 (3-a #5): transaksi tanpa sumber (source & sourceName
               keduanya kosong) jangan berlabel palsu "Kas 👛" — tampil jujur
               "Tanpa Sumber" dengan ikon netral. */}
           {!tx.source && !tx.sourceName ? (
             <>
               <span className="shrink-0 text-muted-foreground/60" aria-hidden="true">
                 <CircleOff className="h-3 w-3" />
               </span>
               <span className="truncate text-muted-foreground/70">Tanpa Sumber</span>
             </>
           ) : (
             <>
               <span className="shrink-0" aria-hidden="true">{getSourceEmoji(tx.source || tx.sourceName || 'Kas')}</span>
               <span className="truncate">{tx.source || tx.sourceName || 'Kas'}</span>
             </>
           )}
         </p>
       </div>

       {/* Amount — rata kanan, tabular-nums, emerald (+) / rose (−) /
           transfer NETRAL violet tanpa tanda (M4: kedua kaki transfer bukan
           pemasukan/pengeluaran — menandainya +/- menyesatkan). */}
       <div className="shrink-0 text-right self-center">
         <span
           className={cn(
             'text-sm font-semibold tabular-nums',
             isTransfer
               ? 'text-violet-600 dark:text-violet-400'
               : isExpense
                 ? 'text-rose-600 dark:text-rose-400'
                 : 'text-emerald-600 dark:text-emerald-400'
           )}
         >
           {isTransfer ? '' : isExpense ? '−' : '+'}{formatRupiah(tx.amount)}
         </span>
       </div>

       {/* SPACING-FIX (permintaan user: "jarak card terlalu jauh"):
           dulu 2 tombol aksi ditumpuk VERTIKAL — kolom 78px membengkakkan
           kartu jadi ±104px. Kini 1 tombol menu kebab — tinggi kartu
           kembali ±64px (avatar 40px + padding), lebar teks mobile tetap.
           Edit/hapus jadi 2 ketuk via menu. Aturan lama dipertahankan:
           edit disabled untuk transfer (pasangan ter-link, API menolak
           perubahan jumlah/kategori); delete tetap boleh untuk transfer
           (API atomik menghapus pasangan + memulihkan saldo). */}
       {!multiSelect && (
         <div className="shrink-0 ml-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
           <DropdownMenu>
             <DropdownMenuTrigger asChild>
               <Button
                 variant="ghost"
                 size="icon"
                 className="h-9 w-9"
                 onClick={(e) => e.stopPropagation()}
                 title="Menu transaksi"
                 aria-label="Menu transaksi"
               >
                 <MoreHorizontal className="h-4 w-4" />
               </Button>
             </DropdownMenuTrigger>
             <DropdownMenuContent align="end">
               <DropdownMenuItem
                 disabled={tx.type === 'transfer'}
                 onClick={() => onEditTx(tx)}
               >
                 <Edit3 className="h-3.5 w-3.5" />
                 <span>Edit</span>
               </DropdownMenuItem>
               <DropdownMenuItem
                 className="text-destructive focus:text-destructive"
                 onClick={() => onDeleteTx(tx.id)}
               >
                 <Trash2 className="h-3.5 w-3.5" />
                 <span>Hapus</span>
               </DropdownMenuItem>
             </DropdownMenuContent>
           </DropdownMenu>
         </div>
       )}

       {/* SHADCN-PHASE-2: tap-to-expand panel (notes + tags).
           Renders only when this card is expanded AND has content.
           anim-tab-enter (defined in globals.css) provides a smooth
           fade + slide-in from the right, and respects
           prefers-reduced-motion (globals.css sets it to `none` under
           the reduced-motion media query).
           Virtualization note: the parent virtualizer uses
           measureElement (ResizeObserver) on each row, so when this
           panel mounts/unmounts and the row's height changes, the
           virtualizer auto-re-measures — no manual invalidate needed.
           This is why state lives in the parent: a row can unmount when
           scrolled out of view and remount when scrolled back, and its
           expand state survives because it's keyed by tx.id in the
           parent, not held in row-local state. */}
       {isExpanded && hasExpandContent && (
         <div className="mt-2 pt-2 w-full basis-full border-t border-border/50 text-xs text-muted-foreground anim-tab-enter">
           {tx.notes && (
             <p className="mb-1 break-words">{tx.notes}</p>
           )}
           {tags.length > 0 && (
             <div className="flex gap-1 flex-wrap">
               {tags.map((tag, i) => (
                 <span
                   key={`${tag}-${i}`}
                   className="px-2 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground border border-border/60"
                 >
                   #{tag}
                 </span>
               ))}
             </div>
           )}
         </div>
       )}
     </div>
   </div>
 );
}

