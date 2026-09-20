'use client';

// components/habit-tracker/finance-detail-budgets.tsx — sektor 4 detail
// Ringkasan: Budget per Kategori (diekstrak verbatim dari
// finance-detail-sections.tsx, Task 71-i).
//
// Budget per kategori + bar tone (emerald/amber/rose) + sisa/lewat; baris
// drill-down ke transaksi kategori (CONNECTED-APP).

import { ChevronRight, Target } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { compactRupiah, compactRupiahSafe } from './finance-types';
import { tintFromColor } from '@/lib/finance-helpers';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';
import type { DashboardData } from './finance-types';
import type { Stagger } from './finance-detail-utils';

export function BudgetDetailList({
  budgetDetail,
  stagger,
}: Stagger & { budgetDetail: NonNullable<DashboardData['budgetDetail']> }) {
  const openFinanceSubTab = useAppStore(s => s.openFinanceSubTab);
  // CONNECTED-APP: baris budget → transaksi kategori (drill-down).
  const openFinanceFocus = useAppStore(s => s.openFinanceFocus);
  if (budgetDetail.length === 0) return null;
  const items = budgetDetail.slice(0, 6);

  return (
    <section
      className="premium-card premium-card-sheen rounded-2xl anim-stagger"
      style={{ '--stagger': stagger } as CSSProperties}
      aria-label="Budget per kategori"
    >
      <div className="flex items-center justify-between gap-2 p-4 pb-2 sm:p-5 sm:pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="chip-icon chip-amber h-8 w-8 shrink-0" aria-hidden="true">
            <Target className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold">Budget per Kategori</h3>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
          onClick={() => openFinanceSubTab('budgets')}
          aria-label="Kelola budget"
        >
          Kelola
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      <div className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-2">
        {items.map(b => {
          const pct = Math.max(0, b.pct);
          const tone =
            pct > 100
              ? 'bg-rose-500'
              : pct >= 80
                ? 'bg-amber-500'
                : 'bg-emerald-500';
          const remainingTone =
            b.remaining < 0
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-muted-foreground';
          return (
            /* CONNECTED-APP: baris budget di Ringkasan kini drill-down ke
               transaksi kategori itu (dulu hover palsu tanpa onClick —
               ketidakselarasan vs sub-tab Anggaran yang sudah terhubung). */
            <button
              type="button"
              key={b.category}
              onClick={() => openFinanceFocus({ category: b.category, txType: 'expense' })}
              aria-label={`Lihat transaksi kategori ${b.category} — terpakai ${pct}%`}
              className="w-full cursor-pointer rounded-xl px-2 py-1.5 text-left hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-8 w-8 rounded-lg grid place-items-center text-sm shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                  style={{ backgroundColor: tintFromColor(b.color) }}
                  aria-hidden="true"
                >
                  {b.emoji}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{b.category}</span>
                  <span className={cn('block text-[10px] tabular-nums', remainingTone)}>
                    {b.remaining < 0
                      ? `Lewat ${compactRupiahSafe(Math.abs(b.remaining))}`
                      : `Sisa ${compactRupiahSafe(b.remaining)}`}
                  </span>
                </span>
                <span className="text-xs font-semibold tabular-nums shrink-0">
                  {compactRupiah(b.spent)}
                  <span className="text-muted-foreground font-normal"> / {compactRupiah(b.amount)}</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden" role="presentation">
                <div
                  className={cn('h-full rounded-full transition-all', tone)}
                  style={{ width: `${Math.min(100, Math.max(pct > 0 ? 3 : 0, pct))}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
