'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Edit3, Search, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { jakartaDateString, jakartaDateKey } from '@/lib/timezone';
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
}: FinanceTransactionsProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [multiSelect, setMultiSelect] = useState(false);

  // Calculate today's total expense
  const today = jakartaDateString();
  const todayExpense = filteredTransactions
    .filter(t => jakartaDateKey(new Date(t.date)) === today && t.type === 'expense')
    .reduce((s, t) => s + (t.amount ?? 0), 0);

  // Format time from transaction date.
  // MUST use timeZone: 'Asia/Jakarta' explicitly — without it, toLocaleTimeString
  // uses the runtime's default timezone (UTC on Vercel serverless, or the
  // user's browser TZ locally). This caused the time shown here to disagree
  // with the time shown in the Daily Recap's hourly heatmap + transactions
  // list (which both use timeZone: 'Asia/Jakarta'). Same code path as
  // daily-recap.tsx's formatTxTime() — keep them in sync.
  const formatTime = (dateStr: string) => {
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
  };

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
          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-600" onClick={onBulkDelete}>
            <Trash2 className="h-3 w-3 mr-1" /> Hapus
          </Button>
        </div>
      )}

      {/* ── Transaction Timeline ──────────────────────────────── */}
      {filteredTransactions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-2">💸</div>
          <p className="text-sm font-medium">Belum ada transaksi</p>
          <p className="text-xs mt-1">Coba ubah filter atau tambah transaksi baru</p>
        </div>
      ) : (
        <div className="tx-timeline space-y-0">
          {groupedTransactions.map((group, idx) => (
            <div
              key={group.dateKey}
              className="anim-row-stagger"
              style={{ '--stagger-index': idx } as React.CSSProperties}
            >
              {/* Sticky date pill */}
              <div className="tx-date-pill">
                {group.dateLabel}, {capitalize(group.dayName)}
                {group.totalExpense > 0 && (
                  <span className="text-red-500 ml-1">-{formatRupiah(group.totalExpense)}</span>
                )}
                {group.totalIncome > 0 && (
                  <span className="text-primary ml-1">+{formatRupiah(group.totalIncome)}</span>
                )}
              </div>

              {/* Transaction cards */}
              {group.txs.map(tx => {
                const meta = getCategoryMeta(tx.category);
                const isExpense = tx.type === 'expense';
                return (
                  <div key={tx.id} className="relative">
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

                      <div className="flex items-start gap-3">
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
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-semibold truncate">
                              {tx.category}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatTime(tx.date)}
                            </span>
                          </div>

                          {/* Bottom row: description + source + amount */}
                          <div className="flex items-end justify-between gap-2 mt-0.5">
                            <div className="min-w-0 flex-1">
                              {tx.description && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {tx.description}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <span>{getSourceEmoji(tx.source || 'Kas')}</span>
                                <span className="truncate">{tx.source || 'Kas'}</span>
                              </p>
                            </div>

                            {/* Amount */}
                            <div className="shrink-0 text-right">
                              <span
                                className={cn(
                                  'text-sm font-bold',
                                  isExpense ? 'text-red-500' : 'text-primary'
                                )}
                              >
                                {isExpense ? '-' : '+'}{formatRupiah(tx.amount)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons (visible on hover, always visible on mobile) */}
                        {!multiSelect && (
                          <div className="flex flex-col gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                            {/* Disable edit + delete for transfer transactions —
                                they're linked pairs that can't be modified
                                independently without corrupting balances. */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => { e.stopPropagation(); onEditTx(tx); }}
                              disabled={tx.category === 'Transfer Antar Sumber'}
                              title={tx.category === 'Transfer Antar Sumber' ? 'Transfer tidak bisa diedit' : 'Edit'}
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-red-500 hover:text-red-600"
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
              })}
            </div>
          ))}
        </div>
      )}

      {/* ── Total Expense Footer ──────────────────────────────── */}
      {filteredTransactions.length > 0 && (
        <div className="tx-total-footer flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Total Pengeluaran Hari Ini</p>
            <p className="text-lg font-bold text-red-500">{formatRupiah(todayExpense)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total Transaksi</p>
            <p className="text-lg font-bold">{filteredTransactions.length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
