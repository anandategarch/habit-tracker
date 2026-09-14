'use client';

// components/habit-tracker/finance-today-card.tsx — kartu "Hari Ini" di
// sub-tab Ringkasan (Task 49, PERDETAIL-HARIAN): jawaban langsung untuk
// "hari ini spend berapa" — total pengeluaran & pemasukan hari ini,
// mini-daftar transaksi hari ini, perbandingan vs rata-rata harian,
// sisa anggaran per hari ( allowances ala money-manager), dan streak
// hari tanpa belanja saat kosong.
//
// REUSE (prinsip CONNECTED APP — tidak ada endpoint/kontrak baru):
//  - Data: GET /api/finance/daily-recap?date=<hari ini Jakarta> — endpoint
//    yang sudah ada sejak lama tapi belum pernah dikonsumsi FE; kini jadi
//    sumber resmi kartu ini. Query key ['finance','daily-recap',ymd] ikut
//    ter-invalidasi oleh invalidateQueries(['finance']) di mutations CRUD
//    transaksi → kartu selalu segar setelah catat/edit/hapus.
//  - Navigasi: openFinanceFocus({date, txType}) (drill-down transaksi hari
//    itu / kategori itu) + openFinanceSubTab('budgets') — primitive yang
//    sama dengan sel heatmap & baris Terakhir Transaksi.
//  - Angka bulanan (dailyAvg, budget) dari prop dashboardData — query yang
//    sudah dipakai Ringkasan (cache terbagi, tanpa fetch tambahan).
//
// Hanya dirender saat bulan terpilih = bulan berjalan (Jakarta) — "hari ini"
// tidak bermakna pada bulan lampau; komponen lain tetap tampil normal.

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  ChevronRight,
  Flame,
  Plus,
  Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import { jakartaDateString } from '@/lib/jakarta-date';
import { dateFromYMD } from '@/lib/timezone';
import { format } from '@/lib/date-utils';
import { compactRupiahSafe, formatRupiah } from './finance-types';
import { formatDateShort, tintFromColor } from '@/lib/finance-helpers';
import { CountUpRupiah } from './count-up-rupiah';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';
import type { DashboardData, Transaction } from './finance-types';

interface FinanceTodayCardProps {
  dashboardData: DashboardData;
  selectedMonth: string;
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
  /** Membuka dialog transaksi baru tipe pengeluaran (prefill hari ini). */
  onQuickAddExpense: () => void;
}

interface DailyRecap {
  transactions: Transaction[];
  totalExpense: number;
  totalIncome: number;
}

const MAX_ROWS = 3;

function daysInMonthOf(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  if (m === 2) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return leap ? 29 : 28;
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

export function FinanceTodayCard({
  dashboardData,
  selectedMonth,
  getCategoryMeta,
  onQuickAddExpense,
}: FinanceTodayCardProps) {
  const openFinanceFocus = useAppStore(s => s.openFinanceFocus);
  const openFinanceSubTab = useAppStore(s => s.openFinanceSubTab);

  // BUGHUNT-54 (3-a #8): todayYmd dulu dihitung per-render → tab yang terbuka
  // lewat tengah malam Jakarta membeku di kemarin (tanggal, streak, budget
  // hint, query key). Kini state yang diperbarui interval 60 detik — pola
  // yang sama dengan header tanggal page.tsx; setState nilai sama = no-op.
  const [todayYmd, setTodayYmd] = useState(() => jakartaDateString());
  useEffect(() => {
    const update = () => setTodayYmd(jakartaDateString());
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);
  const isCurrentMonth = selectedMonth === todayYmd.slice(0, 7);

  const { data: recap, isLoading } = useQuery<DailyRecap>({
    queryKey: ['finance', 'daily-recap', todayYmd],
    queryFn: async () => {
      const res = await fetch(`/api/finance/daily-recap?date=${todayYmd}`);
      if (!res.ok) throw new Error('Gagal memuat rekap harian');
      return res.json();
    },
    enabled: isCurrentMonth,
    staleTime: 15_000,
    retry: 1,
  });

  const todayExpense = recap?.totalExpense ?? 0;
  const todayIncome = recap?.totalIncome ?? 0;
  const txs = useMemo(
    () => (Array.isArray(recap?.transactions) ? recap.transactions : []),
    [recap],
  );

  const dailyAvg = dashboardData?.dailyAvg ?? 0;

  // Delta vs rata-rata harian bulan berjalan (mis. "62% di bawah rata²").
  const avgDelta = useMemo(() => {
    if (dailyAvg <= 0) return null;
    const diff = todayExpense - dailyAvg;
    const pct = Math.round((todayExpense / dailyAvg) * 100);
    if (todayExpense === 0) {
      return { tone: 'good' as const, text: 'Belum belanja hari ini — pertahankan' };
    }
    if (diff <= 0) {
      return { tone: 'good' as const, text: `${pct}% dari rata-rata harian` };
    }
    return { tone: 'bad' as const, text: `+${formatRupiah(diff)} di atas rata-rata (${pct}%)` };
  }, [dailyAvg, todayExpense]);

  // Sisa anggaran per hari: (budget − terpakai) ÷ hari tersisa (hari ini
  // ikut dihitung). Ala fitur "daily allowance" Money Manager — kasih tahu
  // user berapa aman dibelanjakan per hari sampai akhir bulan.
  const budgetHint = useMemo(() => {
    const budgetTotal = dashboardData?.budgetTotal ?? 0;
    if (budgetTotal <= 0 || !isCurrentMonth) return null;
    const spent = dashboardData?.budgetSpent ?? 0;
    const remaining = budgetTotal - spent;
    const dayNum = Number(todayYmd.slice(8, 10));
    const daysTotal = daysInMonthOf(selectedMonth);
    const daysLeft = Math.max(1, daysTotal - dayNum + 1);
    if (remaining <= 0) {
      return {
        tone: 'bad' as const,
        text: `Budget bulan terlampaui ${compactRupiahSafe(Math.abs(remaining))}`,
      };
    }
    const allowance = remaining / daysLeft;
    return {
      tone: (allowance >= dailyAvg ? 'good' : 'warn') as 'good' | 'warn',
      text:
        `Masih aman ${compactRupiahSafe(allowance)}/hari · ${daysLeft} hari tersisa`,
    };
  }, [dashboardData, isCurrentMonth, todayYmd, selectedMonth, dailyAvg]);

  // Streak hari tanpa belanja (dari byDay bulan berjalan, dihitung mundur
  // dari hari ini; batas bawah wajar: awal bulan).
  const noSpendStreak = useMemo(() => {
    const map = new Map(
      (dashboardData?.byDay ?? []).map(d => [d.date.slice(0, 10), d.amount]),
    );
    if (map.get(todayYmd)) return 0; // hari ini ada belanja → streak putus
    const dayNum = Number(todayYmd.slice(8, 10));
    let streak = 0;
    for (let d = dayNum; d >= 1; d -= 1) {
      const key = `${selectedMonth}-${String(d).padStart(2, '0')}`;
      if (map.get(key)) break;
      streak += 1;
    }
    return streak;
  }, [dashboardData, todayYmd, selectedMonth]);

  if (!isCurrentMonth) return null;

  const dateLabel = `${format(dateFromYMD(todayYmd), 'EEEE')}, ${formatDateShort(todayYmd)}`;
  const rows = txs.slice(0, MAX_ROWS);
  const restCount = txs.length - rows.length;
  const hasAnyTx = txs.length > 0;

  return (
    <section
      className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 premium-fade-up"
      aria-label="Ringkasan keuangan hari ini"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="chip-icon chip-teal h-8 w-8 shrink-0" aria-hidden="true">
            <CalendarCheck className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight">Hari Ini</h3>
            <p className="text-[11px] text-muted-foreground truncate">{dateLabel}</p>
          </div>
        </div>
        {hasAnyTx ? (
          <button
            type="button"
            onClick={() => openFinanceFocus({ date: todayYmd, txType: 'all' })}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium tabular-nums cursor-pointer transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            aria-label={`Lihat ${txs.length} transaksi hari ini`}
          >
            <Receipt className="h-3 w-3" aria-hidden="true" />
            {txs.length}
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </button>
        ) : (
          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">0 transaksi</span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-9 w-48 rounded-lg" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : !hasAnyTx ? (
        /* ── Empty state: belum ada transaksi hari ini ── */
        <div className="premium-empty min-h-[10.5rem]">
          <div className="premium-empty-orb" aria-hidden="true">
            <CalendarCheck className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold">Belum ada transaksi hari ini</p>
          {noSpendStreak >= 2 ? (
            <p className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
              {noSpendStreak} hari beruntun tanpa belanja
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Catat pengeluaran pertamamu hari ini</p>
          )}
          <Button
            size="sm"
            className="h-8 text-xs anim-press"
            onClick={onQuickAddExpense}
            aria-label="Catat pengeluaran hari ini"
          >
            <Plus className="h-3.5 w-3.5" />
            Catat pengeluaran
          </Button>
        </div>
      ) : (
        <>
          {/* ── Angka utama: pengeluaran hari ini (klik → drill-down) ── */}
          <button
            type="button"
            onClick={() => openFinanceFocus({ date: todayYmd, txType: 'expense' })}
            className="w-full rounded-xl p-3 text-left cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.99]"
            aria-label={`Pengeluaran hari ini ${formatRupiah(todayExpense)} — lihat transaksi pengeluaran hari ini`}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <ArrowDownRight className="h-3.5 w-3.5 text-rose-500 shrink-0" aria-hidden="true" />
              <p className="premium-label">Pengeluaran Hari Ini</p>
            </div>
            <p className="premium-stat text-2xl leading-tight">
              <CountUpRupiah amount={todayExpense} />
            </p>
            <div className="mt-1.5 flex items-center flex-wrap gap-1.5">
              {avgDelta && (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                    avgDelta.tone === 'good' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                    avgDelta.tone === 'bad' && 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                  )}
                >
                  {avgDelta.text}
                </span>
              )}
              {todayIncome > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                  <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                  +{compactRupiahSafe(todayIncome)} masuk
                </span>
              )}
            </div>
          </button>

          {/* ── Mini-daftar transaksi hari ini ── */}
          <div className="mt-2 space-y-1">
            {rows.map((tx, idx) => {
              const meta = getCategoryMeta(tx.category ?? '');
              const isIncome = tx.type === 'income';
              const isTransfer = tx.type === 'transfer';
              return (
                <button
                  key={tx.id ?? `${tx.category}-${idx}`}
                  type="button"
                  className="premium-list-item w-full px-2.5! py-2! text-left cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  style={{ '--stagger': idx } as CSSProperties}
                  onClick={() =>
                    openFinanceFocus({
                      category: tx.category || undefined,
                      date: todayYmd,
                      txType: isTransfer ? 'all' : isIncome ? 'income' : 'expense',
                    })
                  }
                  aria-label={`Lihat transaksi ${tx.description || tx.category} hari ini`}
                >
                  <span
                    className="h-8 w-8 rounded-lg grid place-items-center text-sm shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                    style={{ backgroundColor: tintFromColor(meta.color) }}
                    aria-hidden="true"
                  >
                    {meta.emoji}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">
                      {tx.description || tx.category}
                    </span>
                    <span className="block text-[11px] text-muted-foreground truncate">
                      {tx.category}
                      {tx.sourceName ? ` · ${tx.sourceName}` : ''}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums shrink-0',
                      isTransfer
                        ? 'text-violet-600 dark:text-violet-400'
                        : isIncome
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                    )}
                  >
                    {isTransfer ? '' : isIncome ? '+' : '−'}{formatRupiah(tx.amount)}
                  </span>
                </button>
              );
            })}
            {restCount > 0 && (
              <button
                type="button"
                className="w-full px-2.5 py-1.5 text-left text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 rounded-lg"
                onClick={() => openFinanceFocus({ date: todayYmd, txType: 'all' })}
                aria-label={`Lihat ${restCount} transaksi hari ini lainnya`}
              >
                +{restCount} transaksi lainnya hari ini
                <ChevronRight className="inline h-3 w-3 ml-0.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* ── Strip budget harian (klik → sub-tab Budget) ── */}
          {budgetHint && (
            <button
              type="button"
              onClick={() => openFinanceSubTab('budgets')}
              className={cn(
                'mt-2.5 flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] leading-snug transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                budgetHint.tone === 'good' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                budgetHint.tone === 'warn' && 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                budgetHint.tone === 'bad' && 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
              )}
              role="status"
            >
              <span className="min-w-0 flex-1">{budgetHint.text}</span>
              <span className="flex shrink-0 items-center gap-0.5 font-semibold">
                Budget
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
              </span>
            </button>
          )}
        </>
      )}
    </section>
  );
}
