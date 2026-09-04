// ---------------------------------------------------------------------------
// TransactionsView — Level 4: transaction list for selected day.
// Extracted from finance-explorer.tsx during SPLIT-PHASE3.
// ---------------------------------------------------------------------------

'use client';

import { Clock } from 'lucide-react';
import { formatRupiah, type Transaction } from './finance-types';
import type { DayData } from './finance-explorer-types';

export interface TransactionsViewProps {
  selectedDay: number;
  dayData: DayData[];
  transactionList: Transaction[];
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
}

export function TransactionsView({
  selectedDay,
  dayData,
  transactionList,
  getCategoryMeta,
}: TransactionsViewProps) {
  return (
    <div className="fe-card">
      <h3 className="fe-card-title">Transaksi — {dayData.find((d) => d.day === selectedDay)?.dayName}, {dayData.find((d) => d.day === selectedDay)?.date}</h3>
      {transactionList.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Tidak ada transaksi</p>
      ) : (
        <div className="space-y-1 mt-4 max-h-96 overflow-y-auto">
          {transactionList.filter(Boolean).map((tx, i) => {
            const meta = getCategoryMeta(tx.category || 'Unknown');
            const d = new Date(tx.date);
            return (
              <div key={tx.id} className="fe-tx-row anim-stagger" style={{ animationDelay: `${i * 30}ms` }}>
                <div className="fe-tx-logo">{meta.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{tx.description || tx.category || 'Unknown'}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {d.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} · {(tx.category || 'Unknown')}
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums">{formatRupiah(tx.amount || 0)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
