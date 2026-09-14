'use client';

// components/habit-tracker/finance-overview.tsx — sub-tab "Ringkasan" Finance.
//
// Struktur (worklog 2-c + 4-b; Task 42 PERDETAIL-FIN untuk sektor detail):
//  - Hero "TOTAL SALDO" (div.premium-hero.premium-hero-bubbles, klik →
//    sub-tab Transaksi) — CountUpRupiah besar + subteks arus kas bulan +
//    chip Pemasukan/Pengeluaran VERTIKAL (chip-icon + label di baris atas;
//    nominal premium-stat text-sm di baris sendiri — tidak ter-truncate di
//    400px) + strip Rata-rata harian / Proyeksi.
//  - Dashboard KPI (Task 40) — 4 kartu + insight strip.
//  - Arus Kas 6 Bulan (Task 42) — bar ganda masuk/keluar + selisih.
//  - Statistik Bulan (Task 42) — jumlah/rata-rata/terbesar/hari bersih.
//  - SourceBalance (komponen existing, self-contained + tombol Transfer;
//    konsumsi quickAddAction 'transfer' HANYA di situ — tidak diduplikasi
//    di sini).
//  - Top Kategori (Task 42) — top 5 + bar + chip MoM per kategori.
//  - Budget per Kategori (Task 42) — bar tone + sisa/lewat.
//  - Tagihan Mendatang (Task 42) — berulang ≤30 hari + terlambat.
//  - SpendingHeatmap (komponen existing — byDay dari dashboardData).
//  - "Terakhir Transaksi" (div.premium-card rounded-2xl) — baris
//    premium-list-item dengan avatar emoji kategori squircle tint; klik →
//    sub-tab Transaksi. Fallback defensif: bila endpoint last-done kosong,
//    pakai 5 transaksi terbaru bulan terpilih (props transactions).
//  - Empty state premium-empty bila bulan tanpa aktivitas.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  ChevronRight,
  Wallet,
} from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { SourceBalance } from './source-balance';
import { SpendingHeatmap } from './finance-spending-heatmap';
import { CountUpRupiah } from './count-up-rupiah';
import FinanceKpiDashboard from './finance-kpi-dashboard';
import {
  BudgetDetailList,
  CashflowTrendChart,
  CategoryTopList,
  MonthStatsGrid,
  UpcomingRecurringList,
} from './finance-detail-sections';
import { formatRupiah, monthLabel } from './finance-types';
import { tintFromColor, formatDateShort } from '@/lib/finance-helpers';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';
import type {
  DashboardData,
  LastDoneItem,
  Transaction,
  FundSource,
} from './finance-types';

interface FinanceOverviewProps {
  dashboardData: DashboardData;
  lastDoneData: LastDoneItem[];
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
  transactions: Transaction[];
  selectedMonth: string;
}

interface LastDoneRow {
  key: string;
  emoji: string;
  color: string;
  title: string;
  meta: string;
  amount: number | null;
  isIncome: boolean;
}

const MAX_LAST_DONE_ROWS = 5;

export default function FinanceOverview({
  dashboardData,
  lastDoneData,
  getCategoryMeta,
  transactions,
  selectedMonth,
}: FinanceOverviewProps) {
  const openFinanceSubTab = useAppStore(s => s.openFinanceSubTab);

  // Total saldo hero — query terpisah dengan unwrap `.sources` (defensif:
  // selalu jatuh ke 0 bila API gagal, tidak pernah crash).
  const { data: heroSources = [] } = useQuery<FundSource[]>({
    queryKey: ['finance', 'sources', 'overview'],
    queryFn: async () => {
      const res = await fetch('/api/finance/sources');
      if (!res.ok) return [];
      return (await res.json()).sources ?? [];
    },
    staleTime: 30_000,
  });
  const totalBalance = useMemo(
    () => heroSources.reduce((sum, s) => sum + (s?.balance ?? 0), 0),
    [heroSources]
  );

  // ── Baris "Terakhir Transaksi" ──────────────────────────────────────────
  // Prioritas: data endpoint last-done; fallback = 5 transaksi terbaru bulan
  // terpilih (render defensif — field LastDoneItem longgar).
  const lastDoneRows = useMemo<LastDoneRow[]>(() => {
    const fromApi = (Array.isArray(lastDoneData) ? lastDoneData : [])
      .filter((item) => item && (item.category || item.description))
      .map((item) => {
        const meta = getCategoryMeta(item.category ?? '');
        const amount = typeof item.amount === 'number' ? item.amount : null;
        const dateStr = item.lastDate ?? item.date;
        const metaParts = [item.category];
        if (typeof item.count === 'number' && item.count > 1) metaParts.push(`${item.count}×`);
        // H3: formatDateShort membaca komponen UTC (getUTCDate) — komponen
        // ISO Transaction.date = jam dinding Jakarta, jadi tanggal pendek cukup
        // diambil dari string mentahnya (YMD maupun ISO), TANPA jakartaDateKey
        // (+7 shift menggeser tanggal).
        if (dateStr) metaParts.push(formatDateShort(dateStr));
        return {
          key: item.id ?? `${item.category}-${dateStr ?? ''}`,
          emoji: item.emoji ?? meta.emoji,
          color: item.color ?? meta.color,
          title: item.description || item.category,
          meta: metaParts.filter(Boolean).join(' · '),
          amount,
          isIncome: item.type === 'income',
        };
      });
    if (fromApi.length > 0) return fromApi.slice(0, MAX_LAST_DONE_ROWS);

    const txs = Array.isArray(transactions) ? transactions : [];
    return [...txs]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, MAX_LAST_DONE_ROWS)
      .map((tx) => {
        const meta = getCategoryMeta(tx.category ?? '');
        const metaParts = [tx.category];
        if (tx.sourceName) metaParts.push(tx.sourceName);
        // H3: baca komponen UTC langsung dari ISO (lihat komentar atas).
        metaParts.push(formatDateShort(tx.date));
        return {
          key: tx.id,
          emoji: meta.emoji,
          color: meta.color,
          title: tx.description || tx.category,
          meta: metaParts.filter(Boolean).join(' · '),
          amount: tx.amount ?? null,
          isIncome: tx.type === 'income',
        };
      });
  }, [lastDoneData, transactions, getCategoryMeta]);

  const monthExpense = dashboardData?.monthExpense ?? 0;
  const monthIncome = dashboardData?.monthIncome ?? 0;
  const monthNet = dashboardData?.monthNet ?? monthIncome - monthExpense;
  const hasActivity =
    lastDoneRows.length > 0 ||
    monthExpense > 0 ||
    monthIncome > 0 ||
    (Array.isArray(transactions) && transactions.length > 0);

  return (
    <div className="space-y-4">
      {/* ── Hero Total Saldo (klik → sub-tab Transaksi) ── */}
      <button
        type="button"
        className="premium-hero premium-hero-bubbles w-full text-left p-4 sm:p-5 cursor-pointer premium-fade-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.99] transition-transform"
        onClick={() => openFinanceSubTab('transactions')}
        aria-label="Lihat semua transaksi bulan ini"
      >
        <div className="relative">
          <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-emerald-50/80">
            Total Saldo
          </p>
          <div className="mt-1.5 text-3xl sm:text-4xl font-extrabold text-emerald-50 drop-shadow-sm">
            <CountUpRupiah amount={totalBalance} />
          </div>
          <p className="mt-1.5 text-xs text-emerald-50/85">
            Arus kas {monthLabel(selectedMonth)}:{' '}
            <span className={cn('font-semibold tabular-nums', monthNet >= 0 ? 'text-emerald-50' : 'text-rose-100')}>
              {monthNet >= 0 ? '+' : '−'}{formatRupiah(Math.abs(monthNet))}
            </span>
          </p>

          {/* Chip Pemasukan/Pengeluaran — layout VERTIKAL supaya nominal
              panjang tidak ter-truncate di layar 400px (worklog 2-c). */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="rounded-xl bg-white/10 backdrop-blur-sm p-3 min-w-0">
              <div className="flex items-center gap-2">
                <span className="chip-icon chip-emerald h-7 w-7 shrink-0" aria-hidden="true">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-50/80">
                  Pemasukan
                </p>
              </div>
              <p className="premium-stat text-sm mt-1.5 text-emerald-50">
                {formatRupiah(monthIncome)}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-sm p-3 min-w-0">
              <div className="flex items-center gap-2">
                <span className="chip-icon chip-rose h-7 w-7 shrink-0" aria-hidden="true">
                  <ArrowDownRight className="h-3.5 w-3.5" />
                </span>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-50/80">
                  Pengeluaran
                </p>
              </div>
              <p className="premium-stat text-sm mt-1.5 text-emerald-50">
                {formatRupiah(monthExpense)}
              </p>
            </div>
          </div>

          {/* Strip Rata-rata harian / Proyeksi */}
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/15">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-emerald-50/70">
                Rata-rata harian
              </p>
              <p className="text-sm font-bold tabular-nums text-emerald-50">
                {formatRupiah(dashboardData?.dailyAvg ?? 0)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-emerald-50/70">
                Proyeksi bulan ini
              </p>
              <p className="text-sm font-bold tabular-nums text-emerald-50">
                {formatRupiah(dashboardData?.projection ?? 0)}
              </p>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-emerald-50/70 flex items-center gap-1">
            Lihat semua transaksi bulan ini
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </p>
        </div>
      </button>

      {/* ── Dashboard Keuangan KPI (Task 40, DASHBOARD-FIN) ── */}
      <FinanceKpiDashboard dashboardData={dashboardData} selectedMonth={selectedMonth} />

      {/* ── Arus Kas 6 Bulan (Task 42, PERDETAIL-FIN) ── */}
      <CashflowTrendChart
        trend={dashboardData?.cashflowTrend ?? []}
        selectedMonth={selectedMonth}
        stagger={1}
      />

      {/* ── Statistik Bulan (Task 42, PERDETAIL-FIN) ── */}
      <MonthStatsGrid dashboardData={dashboardData} selectedMonth={selectedMonth} stagger={2} />

      {/* ── Sumber Dana + Transfer (self-contained, konsumsi quickAdd
          'transfer' ada di SourceBalance — jangan duplikat) ── */}
      <SourceBalance />

      {/* ── Top Kategori + MoM (Task 42, PERDETAIL-FIN) ── */}
      <CategoryTopList dashboardData={dashboardData} stagger={3} />

      {/* ── Budget per Kategori (Task 42, PERDETAIL-FIN) ── */}
      <BudgetDetailList budgetDetail={dashboardData?.budgetDetail ?? []} stagger={4} />

      {/* ── Tagihan Mendatang (Task 42, PERDETAIL-FIN) ── */}
      <UpcomingRecurringList upcoming={dashboardData?.upcomingRecurring ?? []} stagger={5} />

      {/* ── Heatmap Pengeluaran ── */}
      <SpendingHeatmap
        byDay={dashboardData?.byDay ?? []}
        selectedMonth={selectedMonth}
      />

      {/* ── Terakhir Transaksi ── */}
      <div className="premium-card rounded-2xl anim-stagger" style={{ '--stagger': 6 } as CSSProperties}>
        <div className="flex items-center justify-between gap-2 p-4 pb-2 sm:p-5 sm:pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="chip-icon chip-amber h-8 w-8 shrink-0" aria-hidden="true">
              <Clock className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold">Terakhir Transaksi</h3>
          </div>
          <ButtonLikeLink onClick={() => openFinanceSubTab('transactions')} />
        </div>

        {hasActivity && lastDoneRows.length > 0 ? (
          <div className="px-2 pb-2 sm:px-3 sm:pb-3 space-y-1.5">
            {lastDoneRows.map((row, idx) => (
              <button
                key={row.key}
                type="button"
                className="premium-list-item w-full px-3! py-2.5! text-left cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                style={{ '--stagger': idx } as CSSProperties}
                onClick={() => openFinanceSubTab('transactions')}
                aria-label={`Lihat transaksi ${row.title}`}
              >
                <span
                  className="h-10 w-10 rounded-xl grid place-items-center text-base shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                  style={{ backgroundColor: tintFromColor(row.color) }}
                  aria-hidden="true"
                >
                  {row.emoji}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{row.title}</span>
                  <span className="block text-[11px] text-muted-foreground truncate">{row.meta}</span>
                </span>
                {row.amount !== null && (
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums shrink-0',
                      row.isIncome
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    )}
                  >
                    {row.isIncome ? '+' : '−'}{formatRupiah(row.amount)}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="px-4 pb-5 sm:px-5">
            <div className="premium-empty min-h-[10rem]">
              <div className="premium-empty-orb" aria-hidden="true">
                <Wallet className="h-7 w-7" />
              </div>
              <p className="text-sm font-semibold">Belum ada transaksi</p>
              <p className="text-xs text-muted-foreground">
                Catat pemasukan atau pengeluaran lewat tombol aksi cepat di atas.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Tombol kecil "Lihat semua" di header kartu — dipisah supaya hero tetap
// satu tombol besar (bukan nested button).
function ButtonLikeLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
      onClick={onClick}
      aria-label="Lihat semua transaksi"
    >
      Lihat semua
      <ChevronRight className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}
