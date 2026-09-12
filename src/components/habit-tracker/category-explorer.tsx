'use client';

// components/habit-tracker/category-explorer.tsx — sub-tab "Kategori" Finance.
// Daftar total pengeluaran per kategori untuk bulan terpilih; klik kategori →
// drill-down CategoryDetailView (category-explorer-detail-view.tsx) berisi
// grafik harian, pola jam/hari, sumber, anomal, daftar transaksi.

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from '@/lib/date-utils';
import { ChevronRight, PieChart, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { formatRupiah, compactRupiahSafe } from './finance-types';
import type { Transaction } from './finance-types';
import { CategoryDetailView } from './category-explorer-detail-view';
import { monthOptionLabel } from './category-explorer-helpers';
import type { CategoryTotal } from './category-explorer-types';
import { cn } from '@/lib/utils';

interface CategoryExplorerProps {
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  // Task 31: Date.UTC — format() membaca komponen UTC; build lokal
  // menggeser −1 bulan bagi pengguna UTC+ (Jakarta).
  return format(new Date(Date.UTC(y, m - 1 + delta, 1)), 'yyyy-MM');
}

export default function CategoryExplorer({ getCategoryMeta }: CategoryExplorerProps) {
  // Bulan lokal (default dari month picker global supaya deep-link/sub-tab
  // konsisten), dikelola lokal agar drill-down tidak menggeser tab lain.
  const storeMonth = useAppStore(s => s.selectedMonth);
  const [selectedMonth, setSelectedMonth] = useState(storeMonth);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const prevMonth = useMemo(() => shiftMonth(selectedMonth, -1), [selectedMonth]);

  const monthOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [];
    const [cy, cm] = selectedMonth.split('-').map(Number);
    for (let i = -24; i <= 24; i++) {
      // Task 31: Date.UTC — nilai opsi dulu dibangun lokal lalu dibaca UTC
      // oleh format() → bergeser −1 bulan bagi pengguna UTC+ (Jakarta):
      // dropdown "September" ternyata memilih Oktober/November → kosong.
      const ym = format(new Date(Date.UTC(cy, cm - 1 + i, 1)), 'yyyy-MM');
      opts.push({ value: ym, label: monthOptionLabel(ym) });
    }
    return opts;
  }, [selectedMonth]);

  const monthQuery = useQuery<Transaction[]>({
    queryKey: ['finance', 'transactions', 'category-explorer', selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/finance/transactions?month=${selectedMonth}`);
      if (!res.ok) return [];
      return (await res.json()).transactions ?? [];
    },
    staleTime: 15_000,
  });

  const prevMonthQuery = useQuery<Transaction[]>({
    queryKey: ['finance', 'transactions', 'category-explorer', prevMonth],
    queryFn: async () => {
      const res = await fetch(`/api/finance/transactions?month=${prevMonth}`);
      if (!res.ok) return [];
      return (await res.json()).transactions ?? [];
    },
    staleTime: 15_000,
  });

  const transactions = monthQuery.data ?? [];
  const prevTransactions = prevMonthQuery.data ?? [];

  // Total pengeluaran per kategori (hanya expense — kategori income tidak
  // punya makna "analisis belanja").
  const categoryTotals = useMemo<CategoryTotal[]>(() => {
    const map = new Map<string, { total: number; count: number }>();
    let grand = 0;
    for (const tx of transactions) {
      if (tx.type !== 'expense') continue;
      const cur = map.get(tx.category) ?? { total: 0, count: 0 };
      cur.total += tx.amount || 0;
      cur.count += 1;
      map.set(tx.category, cur);
      grand += tx.amount || 0;
    }
    return Array.from(map.entries())
      .map(([name, v]) => {
        const meta = getCategoryMeta(name);
        return {
          name,
          emoji: meta.emoji,
          color: meta.color,
          total: v.total,
          count: v.count,
          percentage: grand > 0 ? Math.round((v.total / grand) * 100) : 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [transactions, getCategoryMeta]);

  const grandTotal = useMemo(
    () => categoryTotals.reduce((s, c) => s + c.total, 0),
    [categoryTotals]
  );

  // ── Drill-down: kategori terpilih ─────────────────────────────────────
  const activeCategory = activeCat ? categoryTotals.find(c => c.name === activeCat) : null;
  if (activeCategory) {
    return (
      <CategoryDetailView
        cat={activeCategory}
        transactions={transactions}
        prevTransactions={prevTransactions}
        selectedMonth={selectedMonth}
        monthOptions={monthOptions}
        onBack={() => setActiveCat(null)}
        onSelectMonth={(m) => { setSelectedMonth(m); }}
      />
    );
  }

  // ── Error state ───────────────────────────────────────────────────────
  if (monthQuery.isError) {
    return (
      <div className="premium-card rounded-2xl mt-4">
        <div className="premium-empty min-h-[16rem]">
          <div className="premium-empty-orb" aria-hidden="true">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold">Gagal memuat data kategori</p>
          <p className="text-xs text-muted-foreground">Coba lagi dalam sejenak</p>
          <Button size="sm" variant="outline" className="h-8 text-xs mt-1" onClick={() => monthQuery.refetch()}>
            <RefreshCw className="h-3 w-3" /> Coba lagi
          </Button>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────
  if (monthQuery.isLoading) {
    return (
      <div className="space-y-3 mt-4">
        <Skeleton className="h-9 w-44 rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────
  if (categoryTotals.length === 0) {
    return (
      <div className="space-y-3 mt-4">
        <CategoryMonthPicker selectedMonth={selectedMonth} monthOptions={monthOptions} onSelect={setSelectedMonth} />
        <div className="premium-card rounded-2xl">
          <div className="premium-empty min-h-[16rem]">
            <div className="premium-empty-orb" aria-hidden="true">
              <PieChart className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold">Belum ada pengeluaran</p>
            <p className="text-xs text-muted-foreground">
              Catat transaksi pengeluaran untuk melihat analisis per kategori
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Daftar kategori ───────────────────────────────────────────────────
  return (
    <div className="space-y-3 mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CategoryMonthPicker selectedMonth={selectedMonth} monthOptions={monthOptions} onSelect={setSelectedMonth} />
        <div className="text-right">
          <p className="premium-label">Total Pengeluaran</p>
          <p className="premium-stat text-lg">{formatRupiah(grandTotal)}</p>
        </div>
      </div>

      <div className="premium-card premium-card-sheen rounded-2xl p-2 sm:p-3 space-y-1.5 anim-stagger">
        {categoryTotals.map((cat, idx) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => setActiveCat(cat.name)}
            className="premium-list-item w-full px-3! py-2.5! text-left cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            style={{ '--stagger': idx } as React.CSSProperties}
            aria-label={`Lihat detail kategori ${cat.name}`}
          >
            <span
              className="h-10 w-10 rounded-xl grid place-items-center text-base shrink-0 ring-1 ring-black/5 dark:ring-white/10"
              style={{ backgroundColor: `${cat.color}20` }}
              aria-hidden="true"
            >
              {cat.emoji}
            </span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{cat.name}</span>
                <span className="text-sm font-semibold tabular-nums shrink-0">
                  {compactRupiahSafe(cat.total)}
                </span>
              </span>
              <span className="flex items-center gap-2 mt-1">
                <Progress
                  value={cat.percentage}
                  className={cn('h-1.5 flex-1 anim-progress-fill')}
                />
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {cat.percentage}% · {cat.count}×
                </span>
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}

function CategoryMonthPicker({
  selectedMonth,
  monthOptions,
  onSelect,
}: {
  selectedMonth: string;
  monthOptions: Array<{ value: string; label: string }>;
  onSelect: (m: string) => void;
}) {
  return (
    <Select value={selectedMonth} onValueChange={onSelect}>
      <SelectTrigger className="w-full sm:w-[180px] h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {monthOptions.map(o => (
          <SelectItem key={o.value} value={o.value}>
            <span className="capitalize">{o.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
