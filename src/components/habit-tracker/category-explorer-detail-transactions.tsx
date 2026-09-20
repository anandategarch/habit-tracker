'use client';

// components/habit-tracker/category-explorer-detail-transactions.tsx —
// "Rincian Transaksi" view detail kategori: daftar transaksi bulan terpilih
// (scrollable, custom-scrollbar). MERGE Task 32 (transplant Eksplorasi):
// baris jadi TOMBOL — tap membuka dialog edit transaksi di root
// finance.tsx (onEditTx → mutasi.openEditTx, pola Task 4-b A.5).
// Diekstraksi dari category-explorer-detail-view.tsx saat SPLIT god-file
// (Task 71-g) — JSX/aria identik.

import type { CSSProperties } from 'react';
import { Receipt } from 'lucide-react';
import { formatTxTime, formatDateShort } from '@/lib/finance-helpers';
import { monthLabel, compactRupiahSafe } from './category-explorer-helpers';
import type { CategoryTotal } from './category-explorer-types';
import type { Transaction } from './finance-types';

export interface CategoryDetailTransactionsProps {
  cat: CategoryTotal;
  catTx: Transaction[];
  selectedMonth: string;
  onEditTx: (tx: Transaction) => void;
}

export function CategoryDetailTransactions({ cat, catTx, selectedMonth, onEditTx }: CategoryDetailTransactionsProps) {
  return (
    <div className="premium-card premium-card-sheen rounded-2xl overflow-hidden anim-stagger" style={{ '--stagger': 14 } as CSSProperties}>
      <div className="px-4 py-2.5 sm:px-6 border-b border-border">
        <h3 className="premium-label flex items-center gap-2">
          <span className="chip-icon h-7 w-7 chip-slate shrink-0" aria-hidden="true">
            <Receipt className="h-3.5 w-3.5" />
          </span>
          Rincian Transaksi
        </h3>
      </div>
      <div className="max-h-96 overflow-y-auto custom-scrollbar cv-auto">
        {catTx.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Belum ada transaksi {cat.emoji} {cat.name} di {monthLabel(selectedMonth)}
          </p>
        ) : (
          catTx.map((tx) => (
            // MERGE Task 32 (transplant Eksplorasi): baris jadi tombol — tap
            // membuka dialog edit transaksi di root finance.tsx (bukan lagi
            // daftar baca-saja).
            <button
              key={tx.id}
              type="button"
              onClick={() => onEditTx(tx)}
              className="flex items-center gap-3 w-full text-left px-4 py-2 sm:px-6 border-b border-border/40 last:border-b-0 cursor-pointer hover:bg-muted/40 active:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
              aria-label={`Edit transaksi ${tx.description || tx.category}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  {tx.description || tx.category}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDateShort(tx.date)} · {formatTxTime(tx.date)}
                  {tx.sourceName ? ` · ${tx.sourceName}` : ''}
                </p>
              </div>
              <span className="text-xs font-semibold tabular-nums shrink-0 text-destructive">
                −{compactRupiahSafe(tx.amount)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
