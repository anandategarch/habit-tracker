'use client';

// components/habit-tracker/finance-budgets.tsx — sub-tab "Budget" Finance.
//
// - Ringkasan atas: total budget vs pengeluaran bulan terpilih (dari prop
//   budgets + dashboardData.monthExpense) + tombol "Budget Baru".
// - Grid kartu budget (1/2/3 kolom) — div.premium-card.premium-card-sheen
//   (BUKAN <Card> — anti-pattern cascade worklog 2-c):
//     avatar emoji kategori squircle tint · nama · badge periode ·
//     Progress (premium-progress-fill otomatis dari ui/progress) ·
//     nominal spent/amount/remaining (emerald/rose tabular-nums) ·
//     tombol edit/hapus (stopPropagation).
// - KLIK BODY KARTU → openFinanceFocus({ category }) — deep-link 1-klik ke
//   sub-tab Transaksi terfilter kategori (worklog 4-b).
// - Hapus: AlertDialog konfirmasi lokal (pattern FIX-5/6-b — semua aksi
//   destruktif wajib konfirmasi) → onDeleteBudget(id).

import { useMemo, useState } from 'react';
import { Pencil, Plus, Target, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAppStore } from '@/store/app-store';
import { formatRupiah, monthLabel } from './finance-types';
import { tintFromColor } from '@/lib/finance-helpers';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';
import type { BudgetItem, DashboardData } from './finance-types';

interface FinanceBudgetsProps {
  budgets: BudgetItem[];
  dashboardData: DashboardData | null;
  selectedMonth: string;
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
  onAddBudget: () => void;
  onEditBudget: (b: BudgetItem) => void;
  onDeleteBudget: (id: string) => void | Promise<void>;
}

function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, Math.round(pct)));
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
  const openFinanceFocus = useAppStore(s => s.openFinanceFocus);
  // Konfirmasi hapus lokal — handler delete di hook tidak punya dialog
  // sendiri (beda dengan transaksi), jadi state konfirmasi ada di sini.
  const [pendingDelete, setPendingDelete] = useState<BudgetItem | null>(null);

  // Defensive: prop budgets dijamin array oleh kontrak, guard tetap dipasang
  // supaya envelope/undefined runtime tidak pernah crash render.
  const list = useMemo(
    () => (Array.isArray(budgets) ? budgets : []),
    [budgets]
  );

  const totalAmount = useMemo(() => list.reduce((s, b) => s + (b.amount ?? 0), 0), [list]);
  const totalSpent = useMemo(() => list.reduce((s, b) => s + (b.spent ?? 0), 0), [list]);
  const summaryPct = totalAmount > 0 ? clampPct((totalSpent / totalAmount) * 100) : 0;

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    void onDeleteBudget(id);
  };

  return (
    <div className="space-y-3 mt-4">
      {/* ── Header + ringkasan ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span className="chip-icon chip-teal h-7 w-7" aria-hidden="true">
              <Target className="h-3.5 w-3.5" />
            </span>
            Budget {monthLabel(selectedMonth)}
          </h3>
        </div>
        <Button size="sm" className="h-9 btn-primary-gradient anim-press shrink-0" onClick={onAddBudget}>
          <Plus className="h-4 w-4" /> Budget Baru
        </Button>
      </div>

      {list.length > 0 && (
        <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger">
          <div className="grid grid-cols-3 gap-2 items-end">
            <div className="min-w-0">
              <p className="premium-label">Total Budget</p>
              <p className="premium-stat text-base sm:text-lg truncate">{formatRupiah(totalAmount)}</p>
            </div>
            <div className="min-w-0">
              <p className="premium-label">Terpakai</p>
              <p className="premium-stat text-base sm:text-lg truncate text-rose-600 dark:text-rose-400">
                {formatRupiah(totalSpent)}
              </p>
            </div>
            <div className="min-w-0 text-right">
              <p className="premium-label">Sisa</p>
              <p
                className={cn(
                  'premium-stat text-base sm:text-lg truncate',
                  totalAmount - totalSpent >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                )}
              >
                {formatRupiah(totalAmount - totalSpent)}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Progress
              value={summaryPct}
              className={cn('h-2 flex-1', summaryPct >= 100 && '[&_[data-slot=progress-indicator]]:bg-destructive')}
            />
            <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
              {summaryPct}% terpakai
            </span>
          </div>
          {dashboardData && dashboardData.monthExpense > 0 && (
            <p className="text-[11px] text-muted-foreground mt-2">
              Pengeluaran bulan ini {formatRupiah(dashboardData.monthExpense)}
              {dashboardData.topCategory ? ` · terbesar: ${dashboardData.topCategory.category}` : ''}
            </p>
          )}
        </div>
      )}

      {/* ── Grid kartu budget / empty state ── */}
      {list.length === 0 ? (
        <div className="premium-card rounded-2xl">
          <div className="premium-empty min-h-[16rem]">
            <div className="premium-empty-orb" aria-hidden="true">
              <Target className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold">Belum ada budget</p>
            <p className="text-xs text-muted-foreground">
              Tetapkan batas belanja per kategori agar pengeluaran terpantau.
            </p>
            <Button size="sm" className="h-8 text-xs mt-1 btn-primary-gradient" onClick={onAddBudget}>
              <Plus className="h-3.5 w-3.5" /> Buat Budget Pertama
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map((b, idx) => {
            const meta = getCategoryMeta(b.category ?? '');
            const pct = clampPct(b.pct ?? (b.amount > 0 ? (b.spent / b.amount) * 100 : 0));
            const over = (b.pct ?? 0) >= 100 || b.spent >= b.amount;
            const remaining = (b.remaining ?? b.amount - b.spent);
            return (
              <div
                key={b.id}
                className="premium-card premium-card-sheen premium-card-hover rounded-2xl p-4 anim-stagger cursor-pointer"
                style={{ '--stagger': idx } as CSSProperties}
                role="button"
                tabIndex={0}
                aria-label={`Lihat transaksi kategori ${b.category}`}
                onClick={() => openFinanceFocus({ category: b.category })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openFinanceFocus({ category: b.category });
                  }
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="h-10 w-10 rounded-xl grid place-items-center text-base shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                      style={{ backgroundColor: tintFromColor(meta.color) }}
                      aria-hidden="true"
                    >
                      {meta.emoji}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{b.category}</p>
                      {/* M8: budget selalu bulanan (schema tanpa kolom period) —
                          label 'Target mingguan' tidak pernah benar (b.period
                          tidak pernah dikirim API). */}
                      <p className="text-[11px] text-muted-foreground">
                        Bulanan · {monthLabel(b.month || selectedMonth)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); onEditBudget(b); }}
                      aria-label={`Edit budget ${b.category}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setPendingDelete(b); }}
                      aria-label={`Hapus budget ${b.category}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Progress
                    value={pct}
                    className={cn('h-2 flex-1', over && '[&_[data-slot=progress-indicator]]:bg-destructive')}
                  />
                  <span
                    className={cn(
                      'text-[11px] font-semibold tabular-nums shrink-0',
                      over ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'
                    )}
                  >
                    {pct}%
                  </span>
                </div>

                <div className="mt-2.5 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      Terpakai <span className="font-semibold text-foreground tabular-nums">{formatRupiah(b.spent)}</span>
                      {' '}dari <span className="font-semibold tabular-nums">{formatRupiah(b.amount)}</span>
                    </p>
                    <p
                      className={cn(
                        'text-xs font-semibold tabular-nums mt-0.5',
                        remaining >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      )}
                    >
                      {remaining >= 0 ? `Sisa ${formatRupiah(remaining)}` : `Lewat ${formatRupiah(Math.abs(remaining))}`}
                    </p>
                  </div>
                  {over && (
                    <span className="chip-soft chip-soft-rose text-[10px] font-semibold shrink-0 px-2 py-1" title="Budget terlampaui">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      Terlampaui
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Konfirmasi hapus budget (pattern FIX-5/6-b) ── */}
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg grid place-items-center bg-destructive/10 text-destructive shrink-0" aria-hidden="true">
                <Trash2 className="h-3.5 w-3.5" />
              </span>
              Hapus Budget?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Budget <strong>{pendingDelete?.category}</strong> akan dihapus.
              Transaksi kategori ini tidak terpengaruh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive"
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
