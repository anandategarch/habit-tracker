'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { jakartaMonthString, jakartaNowParts } from '@/lib/timezone';
import { type Transaction } from './finance-types';

import type { CategoryTotal, CategoryExplorerProps } from './category-explorer-types';
import { CategoryDetailView } from './category-explorer-detail-view';
import { CategoryListView } from './category-explorer-list-view';

// ── Main Component ───────────────────────────────────────────────────────

export default function CategoryExplorer({ getCategoryMeta }: CategoryExplorerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(jakartaMonthString());

  // Month options (last 12 months).
  // BUG-3 fix: previously used `new Date()` + date-fns `subMonths`/`format`
  // which read the BROWSER's local timezone. For users in timezones behind
  // Jakarta (e.g., US/Pacific = UTC-8), on the 1st of a Jakarta month at
  // 00:30 Jakarta time, the browser-local time is still the previous month.
  // This caused `selectedMonth` (Jakarta-based) to NOT match any option in
  // the list (browser-local based) → the month picker showed empty.
  //
  // Fix: use `jakartaNowParts()` to get Jakarta wall-clock components, then
  // build month options by decrementing the month counter (handling
  // year rollover). This ensures the options list aligns with the
  // Jakarta-based initial `selectedMonth`.
  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const jp = jakartaNowParts();
    // Indonesian month names for label
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];
    let y = jp.year;
    let m = jp.month; // 1-12
    for (let i = 0; i <= 11; i++) {
      const value = `${y}-${String(m).padStart(2, '0')}`;
      const label = `${monthNames[m - 1]} ${y}`;
      opts.push({ value, label });
      // Decrement month (handle January → December rollover)
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
    }
    return opts;
  }, []);

  // Fetch all expense transactions for the selected month
  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ['finance', 'category-explorer', selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/finance/transactions?month=${selectedMonth}&type=expense`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  // Fetch previous month for comparison (B4: vs Last Month)
  const prevMonthStr = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  }, [selectedMonth]);

  const { data: prevTransactions = [] } = useQuery<Transaction[]>({
    queryKey: ['finance', 'category-explorer', prevMonthStr],
    queryFn: async () => {
      const res = await fetch(`/api/finance/transactions?month=${prevMonthStr}&type=expense`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });

  // Group transactions by category for the list view.
  // Exclude "Penyesuaian Saldo" and "Transfer Antar Sumber" — these are
  // internal movements, not real expenses. Including them would inflate
  // the grandTotal and show misleading category breakdowns.
  const categoryTotals = useMemo<CategoryTotal[]>(() => {
    const EXCLUDED = ['Penyesuaian Saldo', 'Transfer Antar Sumber'];
    const map = new Map<string, { total: number; count: number }>();
    for (const tx of transactions) {
      if (EXCLUDED.includes(tx.category)) continue;
      const existing = map.get(tx.category) ?? { total: 0, count: 0 };
      existing.total += tx.amount || 0;
      existing.count += 1;
      map.set(tx.category, existing);
    }
    const grandTotal = Array.from(map.values()).reduce((s, v) => s + v.total, 0);
    return Array.from(map.entries())
      .map(([name, v]) => {
        const meta = getCategoryMeta(name);
        return {
          name,
          emoji: meta.emoji,
          color: meta.color,
          total: v.total,
          count: v.count,
          percentage: grandTotal > 0 ? Math.round((v.total / grandTotal) * 100) : 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [transactions, getCategoryMeta]);

  const grandTotal = useMemo(
    () => categoryTotals.reduce((s, c) => s + c.total, 0),
    [categoryTotals]
  );

  // ── Category Detail View ──────────────────────────────────────────────

  if (selectedCategory) {
    // When month changes, transactions briefly become [] during refetch.
    // Without this guard, categoryTotals is [] → cat not found → user
    // bounces back to list view even if category exists in new month.
    if (isLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-[120px] rounded-xl" />
          <Skeleton className="h-[260px] rounded-xl" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        </div>
      );
    }

    const cat = categoryTotals.find((c) => c.name === selectedCategory);
    if (!cat) {
      // Category genuinely doesn't exist in this month — go back to list
      setSelectedCategory(null);
      return null;
    }

    return (
      <CategoryDetailView
        cat={cat}
        transactions={transactions}
        prevTransactions={prevTransactions}
        selectedMonth={selectedMonth}
        monthOptions={monthOptions}
        onBack={() => setSelectedCategory(null)}
        onSelectMonth={setSelectedMonth}
      />
    );
  }

  // ── Category List View ────────────────────────────────────────────────

  return (
    <CategoryListView
      selectedMonth={selectedMonth}
      monthOptions={monthOptions}
      categoryTotals={categoryTotals}
      grandTotal={grandTotal}
      isLoading={isLoading}
      onSelectMonth={setSelectedMonth}
      onSelectCategory={setSelectedCategory}
    />
  );
}
