'use client';

// components/habit-tracker/finance-detail-cashflow.tsx — sektor 1 detail
// Ringkasan: Arus Kas 6 Bulan (diekstrak verbatim dari
// finance-detail-sections.tsx, Task 71-i).
//
// Bar ganda 6 bulan (masuk vs keluar) + net; kolom bulan dapat diklik untuk
// berpindah bulan (CONNECTED-APP — dulu bulan terpilih hanya ditandai ring).

import { BarChart3, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { compactRupiah, monthLabel } from './finance-types';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';
import type { DashboardData } from './finance-types';
import { monthShort, type Stagger } from './finance-detail-utils';

export function CashflowTrendChart({
  trend,
  selectedMonth,
  stagger,
}: Stagger & { trend: NonNullable<DashboardData['cashflowTrend']>; selectedMonth: string }) {
  const openFinanceSubTab = useAppStore(s => s.openFinanceSubTab);
  // CONNECTED-APP: kolom bulan dapat diklik untuk berpindah bulan — dulu
  // bulan terpilih hanya ditandai ring tanpa cara memindahkannya dari chart.
  const setSelectedMonth = useAppStore(s => s.setSelectedMonth);
  const hasData = trend.some(m => m.income > 0 || m.expense > 0);
  const max = Math.max(1, ...trend.map(m => Math.max(m.income, m.expense)));

  return (
    <section
      className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger"
      style={{ '--stagger': stagger } as CSSProperties}
      aria-label="Tren arus kas 6 bulan"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="chip-icon chip-teal h-8 w-8 shrink-0" aria-hidden="true">
            <BarChart3 className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold">Arus Kas 6 Bulan</h3>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
          onClick={() => openFinanceSubTab('analysis')}
          aria-label="Buka analisis keuangan"
        >
          Analisis
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      {hasData ? (
        <>
          {/* Legend */}
          <div className="flex items-center gap-3 mb-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              Pemasukan
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" />
              Pengeluaran
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
              Selisih
            </span>
          </div>

          <div
            className="grid grid-cols-6 gap-1 sm:gap-2"
            role="img"
            aria-label={trend
              .map(m => `${monthLabel(m.month)}: masuk ${compactRupiah(m.income)}, keluar ${compactRupiah(m.expense)}, selisih ${compactRupiah(m.net)} — pilih bulan`)
              .join('; ')}
          >
            {trend.map(m => {
              const isSel = m.month === selectedMonth;
              const incomeH = m.income > 0 ? Math.max(4, Math.round((m.income / max) * 100)) : 0;
              const expenseH = m.expense > 0 ? Math.max(4, Math.round((m.expense / max) * 100)) : 0;
              return (
                <button
                  type="button"
                  key={m.month}
                  onClick={() => setSelectedMonth(m.month)}
                  aria-label={`Lihat bulan ${monthLabel(m.month)} — masuk ${compactRupiah(m.income)}, keluar ${compactRupiah(m.expense)}`}
                  aria-pressed={isSel}
                  className={cn(
                    'flex flex-col items-center rounded-xl pt-2 pb-1.5 min-w-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                    isSel && 'bg-primary/5 ring-1 ring-primary/25',
                    !isSel && 'hover:bg-muted/50'
                  )}
                >
                  <div className="w-full h-24 flex items-end justify-center gap-1" aria-hidden="true">
                    <div
                      className="w-[42%] max-w-3.5 rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all"
                      style={{ height: `${incomeH}%` }}
                    />
                    <div
                      className="w-[42%] max-w-3.5 rounded-t-md bg-gradient-to-t from-rose-600 to-rose-400 transition-all"
                      style={{ height: `${expenseH}%` }}
                    />
                  </div>
                  <p
                    className={cn(
                      'text-[10px] mt-1 truncate w-full text-center',
                      isSel ? 'font-bold text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {monthShort(m.month)}
                  </p>
                  <p
                    className={cn(
                      'text-[9px] tabular-nums truncate w-full text-center',
                      m.net > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : m.net < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-muted-foreground'
                    )}
                  >
                    {compactRupiah(m.net)}
                  </p>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground py-4 text-center">
          Belum ada transaksi dalam 6 bulan terakhir — catat pemasukan &amp;
          pengeluaran untuk melihat tren.
        </p>
      )}
    </section>
  );
}
