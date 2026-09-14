'use client';

// components/habit-tracker/finance-daily-bars.tsx — grafik batang
// "Pengeluaran Harian" sub-tab Ringkasan (Task 49, PERDETAIL-HARIAN):
// satu batang per hari bulan terpilih (besarnya nominal, bukan intensitas
// warna — komplemen heatmap yang pola kalendernya).
//
// Fitur:
//  - Garis putus-putus AMBER = rata-rata pengeluaran harian bulan berjalan.
//  - Batang HARI INI disorot ring-primary + label tebal (bulan berjalan).
//  - Hari akhir pekan diberi label pudar (pola weekend cepat terbaca).
//  - Footer chip "Terboros" → drill-down transaksi tanggal itu.
//  - Klik batang → openFinanceFocus({date, txType:'expense'}) — primitive
//    navigasi yang sama dengan sel heatmap (CONNECTED APP).
//  - Bulan berjalan hanya menampilkan hari yang sudah lewat; bulan lampau
//    penuh. Lebar konten flex sehingga memenuhi layar; di layar sempit
//    bisa digeser horizontal (pola yang sama dengan heatmap).
//
// Data: prop byDay + dailyAvg dari query dashboard yang sudah dipakai
// Ringkasan (tanpa fetch baru).

import { useMemo } from 'react';
import { BarChart3, Flame } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { jakartaDateString } from '@/lib/jakarta-date';
import { dateFromYMD } from '@/lib/timezone';
import { compactRupiah, compactRupiahSafe, formatRupiah } from './finance-types';
import { formatDateShort } from '@/lib/finance-helpers';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';
import type { DashboardData } from './finance-types';

interface FinanceDailyBarsProps {
  byDay: NonNullable<DashboardData['byDay']>;
  selectedMonth: string;
  dailyAvg: number;
  stagger: number;
}

/** Tinggi zona batang (px) — konstanta supaya garis rata² bisa dihitung. */
const BAR_ZONE_REM = 8; // h-32
const LABEL_REM = 1; // h-4

export function FinanceDailyBars({
  byDay,
  selectedMonth,
  dailyAvg,
  stagger,
}: FinanceDailyBarsProps) {
  const openFinanceFocus = useAppStore(s => s.openFinanceFocus);

  const todayYmd = jakartaDateString();
  const isCurrentMonth = selectedMonth === todayYmd.slice(0, 7);
  const todayDay = isCurrentMonth ? Number(todayYmd.slice(8, 10)) : 0;

  const { days, max, biggest, noSpend, activeDays } = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysTotal = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const map = new Map<string, number>();
    for (const d of byDay) {
      const key = d.date.slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + (d.amount || 0));
    }
    const shown = isCurrentMonth ? Math.min(todayDay, daysTotal) : daysTotal;
    const out: Array<{
      day: number;
      key: string;
      amount: number;
      isWeekend: boolean;
      isToday: boolean;
    }> = [];
    let maxV = 0;
    let big: { day: number; key: string; amount: number } | null = null;
    let empty = 0;
    let active = 0;
    for (let day = 1; day <= shown; day += 1) {
      const key = `${selectedMonth}-${String(day).padStart(2, '0')}`;
      const amount = map.get(key) ?? 0;
      const dow = dateFromYMD(key).getUTCDay();
      if (amount > 0) {
        active += 1;
        if (amount > maxV) maxV = amount;
        if (!big || amount > big.amount) big = { day, key, amount };
      } else {
        empty += 1;
      }
      out.push({
        day,
        key,
        amount,
        isWeekend: dow === 0 || dow === 6,
        isToday: isCurrentMonth && day === todayDay,
      });
    }
    return { days: out, max: maxV, biggest: big, noSpend: empty, activeDays: active };
  }, [byDay, selectedMonth, isCurrentMonth, todayDay]);

  // Posisi vertikal garis rata² (fraksi dari tinggi zona batang, clamp 95%).
  const avgFrac = max > 0 ? Math.min(0.95, Math.max(0.02, dailyAvg / max)) : 0;
  const hasData = activeDays > 0;

  return (
    <section
      className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger"
      style={{ '--stagger': stagger } as CSSProperties}
      aria-label="Grafik pengeluaran harian bulan terpilih"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="chip-icon chip-teal h-8 w-8 shrink-0" aria-hidden="true">
              <BarChart3 className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold">Pengeluaran Harian</h3>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
            Rata² {compactRupiahSafe(dailyAvg)}/hari · {activeDays} hari belanja · {noSpend} hari kosong
          </p>
        </div>
      </div>

      {hasData ? (
        <>
          {/* Zona chart — scroll horizontal bila sempit (pola heatmap) */}
          <div
            className="overflow-x-auto scrollbar-hide"
            role="img"
            aria-label={days
              .map(
                d =>
                  `${d.day}: ${d.amount > 0 ? formatRupiah(d.amount) : 'tanpa belanja'}${d.isToday ? ' (hari ini)' : ''}`,
              )
              .join('; ')}
          >
            <div className="relative flex items-end min-w-full w-max">
              {days.map(d => {
                const pct = d.amount > 0 ? Math.max(3, Math.round((d.amount / max) * 100)) : 0;
                const label =
                  d.amount > 0
                    ? `${d.day} — ${formatRupiah(d.amount)}${d.isToday ? ' (hari ini)' : ''} — lihat transaksi`
                    : `${d.day} — tanpa belanja`;
                return (
                  <button
                    key={d.key}
                    type="button"
                    title={label}
                    aria-label={label}
                    onClick={() => openFinanceFocus({ date: d.key, txType: 'expense' })}
                    className="flex flex-1 min-w-[9px] flex-col items-center cursor-pointer rounded-md pt-1 pb-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 hover:bg-muted/40 transition-colors"
                  >
                    {/* Zona batang — tinggi tetap supaya garis rata² presisi */}
                    <span className="flex h-32 w-full items-end justify-center" aria-hidden="true">
                      {d.amount > 0 ? (
                        <span
                          className={cn(
                            'w-full max-w-[16px] rounded-t-[4px] bg-gradient-to-t from-teal-600 to-teal-400 transition-[height] duration-300',
                            d.isToday && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                          )}
                          style={{ height: `${pct}%` }}
                        />
                      ) : (
                        <span
                          className={cn(
                            'h-[3px] w-full max-w-[16px] rounded-full',
                            d.isToday ? 'bg-primary/60' : 'bg-muted'
                          )}
                        />
                      )}
                    </span>
                    <span className="flex h-4 w-full items-center justify-center" aria-hidden="true">
                      <span
                        className={cn(
                          'text-[8px] leading-none tabular-nums',
                          d.isToday
                            ? 'font-bold text-primary'
                            : d.isWeekend
                              ? 'text-muted-foreground/60'
                              : 'text-muted-foreground'
                        )}
                      >
                        {d.day}
                      </span>
                    </span>
                  </button>
                );
              })}

              {/* Garis rata-rata harian — amber putus-putus */}
              <span
                className="pointer-events-none absolute left-0 right-0 border-t-2 border-dashed border-amber-500/70"
                style={{
                  bottom: `calc(${LABEL_REM}rem + ${avgFrac * BAR_ZONE_REM}rem)`,
                }}
                aria-hidden="true"
              >
                <span className="absolute -top-2 left-0 rounded-full bg-amber-500/15 px-1.5 py-px text-[8px] font-semibold text-amber-700 dark:text-amber-400 backdrop-blur-sm">
                  rata²
                </span>
              </span>
            </div>
          </div>

          {/* Footer: hari terboros (drill-down) + legenda garis rata² */}
          <div className="mt-2.5 flex items-center justify-between gap-2">
            {biggest ? (
              <button
                type="button"
                onClick={() => openFinanceFocus({ date: biggest.key, txType: 'expense' })}
                className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-[10px] font-medium text-rose-700 dark:text-rose-400 tabular-nums cursor-pointer transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                aria-label={`Hari terboros ${formatDateShort(biggest.key)} ${formatRupiah(biggest.amount)} — lihat transaksinya`}
              >
                <Flame className="h-3 w-3 shrink-0" aria-hidden="true" />
                Terboros {formatDateShort(biggest.key)} · {compactRupiah(biggest.amount)}
              </button>
            ) : (
              <span />
            )}
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="w-3.5 border-t-2 border-dashed border-amber-500/70" aria-hidden="true" />
              rata² harian
            </span>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground py-3">
          Belum ada pengeluaran bulan ini — catat transaksi untuk melihat pola harianmu.
        </p>
      )}
    </section>
  );
}
