'use client';

// components/habit-tracker/finance-detail-categories.tsx — sektor 3 detail
// Ringkasan: Top Kategori (diekstrak verbatim dari
// finance-detail-sections.tsx, Task 71-i).
//
// Top 5 kategori + bar + chip MoM vs bulan lalu; tiap baris drill-down ke
// transaksi kategori (openFinanceFocus).

import { PieChart, TrendingDown, TrendingUp } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { compactRupiah, compactRupiahSafe } from './finance-types';
import { tintFromColor } from '@/lib/finance-helpers';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';
import type { DashboardData } from './finance-types';
import type { Stagger } from './finance-detail-utils';

export function CategoryTopList({
  dashboardData,
  stagger,
}: Stagger & { dashboardData: DashboardData }) {
  const openFinanceFocus = useAppStore(s => s.openFinanceFocus);
  const byCategory = dashboardData?.byCategory ?? [];
  const monthExpense = dashboardData?.monthExpense ?? 0;
  const top5 = byCategory.slice(0, 5);
  if (top5.length === 0) return null;
  const maxAmount = Math.max(1, top5[0]?.amount ?? 1);

  return (
    <section
      className="premium-card premium-card-sheen rounded-2xl anim-stagger"
      style={{ '--stagger': stagger } as CSSProperties}
      aria-label="Top kategori pengeluaran"
    >
      <div className="flex items-center justify-between gap-2 p-4 pb-2 sm:p-5 sm:pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="chip-icon chip-rose h-8 w-8 shrink-0" aria-hidden="true">
            <PieChart className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold">Top Kategori</h3>
        </div>
        <p className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
          {compactRupiah(monthExpense)} keluar
        </p>
      </div>

      <div className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-1">
        {top5.map(cat => {
          const share = monthExpense > 0 ? Math.round((cat.amount / monthExpense) * 100) : 0;
          const momPct = cat.momPct ?? null;
          const momTone =
            momPct === null
              ? null
              : momPct <= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : momPct <= 10
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-rose-600 dark:text-rose-400';
          const MomIcon = momPct !== null && momPct > 0 ? TrendingUp : TrendingDown;
          return (
            <button
              key={cat.category}
              type="button"
              className="w-full px-2 py-2 rounded-xl text-left cursor-pointer transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.99]"
              onClick={() => openFinanceFocus({ category: cat.category })}
              aria-label={`Lihat transaksi kategori ${cat.category}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="h-9 w-9 rounded-xl grid place-items-center text-base shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                  style={{ backgroundColor: tintFromColor(cat.color) }}
                  aria-hidden="true"
                >
                  {cat.emoji}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-sm font-medium truncate">{cat.category}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {share}%
                    </span>
                  </span>
                  <span className="block h-1 rounded-full bg-muted mt-1 overflow-hidden" aria-hidden="true">
                    <span
                      className="block h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(3, Math.round((cat.amount / maxAmount) * 100))}%`,
                        backgroundColor: cat.color,
                      }}
                    />
                  </span>
                </span>
                <span className="flex flex-col items-end shrink-0 gap-0.5">
                  <span className="text-sm font-semibold tabular-nums">
                    {compactRupiahSafe(cat.amount)}
                  </span>
                  {momPct !== null && momTone && (
                    <span className={cn('inline-flex items-center gap-0.5 text-[10px] tabular-nums', momTone)}>
                      <MomIcon className="h-3 w-3" aria-hidden="true" />
                      {momPct > 0 ? '+' : ''}{momPct}%
                    </span>
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
