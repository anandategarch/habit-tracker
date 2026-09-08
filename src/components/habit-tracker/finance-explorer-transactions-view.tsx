// ---------------------------------------------------------------------------
// TransactionsView — Level 4: transaction list for selected day.
// Extracted from finance-explorer.tsx during SPLIT-PHASE3.
// ---------------------------------------------------------------------------

'use client';

import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRupiah, type Transaction } from './finance-types';
import type { DayData } from './finance-explorer-types';

export interface TransactionsViewProps {
  selectedDay: number;
  dayData: DayData[];
  transactionList: Transaction[];
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
  /**
   * Task 4-b A.5: row tap opens the shared Edit Transaction dialog
   * (mutations.openEditTx wired from finance.tsx — the dialog is mounted at
   * the finance root, so it opens regardless of the active sub-tab).
   * Explorer rows come from the same /api/finance/transactions endpoint,
   * so the Transaction shape matches — no mapping needed.
   */
  onEditTx: (tx: Transaction) => void;
}

export function TransactionsView({
  selectedDay,
  dayData,
  transactionList,
  getCategoryMeta,
  onEditTx,
}: TransactionsViewProps) {
  const day = dayData.find((d) => d.day === selectedDay);
  return (
    <div className="fe-card">
      <h3 className="fe-card-title">Transaksi — {day?.dayName}, {day?.date}</h3>
      {transactionList.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Tidak ada transaksi</p>
      ) : (
        <div className="space-y-1 mt-4 max-h-96 overflow-y-auto custom-scrollbar">
          {transactionList.filter(Boolean).map((tx, i) => {
            const meta = getCategoryMeta(tx.category || 'Tidak diketahui');
            const d = new Date(tx.date);
            // Amount color coding — emerald income / rose expense
            // (explorer fetches type=expense, but coding handles both).
            const isIncome = tx.type === 'income';
            return (
              // Task 4-b A.5: rows are no longer a dead-end — real <button>
              // (keyboard + focus semantics) opening the edit dialog.
              // PREMIUM-UI: .premium-list-item pattern — avatar emoji
              // squircle (tint warna kategori) + judul + meta + nominal
              // rata kanan emerald/rose, konsisten dgn Transactions tab.
              <button
                key={tx.id}
                type="button"
                onClick={() => onEditTx(tx)}
                aria-label={`Edit transaksi ${tx.description || tx.category || 'Tidak diketahui'} sebesar ${formatRupiah(tx.amount || 0)}`}
                className={cn(
                  'premium-list-item w-full text-left cursor-pointer active:scale-[0.99] anim-stagger',
                  'py-2.5! px-2! focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                )}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <span
                  className="h-10 w-10 rounded-xl grid place-items-center text-base shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                  style={{ backgroundColor: `${meta.color}20` }}
                  aria-hidden="true"
                >
                  {meta.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{tx.description || tx.category || 'Tidak diketahui'}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-0.5 min-w-0">
                    <Clock className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">
                      {d.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} · {(tx.category || 'Tidak diketahui')}
                    </span>
                  </p>
                </div>
                <span
                  className={cn(
                    'text-sm font-semibold tabular-nums shrink-0',
                    isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                  )}
                >
                  {isIncome ? '+' : '−'}{formatRupiah(tx.amount || 0)}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground text-center mt-2">Ketuk transaksi untuk mengedit</p>
    </div>
  );
}
