// ---------------------------------------------------------------------------
// CategoryListView — list of categories with totals + projection.
// Extracted from category-explorer.tsx during SPLIT-PHASE3.
// ---------------------------------------------------------------------------

'use client';

import { ChevronRight, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatRupiah } from './finance-types';
import { jakartaNowParts } from '@/lib/timezone';
import { compactRupiahSafe } from './category-explorer-helpers';
import type { CategoryTotal } from './category-explorer-types';

export interface CategoryListViewProps {
  selectedMonth: string;
  monthOptions: { value: string; label: string }[];
  categoryTotals: CategoryTotal[];
  grandTotal: number;
  isLoading: boolean;
  onSelectMonth: (m: string) => void;
  onSelectCategory: (name: string) => void;
}

export function CategoryListView({
  selectedMonth,
  monthOptions,
  categoryTotals,
  grandTotal,
  isLoading,
  onSelectMonth,
  onSelectCategory,
}: CategoryListViewProps) {
  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Header — month picker (left, compact) + Total (right, dominant) */}
      <div className="flex items-center justify-between gap-2">
        <Select value={selectedMonth} onValueChange={onSelectMonth}>
          <SelectTrigger className="w-full sm:w-[180px] h-9">
            <Calendar className="h-3.5 w-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
          <p className="text-lg sm:text-xl font-bold tabular-nums leading-tight">
            {isLoading ? '...' : formatRupiah(grandTotal)}
          </p>
        </div>
      </div>

      {/* Category list — premium soft UI container (only the list area) */}
      <div className="rounded-2xl bg-muted/20 dark:bg-slate-950/20 p-3">
        {isLoading ? (
          <div className="space-y-1.5">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : categoryTotals.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="text-3xl mb-2 anim-float-subtle">📊</div>
            <p className="text-sm font-medium">Belum ada pengeluaran</p>
            <p className="text-xs text-muted-foreground mt-1">
              Catat transaksi untuk melihat breakdown per kategori
            </p>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {categoryTotals.map((cat, idx) => {
              // Inline projection calc (preserved exactly from prior implementation)
              const [y, m] = selectedMonth.split('-').map(Number);
              const daysInMonth = new Date(y, m, 0).getDate();
              const jp = jakartaNowParts();
              const daysElapsed = (jp.year === y && jp.month === m) ? jp.day : daysInMonth;
              const showProjection = daysElapsed > 0 && cat.total > 0;
              const projection = showProjection ? Math.round((cat.total / daysElapsed) * daysInMonth) : 0;
              const delta = projection - cat.total;

              return (
                <button
                  key={cat.name}
                  onClick={() => onSelectCategory(cat.name)}
                  className="w-full text-left anim-row-stagger group"
                  style={{
                    '--stagger-index': idx,
                    '--cat-accent': `${cat.color}4D`,
                  } as React.CSSProperties}
                >
                  {/* Horizontal compact data card */}
                  <div
                    className={cn(
                      'rounded-xl border bg-card dark:bg-zinc-900 contain-card',
                      'border-black/[0.06] dark:border-white/[0.06]',
                      'shadow-sm transition-all duration-200',
                      'group-hover:bg-muted/30 group-hover:shadow-none',
                      'group-hover:border-[color:var(--cat-accent)]'
                    )}
                  >
                    {/* Top row:
                        desktop  → icon | name+count+proyeksi | % | progress bar | nominal | chevron
                        mobile   → icon | name | % | nominal | chevron */}
                    <div className="flex items-center gap-3 px-3.5 py-2.5">
                      {/* Icon container — emoji on category color @ 15% opacity */}
                      <div
                        className="flex items-center justify-center w-10 h-10 rounded-lg text-lg shrink-0"
                        style={{ backgroundColor: `${cat.color}15` }}
                      >
                        {cat.emoji}
                      </div>

                      {/* Name + (desktop only) count + proyeksi */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{cat.name}</p>
                        <p className="hidden sm:block text-[11px] text-muted-foreground">
                          {cat.count} transaksi
                        </p>
                        {showProjection && delta > 0 && (
                          <p className="hidden sm:block text-[10px] text-muted-foreground/70 mt-0.5">
                            ↗ proyeksi{' '}
                            <span className="font-medium text-foreground">{compactRupiahSafe(projection)}</span>
                            <span className="text-muted-foreground/70"> (+{compactRupiahSafe(delta)})</span>
                          </p>
                        )}
                      </div>

                      {/* Percentage — desktop column (accent color) */}
                      <div
                        className="hidden sm:block text-sm font-semibold tabular-nums shrink-0 w-10 text-right"
                        style={{ color: cat.color }}
                      >
                        {cat.percentage}%
                      </div>

                      {/* Progress bar — desktop (h-1.5, w-20, muted track, accent fill) */}
                      <div className="hidden sm:block w-20 shrink-0">
                        <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${cat.percentage}%`,
                              backgroundColor: cat.color,
                            }}
                          />
                        </div>
                      </div>

                      {/* Percentage — mobile inline (compact, next to nominal) */}
                      <div
                        className="sm:hidden text-xs font-semibold tabular-nums shrink-0"
                        style={{ color: cat.color }}
                      >
                        {cat.percentage}%
                      </div>

                      {/* Nominal — dominant */}
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold tabular-nums text-foreground">{formatRupiah(cat.total)}</p>
                      </div>

                      {/* Chevron — clickable affordance, shifts right on hover */}
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </div>

                    {/* Mobile bottom row — count + proyeksi + thin progress bar (full width) */}
                    <div className="sm:hidden px-3.5 pb-2.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {cat.count} transaksi
                        </span>
                        {showProjection && delta > 0 && (
                          <span className="text-[10px] text-muted-foreground/70 truncate">
                            ↗ proyeksi{' '}
                            <span className="font-medium text-foreground">{compactRupiahSafe(projection)}</span>
                          </span>
                        )}
                      </div>
                      <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 anim-fill-bar"
                          style={{
                            width: `${cat.percentage}%`,
                            backgroundColor: cat.color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
