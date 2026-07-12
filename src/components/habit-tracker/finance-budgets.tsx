'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Target, Plus, Edit3, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRupiah } from './finance-types';
import type { BudgetItem, DashboardData } from './finance-types';

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
  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Atur budget pengeluaran per kategori per bulan</p>
        <Button size="sm" onClick={onAddBudget}>
          <Plus className="h-4 w-4 mr-1" />
          Tambah Budget
        </Button>
      </div>

      {budgets.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-muted-foreground">
            <Target className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Belum ada budget</p>
            <p className="text-xs mt-1">Atur budget per kategori untuk memantau pengeluaran</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {budgets.map(b => {
            const meta = getCategoryMeta(b.category);
            const dashboardBudget = dashboardData?.budgetStatus.find(db2 => db2.id === b.id);
            const spent = dashboardBudget?.spent || 0;
            const pct = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
            const isOver = pct > 100;
            const remaining = Math.max(0, b.amount - spent);

            // Calculate remaining days in the selected month
            const [bYear, bMonth] = selectedMonth.split('-').map(Number);
            const totalDaysInMonth = new Date(bYear, bMonth, 0).getDate();
            const now = new Date();
            const jakartaNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 7 * 60 * 60000);
            const isCurrentMonth = jakartaNow.getFullYear() === bYear && (jakartaNow.getMonth() + 1) === bMonth;
            const daysLeft = isCurrentMonth ? Math.max(1, totalDaysInMonth - jakartaNow.getDate() + 1) : null;

            return (
              <Card key={b.id} className={cn('transition-colors group', isOver && 'border-red-300 dark:border-red-800')}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-2xl shrink-0">{meta.emoji}</div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold truncate">{b.category}</h3>
                        <p className="text-[10px] text-muted-foreground capitalize">{b.period === 'monthly' ? 'Per Bulan' : 'Per Minggu'}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => onEditBudget(b)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-500"
                        onClick={() => onDeleteBudget(b.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Budget</span>
                      <span className="font-semibold">{formatRupiah(b.amount)}</span>
                    </div>
                    <div className="flex justify-between text-xs gap-2">
                      <span className="text-muted-foreground shrink-0">Terpakai</span>
                      <span className={cn('font-semibold text-right min-w-0 truncate', isOver ? 'text-red-500' : 'text-foreground')}>
                        {formatRupiah(spent)} ({Math.min(pct, 999)}%)
                      </span>
                    </div>
                    <Progress
                      value={Math.min(pct, 100)}
                      className={cn('h-2.5', isOver && '[&>div]:bg-red-500', !isOver && pct > 80 && '[&>div]:bg-amber-500')}
                    />
                    <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-xs">
                      <span className={cn(isOver ? 'text-red-500 font-medium' : 'text-primary')}>
                        {isOver ? `Over ${formatRupiah(spent - b.amount)}` : `Sisa ${formatRupiah(remaining)}`}
                      </span>
                      {b.amount > 0 && daysLeft !== null && !isOver && remaining > 0 && (
                        <span className="text-muted-foreground">
                          ~{formatRupiah(remaining / daysLeft)}/hari ({daysLeft}h)
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}