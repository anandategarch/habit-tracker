'use client';

import { useState, useMemo } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Edit3, Search, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { jakartaDateString, jakartaDateKey, jakartaMonthString } from '@/lib/timezone';
import { toast } from 'sonner';
import { formatRupiah, capitalize } from './finance-types';
import type { Transaction } from './finance-types';

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
  selectedTxIds: Set<string>;
  txFilter: { type: string; category: string; source: string; search: string };
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
// re-created on every render. MUST use timeZone: 'Asia/Jakarta' explicitly
// (without it, toLocaleTimeString uses the runtime's default TZ — UTC on
// Vercel serverless, or the user's browser TZ locally). This caused the
// time shown here to disagree with the time shown in the Daily Recap's
// hourly heatmap + transactions list (which both use timeZone:
// 'Asia/Jakarta'). Same code path as daily-recap.tsx's formatTxTime() —
// keep them in sync.
function formatTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
    });
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

// PERF-FIX: estimateSize callbacks must be stable (not re-created each
// render) — the virtualizer uses referential equality to decide whether
// to re-measure. Hoisting to module scope also avoids a fresh closure
// per render, which would otherwise cause the virtualizer to reset its
// measurements on every render of this component.
function estimateRowSize(row: FlatRow | undefined): number {
  if (!row) return 80;
  // Header rows are short (single-line pill). Transaction rows are taller
  // (icon + 2-line content + amount + action buttons).
  return row.kind === 'header' ? 36 : 92;
}

export default function FinanceTransactions({
  filteredTransactions,
  groupedTransactions,
  selectedTxIds,
  txFilter,
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
  const [multiSelect, setMultiSelect] = useState(false);

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
  const todayExpense = useMemo(
    () =>
      isCurrentMonth
        ? filteredTransactions
            .filter(t => jakartaDateKey(new Date(t.date)) === today && t.type === 'expense')
            .reduce((s, t) => s + (t.amount ?? 0), 0)
        : 0,
    [isCurrentMonth, filteredTransactions, today]
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

  // PERF-FIX (Fix 14): useWindowVirtualizer scrolls with the document
  // (preserving the existing UX where the transaction list lives in
  // normal page flow). The virtualizer renders only the visible window
  // of rows + an overscan buffer; off-screen rows are NOT mounted, which
  // keeps DOM node count bounded regardless of how many transactions
  // the month has. estimateSize returns a rough height per row kind
  // (header is short, tx is taller) — the library uses this to compute
  // total scrollable height and to decide which rows are visible.
  const virtualizer = useWindowVirtualizer({
    count: flatRows.length,
    estimateSize: (i) => estimateRowSize(flatRows[i]),
    overscan: 12,
  });

  return (
    <div className="mt-4 space-y-3">
      {/* ── Search Bar ────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari transaksi..."
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

      {/* ── Filter Chips ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-0.5 px-0.5" style={{ scrollbarWidth: 'none' }}>
        <button
          className={cn(
            'tx-chip',
            txFilter.type === 'all' ? 'tx-chip-active' : 'tx-chip-inactive'
          )}
          onClick={() => onFilterChange({ ...txFilter, type: 'all' })}
        >
          Semua
        </button>
        <button
          className={cn(
            'tx-chip',
            txFilter.type === 'income' ? 'tx-chip-active' : 'tx-chip-inactive'
          )}
          onClick={() => onFilterChange({ ...txFilter, type: 'income' })}
        >
          ↑ Pemasukan
        </button>
        <button
          className={cn(
            'tx-chip',
            txFilter.type === 'expense' ? 'tx-chip-active' : 'tx-chip-inactive'
          )}
          onClick={() => onFilterChange({ ...txFilter, type: 'expense' })}
        >
          ↓ Pengeluaran
        </button>
        <button
          className="tx-chip tx-chip-inactive flex items-center gap-1"
          onClick={() => setShowFilters(!showFilters)}
        >
          Filter
          <ChevronDown className={cn('h-3 w-3 transition-transform', showFilters && 'rotate-180')} />
        </button>
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
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-2">💸</div>
          <p className="text-sm font-medium">Belum ada transaksi</p>
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
            <div className="mt-3 flex flex-col items-center gap-2">
              <p className="text-xs">Belum ada transaksi bulan ini.</p>
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
            <p className="text-xs mt-1">Coba ubah filter atau tambah transaksi baru</p>
          )}
        </div>
      ) : (
        <div className="tx-timeline space-y-1">
          {/*
            PERF-FIX (Fix 14): Virtualized list.
            The container div has height = total virtualized size so the
            document scroll bar reflects the full list length. Each visible
            row is absolutely positioned via `transform: translateY(start)`.
            Off-screen rows are NOT mounted — DOM count stays bounded even
            for months with hundreds of transactions.

            Note on sticky date pill: previously .tx-date-pill was
            position: sticky inside each group's container so it stayed
            pinned at top while scrolling within a group. With virtualized
            absolute positioning, sticky no longer applies — the date
            header now scrolls with its row. Trade-off accepted to gain
            bounded DOM for long lists. The pill's visual styling is
            preserved (still uses .tx-date-pill class).
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
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vItem.start}px)`,
                  }}
                >
                  {row.kind === 'header' ? (
                    <div className="tx-date-pill">
                      {row.group.dateLabel}, {capitalize(row.group.dayName)}
                      {row.group.totalExpense > 0 && (
                        <span className="text-destructive ml-1">-{formatRupiah(row.group.totalExpense)}</span>
                      )}
                      {row.group.totalIncome > 0 && (
                        <span className="text-primary ml-1">+{formatRupiah(row.group.totalIncome)}</span>
                      )}
                    </div>
                  ) : (
                    <TransactionRow
                      tx={row.tx}
                      txIdx={row.txIdx}
                      multiSelect={multiSelect}
                      selectedTxIds={selectedTxIds}
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
          {isCurrentMonth ? (
            <div>
              <p className="text-xs text-muted-foreground">Total Pengeluaran Hari Ini</p>
              <p className="text-lg font-bold text-destructive">{formatRupiah(todayExpense)}</p>
            </div>
          ) : (
            <div />
          )}
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total Transaksi</p>
            <p className="text-lg font-bold">{filteredTransactions.length}</p>
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
  getCategoryMeta,
  getSourceEmoji,
  onToggleSelectTx,
  onEditTx,
  onDeleteTx,
}: TransactionRowProps) {
  const meta = getCategoryMeta(tx.category);
  const isExpense = tx.type === 'expense';
  return (
    <div className="relative anim-stagger" style={{ animationDelay: `${Math.min(txIdx, 8) * 30}ms` }}>
      {/* Timeline node */}
      <div
        className="tx-node"
        style={{
          backgroundColor: isExpense ? '#ef4444' : '#22c55e',
        }}
      />

      {/* Transaction card */}
      <div
        className="tx-card group"
        onClick={() => {
          if (multiSelect) {
            onToggleSelectTx(tx.id);
          } else {
            onEditTx(tx);
          }
        }}
      >
        {/* Multi-select checkbox */}
        {multiSelect && (
          <div className="absolute top-2 right-2 z-10">
            <Checkbox
              checked={selectedTxIds.has(tx.id)}
              onCheckedChange={() => onToggleSelectTx(tx.id)}
            />
          </div>
        )}

        <div className="flex items-start gap-4">
          {/* Large category icon */}
          <div
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg"
            style={{
              backgroundColor: isExpense ? '#ef444415' : '#22c55e15',
            }}
          >
            {meta.emoji}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Top row: title + time */}
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-semibold truncate flex items-center gap-1.5">
                {tx.category}
                {tx.groupId && (
                  <span className="text-[9px] px-1 py-0 rounded-full bg-success/10 text-success dark:bg-success/15 dark:text-success/80 font-medium shrink-0">
                    Split
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatTime(tx.date)}
              </span>
            </div>

            {/* Bottom row: description + source + amount */}
            <div className="flex items-end justify-between gap-3 mt-1.5">
              <div className="min-w-0 flex-1">
                {tx.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {tx.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <span>{getSourceEmoji(tx.source || 'Kas')}</span>
                  <span className="truncate">{tx.source || 'Kas'}</span>
                </p>
              </div>

              {/* Amount */}
              <div className="shrink-0 text-right">
                <span
                  className={cn(
                    'text-sm font-bold',
                    isExpense ? 'text-destructive' : 'text-primary'
                  )}
                >
                  {isExpense ? '-' : '+'}{formatRupiah(tx.amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons (visible on hover, always visible on mobile) */}
          {!multiSelect && (
            <div className="flex flex-col gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0 ml-1">
              {/* Disable edit + delete for transfer transactions —
                  they're linked pairs that can't be modified
                  independently without corrupting balances. */}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={(e) => { e.stopPropagation(); onEditTx(tx); }}
                disabled={tx.category === 'Transfer Antar Sumber'}
                title={tx.category === 'Transfer Antar Sumber' ? 'Transfer tidak bisa diedit' : 'Edit'}
              >
                <Edit3 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  if (tx.category === 'Transfer Antar Sumber') {
                    toast.error('Transfer tidak bisa dihapus. Hapus kedua sisi (expense + income) secara manual.');
                    return;
                  }
                  onDeleteTx(tx.id);
                }}
                disabled={tx.category === 'Transfer Antar Sumber'}
                title={tx.category === 'Transfer Antar Sumber' ? 'Transfer tidak bisa dihapus' : 'Hapus'}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
