'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, Trash2, Edit3, Search, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  return (
    <div className="space-y-4 mt-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari transaksi..."
            value={txFilter.search}
            onChange={e => onFilterChange({ ...txFilter, search: e.target.value })}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={txFilter.type} onValueChange={v => onFilterChange({ ...txFilter, type: v })}>
          <SelectTrigger className="h-9 w-full sm:w-36 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tipe</SelectItem>
            <SelectItem value="income">Pemasukan</SelectItem>
            <SelectItem value="expense">Pengeluaran</SelectItem>
          </SelectContent>
        </Select>
        <Select value={txFilter.category} onValueChange={v => onFilterChange({ ...txFilter, category: v })}>
          <SelectTrigger className="h-9 w-full sm:w-44 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {getCategoryList('expense').map(c => (
              <SelectItem key={c.value} value={c.value}>{c.emoji} {c.value}</SelectItem>
            ))}
            {getCategoryList('income').map(c => (
              <SelectItem key={c.value} value={c.value}>{c.emoji} {c.value}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={txFilter.source} onValueChange={v => onFilterChange({ ...txFilter, source: v })}>
          <SelectTrigger className="h-9 w-full sm:w-[140px] text-sm">
            <SelectValue placeholder="Sumber" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Sumber</SelectItem>
            {getActiveSources().map(s => (
              <SelectItem key={s.id || s.name} value={s.name}>{s.emoji} {s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Transactions Grouped by Date */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <Wallet className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Belum ada transaksi
              </div>
            ) : (
              <div>
                {/* Select All Bar */}
                <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 sticky top-0 z-10">
                  <Checkbox
                    checked={filteredTransactions.length > 0 && selectedTxIds.size === filteredTransactions.length}
                    onCheckedChange={onToggleSelectAll}
                  />
                  <span className="text-xs text-muted-foreground">
                    {selectedTxIds.size > 0 ? `${selectedTxIds.size} dipilih` : 'Pilih semua'}
                  </span>
                  {selectedTxIds.size > 0 && (
                    <Button size="sm" variant="ghost" className="ml-auto h-6 text-xs text-red-500 hover:text-red-600" onClick={onBulkDelete}>
                      <Trash2 className="h-3 w-3 mr-1" /> Hapus ({selectedTxIds.size})
                    </Button>
                  )}
                </div>

                {groupedTransactions.map(group => (
                  <div key={group.dateKey}>
                    {/* Date Header with Daily Total */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b sticky top-[37px] z-10">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold">{group.dateLabel}</span>
                        <span className="text-xs text-muted-foreground">, {capitalize(group.dayName)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {group.totalIncome > 0 && (
                          <span className="text-green-600 font-medium">+{formatRupiah(group.totalIncome)}</span>
                        )}
                        {group.totalExpense > 0 && (
                          <span className="text-red-500 font-medium">-{formatRupiah(group.totalExpense)}</span>
                        )}
                        <span className={cn('font-semibold px-1.5 py-0.5 rounded text-[10px]', group.net >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400')}>
                          {group.net >= 0 ? '+' : ''}{formatRupiah(group.net)}
                        </span>
                      </div>
                    </div>

                    {/* Transactions for this date */}
                    {group.txs.map(tx => {
                      const meta = getCategoryMeta(tx.category);
                      return (
                        <div key={tx.id} className="flex items-center gap-2 px-4 py-2.5 border-b last:border-b-0 group hover:bg-accent/30 transition-colors">
                          <Checkbox
                            checked={selectedTxIds.has(tx.id)}
                            onCheckedChange={() => onToggleSelectTx(tx.id)}
                            className="shrink-0"
                          />
                          <span className="text-sm shrink-0">{meta.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium truncate">{tx.category}</span>
                              <span className="text-muted-foreground text-[10px]">·</span>
                              <span className="text-xs text-muted-foreground truncate">{tx.description || '-'}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {getSourceEmoji(tx.source || 'Kas')} {tx.source || 'Kas'}
                            </div>
                          </div>
                          <span className={cn('text-xs font-semibold shrink-0', tx.type === 'income' ? 'text-green-600' : 'text-red-500')}>
                            {tx.type === 'income' ? '+' : '-'}{formatRupiah(tx.amount)}
                          </span>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEditTx(tx)}>
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600" onClick={() => onDeleteTx(tx.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}