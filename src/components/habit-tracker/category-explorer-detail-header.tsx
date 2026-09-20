'use client';

// components/habit-tracker/category-explorer-detail-header.tsx — bagian atas
// view detail kategori, DUA komponen dipisah supaya urutan DOM induk tetap
// persis: breadcrumb (baris atas) → pemilih bulan (sibling -filters) →
// hero number (kartu CountUp + badge B4 vs bulan lalu).
// Diekstraksi dari category-explorer-detail-view.tsx saat SPLIT god-file
// (Task 71-g) — JSX/aria/CSSProperties stagger identik.

import type { CSSProperties } from 'react';
import { ArrowUpRight, ChevronLeft, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CategoryTotal } from './category-explorer-types';
import { CountUpNumber } from './count-up';
import { CountUpRupiah } from './count-up-rupiah';
import { monthLabel, compactRupiahSafe } from './category-explorer-helpers';
import type { CategoryDetailData } from './category-explorer-detail-data';

// ── Breadcrumb + back + 1-click tx link ──────────────────────────────────

export interface CategoryDetailBreadcrumbProps {
  cat: CategoryTotal;
  onBack: () => void;
  /** ONE-CLICK-8: 1-tap ke sub-tab Transaksi dengan filter kategori ini. */
  onViewTransactions: () => void;
}

export function CategoryDetailBreadcrumb({ cat, onBack, onViewTransactions }: CategoryDetailBreadcrumbProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <ChevronLeft className="h-4 w-4" />
        Kategori
      </button>
      <ChevronLeft className="h-3 w-3 text-muted-foreground/50" />
      <span className="text-xs font-medium text-foreground">{cat.emoji} {cat.name}</span>
      {/* ONE-CLICK-8: ghost pill rata kanan — langsung ke transaksi
          kategori ini (filter terpasang). */}
      <button
        type="button"
        onClick={onViewTransactions}
        className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 min-h-8 text-xs font-semibold text-primary hover:bg-primary/10 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label={`Lihat transaksi kategori ${cat.name}`}
      >
        Lihat transaksi
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

// ── Hero number ──────────────────────────────────────────────────────────

export interface CategoryDetailHeroProps {
  cat: CategoryTotal;
  selectedMonth: string;
  txCount: number;
  activeDays: number;
  vsLastMonthPct: number | null;
  vsLastMonthDir: CategoryDetailData['vsLastMonthDir'];
  prevTotal: number;
}

export function CategoryDetailHero({
  cat,
  selectedMonth,
  txCount,
  activeDays,
  vsLastMonthPct,
  vsLastMonthDir,
  prevTotal,
}: CategoryDetailHeroProps) {
  return (
    <div className="premium-card premium-card-sheen rounded-2xl overflow-hidden anim-stagger contain-card" style={{ '--stagger': 0 } as CSSProperties}>
      <div className="bg-gradient-to-br from-[#22c55e]/[0.025] via-[#10b981]/[0.015] to-transparent px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">{cat.emoji}</span>
          <p className="text-sm font-semibold">{cat.name}</p>
          <span className="text-xs text-muted-foreground">· {monthLabel(selectedMonth)}</span>
        </div>
        <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          <CountUpRupiah amount={cat.total} />
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          <CountUpNumber value={txCount} /> transaksi · {activeDays} hari aktif · {cat.percentage}% dari total
        </p>

        {/* B4: vs Last Month comparison */}
        {vsLastMonthPct !== null && (
          <div className={cn(
            'inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-medium',
            vsLastMonthDir === 'up'
              ? 'bg-destructive/10 text-destructive dark:bg-destructive/15 dark:text-destructive/80'
              : vsLastMonthDir === 'down'
              ? 'bg-success/10 text-success dark:bg-success/15 dark:text-success/80'
              : 'bg-muted text-muted-foreground'
          )}>
            {vsLastMonthDir === 'up' && <TrendingUp className="h-3 w-3" />}
            {vsLastMonthDir === 'down' && <TrendingDown className="h-3 w-3" />}
            {vsLastMonthDir === 'same' && <Minus className="h-3 w-3" />}
            <span>
              {vsLastMonthDir === 'same' ? 'Sama dengan' : `${Math.abs(vsLastMonthPct)}% ${vsLastMonthDir === 'up' ? 'naik' : 'turun'} dari`}
              {' '}bulan lalu ({compactRupiahSafe(prevTotal)})
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
