'use client';

// components/habit-tracker/dashboard-finance-overview.tsx — kartu "Keuangan
// Bulan Ini" di Dashboard. Wiring 1-klik (4-a): tombol header → sub-tab
// Ringkasan (overview); tile Anggaran → sub-tab Anggaran (budgets).
// Semua nominal diformat formatRupiah (lib/money).

import {
  ArrowUpRight,
  PieChart,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { formatRupiah } from '@/lib/money';
import { cn } from '@/lib/utils';
import { ChartInfo } from './dashboard-helpers';
import type { FinanceOverviewData } from './dashboard-types';

function StatTile({
  label,
  value,
  valueClass,
  icon: Icon,
  chipClass,
  tileClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
  icon: typeof TrendingUp;
  chipClass: string;
  tileClass: string;
}) {
  return (
    <div className={cn('rounded-xl border p-3.5', tileClass)}>
      <div className="flex items-center gap-2">
        <span className={cn('chip-soft h-7 w-7 justify-center', chipClass)} aria-hidden="true">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="premium-label">{label}</span>
      </div>
      <p className={cn('premium-stat mt-2 truncate text-base sm:text-lg', valueClass)}>{value}</p>
    </div>
  );
}

export function FinanceOverviewCard({ data }: { data: FinanceOverviewData }) {
  const openFinanceSubTab = useAppStore((s) => s.openFinanceSubTab);

  const income = Number(data?.monthIncome) || 0;
  const expense = Number(data?.monthExpense) || 0;
  const net = Number(data?.monthNet) || 0;
  const budgetTotal = Number(data?.budgetTotal) || 0;
  const budgetSpent = Number(data?.budgetSpent) || 0;

  const budgetPct =
    budgetTotal > 0 ? Math.min(100, Math.round((budgetSpent / budgetTotal) * 100)) : 0;
  const budgetExceeded = budgetTotal > 0 && budgetSpent > budgetTotal;
  const budgetWarning = !budgetExceeded && budgetTotal > 0 && budgetPct >= 80;

  return (
    <section aria-label="Keuangan bulan ini">
      <div className="premium-card premium-card-sheen rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="premium-label flex items-center gap-2">
            <span className="chip-soft chip-soft-teal h-9 w-9 justify-center" aria-hidden="true">
              <Wallet className="h-4.5 w-4.5" />
            </span>
            Keuangan Bulan Ini
            <ChartInfo text="Ringkasan arus kas dan pemakaian anggaran bulan ini. Klik tombol di kanan untuk membuka tab Keuangan." />
          </h3>
          {/* ONE-CLICK (4-a): buka sub-tab Ringkasan keuangan. */}
          <button
            type="button"
            onClick={() => openFinanceSubTab('overview')}
            aria-label="Lihat ringkasan keuangan bulan ini"
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Pemasukan"
            value={formatRupiah(income)}
            icon={TrendingUp}
            chipClass="chip-soft-teal"
            tileClass="border-emerald-500/20 bg-emerald-500/5 dark:border-emerald-400/20 dark:bg-emerald-400/10"
          />
          <StatTile
            label="Pengeluaran"
            value={formatRupiah(expense)}
            icon={TrendingDown}
            chipClass="chip-soft-rose"
            tileClass="border-rose-500/20 bg-rose-500/5 dark:border-rose-400/20 dark:bg-rose-400/10"
          />
          <StatTile
            label="Selisih"
            value={`${net >= 0 ? '+' : '−'}${formatRupiah(Math.abs(net))}`}
            valueClass={net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}
            icon={Wallet}
            chipClass="chip-soft-teal"
            tileClass="border-border/70 bg-muted/40 dark:border-border/70"
          />

          {/* ONE-CLICK (4-a): tile Status Anggaran → sub-tab Anggaran. */}
          <button
            type="button"
            onClick={() => openFinanceSubTab('budgets')}
            aria-label="Lihat detail anggaran bulan ini"
            className={cn(
              'cursor-pointer rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              budgetExceeded
                ? 'border-destructive/30 bg-destructive/5 dark:border-destructive/40'
                : 'border-amber-500/20 bg-amber-500/5 hover:border-primary/30 hover:bg-muted/50 dark:border-amber-400/20 dark:bg-amber-400/10'
            )}
          >
            <div className="flex items-center gap-2">
              <span className="chip-soft chip-soft-amber h-7 w-7 justify-center" aria-hidden="true">
                <PieChart className="h-3.5 w-3.5" />
              </span>
              <span className="premium-label">Anggaran</span>
            </div>
            <p className="premium-stat mt-2 text-base sm:text-lg">
              {budgetTotal > 0 ? `${budgetPct}%` : '—'}
            </p>
            {budgetTotal > 0 ? (
              <>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn(
                      'block h-full rounded-full',
                      budgetExceeded ? 'bg-destructive' : 'premium-progress-fill'
                    )}
                    style={{ width: `${budgetPct}%` }}
                  />
                </span>
                <p
                  className={cn(
                    'mt-1.5 text-xs',
                    budgetExceeded
                      ? 'font-semibold text-destructive'
                      : budgetWarning
                        ? 'font-semibold text-amber-600 dark:text-amber-400'
                        : 'text-muted-foreground'
                  )}
                >
                  {budgetExceeded
                    ? `Lewat ${formatRupiah(budgetSpent - budgetTotal)} dari anggaran`
                    : budgetWarning
                      ? 'Hampir habis — hati-hati'
                      : `Terpakai ${formatRupiah(budgetSpent)} dari ${formatRupiah(budgetTotal)}`}
                </p>
              </>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Belum ada anggaran bulan ini
              </p>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
