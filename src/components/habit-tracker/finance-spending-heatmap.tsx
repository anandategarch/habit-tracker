'use client';

// components/habit-tracker/finance-spending-heatmap.tsx — heatmap pengeluaran
// harian bulan terpilih (grid kalender, skala intensitas Aurora teal).
// Affordance: tombol "Lihat transaksi bulan ini" → sub-tab Transaksi
// (openFinanceSubTab('transactions')).

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app-store';
import { dateFromYMD, jakartaDateString } from '@/lib/timezone';
import type { AppSettings } from '@/lib/settings-types';
import { formatRupiah, compactRupiah } from './finance-types';
import { cn } from '@/lib/utils';

// Indeks 0 = Minggu (getUTCDay) — dirotasi mengikuti weekStart pengguna.
const DOW_BASE = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export interface HeatmapDay {
  date: string; // 'yyyy-MM-dd'
  amount: number;
}

export function SpendingHeatmap({
  byDay,
  selectedMonth,
}: {
  byDay: HeatmapDay[];
  selectedMonth: string;
}) {
  const openFinanceSubTab = useAppStore(s => s.openFinanceSubTab);
  // CONNECTED-APP: sel hari → transaksi tanggal itu.
  const openFinanceFocus = useAppStore(s => s.openFinanceFocus);
  // Task 49 (PERDETAIL-HARIAN): kunci hari ini Jakarta — sel hari ini
  // diberi ring primary.
  const todayYmd = jakartaDateString();

  // BUGHUNT-47 (47-b #3): weekStart pengguna dihormati (kalender habit sudah
  // mengikuti setting ini; heatmap dulu hardcode Senin-awal).
  const { data: settings = null } = useQuery<AppSettings | null>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
  });
  const weekStartsOn = settings?.weekStart === 0 ? 0 : 1;
  const DOW_LABELS = useMemo(
    () => [...DOW_BASE.slice(weekStartsOn), ...DOW_BASE.slice(0, weekStartsOn)],
    [weekStartsOn]
  );

  const { cells, maxAmount, activeDays, monthTitle } = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    // Kolom = minggu (mengikuti weekStart pengguna — konsisten kalender).
    const firstDow = (dateFromYMD(`${selectedMonth}-01`).getUTCDay() + 7 - weekStartsOn) % 7;
    const map = new Map<string, number>();
    let max = 0;
    let active = 0;
    for (const d of byDay) {
      const key = d.date.slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + (d.amount || 0));
    }
    const out: Array<{ key: string; day: number; amount: number; week: number; dow: number }> = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${selectedMonth}-${String(day).padStart(2, '0')}`;
      const amount = map.get(key) ?? 0;
      if (amount > 0) active++;
      if (amount > max) max = amount;
      const cellIdx = firstDow + day - 1;
      out.push({
        key,
        day,
        amount,
        week: Math.floor(cellIdx / 7),
        dow: cellIdx % 7,
      });
    }
    const title = `${MONTHS_ID[(m || 1) - 1] ?? ''} ${y}`;
    return { cells: out, maxAmount: max, activeDays: active, monthTitle: title };
  }, [byDay, selectedMonth, weekStartsOn]);

  const weeks = useMemo(() => {
    const count = cells.length > 0 ? cells[cells.length - 1].week + 1 : 0;
    return Array.from({ length: count }, (_, w) => cells.filter(c => c.week === w));
  }, [cells]);

  const level = (amount: number): string => {
    if (amount <= 0) return 'bg-muted/50 dark:bg-muted/30';
    const ratio = maxAmount > 0 ? amount / maxAmount : 0;
    if (ratio < 0.25) return 'bg-teal-200/70 dark:bg-teal-900/50';
    if (ratio < 0.5) return 'bg-teal-300/80 dark:bg-teal-800/60';
    if (ratio < 0.75) return 'bg-teal-400/90 dark:bg-teal-700/70';
    return 'bg-teal-600 dark:bg-teal-500';
  };

  const textColor = (amount: number): string => {
    if (amount <= 0) return 'text-muted-foreground';
    const ratio = maxAmount > 0 ? amount / maxAmount : 0;
    return ratio >= 0.75 ? 'text-white dark:text-teal-50' : 'text-foreground/80 dark:text-teal-50';
  };

  return (
    <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Heatmap Pengeluaran</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {monthTitle} · {activeDays} hari aktif · terbesar {compactRupiah(maxAmount)}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs shrink-0 anim-press"
          onClick={() => openFinanceSubTab('transactions')}
          aria-label="Lihat transaksi bulan ini"
        >
          Lihat transaksi <CalendarDays className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* BUGHUNT-47 (47-b #8): kondisi empty-state lama (`weeks.length === 0`)
          tidak pernah tercapai — struktur kalender selalu ≥4 kolom minggu.
          Cek activeDays (ada pengeluaran atau tidak) sebagai gantinya. */}
      {weeks.length === 0 || activeDays === 0 ? (
        <p className="text-xs text-muted-foreground py-3">Belum ada data pengeluaran bulan ini.</p>
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            <div className="flex flex-col gap-1 shrink-0 pr-0.5" aria-hidden="true">
              {DOW_LABELS.map(d => (
                <span key={d} className="h-7 text-[9px] text-muted-foreground leading-7 text-right w-5">
                  {d}
                </span>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1 shrink-0">
                {Array.from({ length: 7 }, (_, di) => {
                  const cell = week.find(c => c.dow === di);
                  if (!cell) {
                    return <span key={di} className="h-7 w-7 rounded-lg" aria-hidden="true" />;
                  }
                  // Task 49 (PERDETAIL-HARIAN): sel HARI INI diberi ring
                  // primary supaya "hari ini" cepat ditemukan di pola kalender.
                  const isTodayCell = cell.key === todayYmd;
                  const title = cell.amount > 0
                    ? `${cell.day} — ${formatRupiah(cell.amount)}${isTodayCell ? ' (hari ini)' : ''}`
                    : `${cell.day} — tanpa pengeluaran${isTodayCell ? ' (hari ini)' : ''}`;
                  return (
                    /* CONNECTED-APP: sel hari → transaksi tanggal itu
                       (drill-down chart #10; dulu cuma tooltip). */
                    <button
                      type="button"
                      key={cell.key}
                      title={title}
                      onClick={() => openFinanceFocus({ date: cell.key, txType: 'expense' })}
                      aria-label={title}
                      className={cn(
                        'h-7 w-7 rounded-lg grid place-items-center text-[10px] font-semibold tabular-nums transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                        level(cell.amount),
                        cell.amount > 0 && 'hover:scale-105',
                        textColor(cell.amount),
                        isTodayCell && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                      )}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-1.5 mt-2">
            <span className="text-[10px] text-muted-foreground">Sedikit</span>
            <span className="h-2.5 w-2.5 rounded-sm bg-muted/50 dark:bg-muted/30" aria-hidden="true" />
            <span className="h-2.5 w-2.5 rounded-sm bg-teal-200/70 dark:bg-teal-900/50" aria-hidden="true" />
            <span className="h-2.5 w-2.5 rounded-sm bg-teal-300/80 dark:bg-teal-800/60" aria-hidden="true" />
            <span className="h-2.5 w-2.5 rounded-sm bg-teal-400/90 dark:bg-teal-700/70" aria-hidden="true" />
            <span className="h-2.5 w-2.5 rounded-sm bg-teal-600 dark:bg-teal-500" aria-hidden="true" />
            <span className="text-[10px] text-muted-foreground">Banyak</span>
          </div>
        </>
      )}
    </div>
  );
}
