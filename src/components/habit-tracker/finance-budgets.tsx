'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, Plus, Edit3, Trash2, History, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRupiah } from './finance-types';
import type { BudgetItem, DashboardData } from './finance-types';

interface BudgetSnapshot {
  id: string;
  category: string;
  month: string;
  budgetAmount: number;
  spentAmount: number;
  rolloverIn: number;
  rolloverOut: number;
  effectiveBudget: number;
  percentage: number;
  status: string;
}

interface FinanceBudgetsProps {
  budgets: BudgetItem[];
  dashboardData: DashboardData | null;
  selectedMonth: string;
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
  onAddBudget: () => void;
  onEditBudget: (b: BudgetItem) => void;
  onDeleteBudget: (id: string) => void;
}

export default function FinanceBudgets({
  budgets,
  dashboardData,
  selectedMonth,
  getCategoryMeta,
  onAddBudget,
  onEditBudget,
  onDeleteBudget,
}: FinanceBudgetsProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<BudgetSnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/finance/budgets/snapshot');
      if (res.ok) {
        const data = await res.json();
        setHistoryData(data);
      }
    } catch { /* silent */ }
    setHistoryLoading(false);
  };

  const toggleHistory = () => {
    if (!showHistory) {
      fetchHistory();
    }
    setShowHistory(!showHistory);
  };

  // Group history by month
  const historyByMonth = historyData.reduce((acc, snap) => {
    if (!acc[snap.month]) acc[snap.month] = [];
    acc[snap.month].push(snap);
    return acc;
  }, {} as Record<string, BudgetSnapshot[]>);

  const sortedMonths = Object.keys(historyByMonth).sort().reverse();

  return (
    <div className="space-y-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Atur budget pengeluaran per kategori per bulan</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={toggleHistory}>
            <History className="h-4 w-4 mr-1" />
            {showHistory ? 'Tutup' : 'History'}
          </Button>
          <Button size="sm" onClick={onAddBudget}>
            <Plus className="h-4 w-4 mr-1" />
            Tambah
          </Button>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">📊 Budget History</h3>
            {historyLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </div>
            ) : sortedMonths.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Belum ada history budget</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {sortedMonths.map(month => {
                  const snaps = historyByMonth[month];
                  const totalBudget = snaps.reduce((s, b) => s + b.effectiveBudget, 0);
                  const totalSpent = snaps.reduce((s, b) => s + b.spentAmount, 0);
                  const totalRollover = snaps.reduce((s, b) => s + b.rolloverIn, 0);
                  const totalPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

                  return (
                    <div key={month} className="border border-border rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold">{month}</span>
                        <div className="flex items-center gap-2 text-xs">
                          {totalRollover > 0 && (
                            <span className="text-green-500 flex items-center gap-0.5">
                              <TrendingUp className="h-3 w-3" /> +{formatRupiah(totalRollover)}
                            </span>
                          )}
                          <span className={cn(
                            'font-semibold px-1.5 py-0.5 rounded-full',
                            totalPct > 100 ? 'bg-red-500/10 text-red-600' : totalPct >= 80 ? 'bg-amber-500/10 text-amber-600' : 'bg-green-500/10 text-green-600'
                          )}>
                            {totalPct}%
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                        <span>Terpakai: {formatRupiah(totalSpent)}</span>
                        <span>Budget: {formatRupiah(totalBudget)}</span>
                      </div>
                      <Progress value={Math.min(totalPct, 100)} className={cn('h-1.5', totalPct > 100 && '[&>div]:bg-red-500')} />
                      {/* Per-category detail */}
                      <div className="mt-2 space-y-1">
                        {snaps.map(snap => {
                          const meta = getCategoryMeta(snap.category);
                          return (
                            <div key={snap.id} className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1 truncate">
                                {meta.emoji} {snap.category}
                                {snap.rolloverIn > 0 && (
                                  <span className="text-green-500 text-[10px]">(+{formatRupiah(snap.rolloverIn)})</span>
                                )}
                              </span>
                              <span className={cn(
                                'font-medium shrink-0',
                                snap.percentage > 100 ? 'text-red-500' : 'text-muted-foreground'
                              )}>
                                {formatRupiah(snap.spentAmount)}/{formatRupiah(snap.effectiveBudget)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Budget Cards */}
      {budgets.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-muted-foreground">
            <Target className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Belum ada budget</p>
            <p className="text-xs mt-1">Atur budget per kategori untuk memantau pengeluaran</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {budgets.map(b => {
            const meta = getCategoryMeta(b.category);
            const dashboardBudget = dashboardData?.budgetStatus.find(db2 => db2.id === b.id);
            const spent = dashboardBudget?.spent || 0;
            const pct = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
            const isOver = pct > 100;
            const isWarning = pct >= 80 && pct <= 100;
            const remaining = Math.max(0, b.amount - spent);

            // Calculate remaining days in the selected month
            const [bYear, bMonth] = selectedMonth.split('-').map(Number);
            const totalDaysInMonth = new Date(bYear, bMonth, 0).getDate();
            const now = new Date();
            const isCurrentMonth = now.getFullYear() === bYear && (now.getMonth() + 1) === bMonth;
            const daysLeft = isCurrentMonth ? Math.max(1, totalDaysInMonth - now.getDate() + 1) : null;

            return (
              <div
                key={b.id}
                className={cn(
                  'group rounded-2xl bg-card p-4 transition-all duration-200 hover:shadow-md',
                  isOver && 'ring-1 ring-red-300 dark:ring-red-800',
                  !isOver && isWarning && 'ring-1 ring-amber-300 dark:ring-amber-800'
                )}
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                {/* Top row: icon + name + actions */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 bg-muted/50">
                      {meta.emoji}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold truncate">{b.category}</h3>
                      <p className="text-xs text-muted-foreground capitalize">{b.period === 'monthly' ? 'Per Bulan' : 'Per Minggu'}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditBudget(b)}>
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => onDeleteBudget(b.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Budget vs spent */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <div>
                      <span className="text-lg font-bold">{formatRupiah(spent)}</span>
                      <span className="text-xs text-muted-foreground ml-1">/ {formatRupiah(b.amount)}</span>
                    </div>
                    <span className={cn(
                      'text-xs font-semibold px-2 py-0.5 rounded-full',
                      isOver ? 'bg-red-500/10 text-red-600' : isWarning ? 'bg-amber-500/10 text-amber-600' : 'bg-green-500/10 text-green-600'
                    )}>
                      {pct}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <Progress
                    value={Math.min(pct, 100)}
                    className={cn('h-2', isOver && '[&>div]:bg-red-500', isWarning && '[&>div]:bg-amber-500')}
                  />

                  {/* Footer: remaining + daily rate */}
                  <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 mt-1">
                    <span className={cn('text-xs font-medium', isOver ? 'text-red-500' : 'text-primary')}>
                      {isOver
                        ? `⚠️ Over ${formatRupiah(spent - b.amount)}`
                        : `✓ Sisa ${formatRupiah(remaining)}`
                      }
                    </span>
                    {b.amount > 0 && daysLeft !== null && !isOver && remaining > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ~{formatRupiah(Math.round(remaining / daysLeft))}/hari ({daysLeft}h lagi)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
