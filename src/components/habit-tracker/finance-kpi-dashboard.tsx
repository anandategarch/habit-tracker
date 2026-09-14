'use client';

// components/habit-tracker/finance-kpi-dashboard.tsx — panel KPI "Dashboard
// Keuangan" di sub-tab Ringkasan (Task 40, DASHBOARD-FIN).
//
// 4 kartu KPI hasil riset referensi (savings rate & dana darurat:
// Quicken "5 Personal Finance KPIs", Klipfolio "The KPIs of personal
// finance", CFPB emergency-fund guide; pemakaian budget ala Money
// Manager/Dompetku):
//   1. Rasio Tabungan  — (pemasukan − pengeluaran)/pemasukan; benchmark ≥ 20%
//   2. vs Bulan Lalu   — delta pengeluaran MoM (turun = hijau)
//   3. Budget Terpakai — spent/total bulan terpilih + progress bar
//   4. Dana Darurat    — total saldo ÷ rata-rata harian (hari); benchmark 90–180
//
// Semua kartu tombol 1-klik (openFinanceSubTab) → Analisis / Budget /
// Tabungan. Render defensif: data kosong/null → "—" + saran ringan, bukan
// angka palsu. Insight strip 1 baris di bawah grid (rule-based, prioritas:
// defisit > dana darurat tipis > rasio < target > kondisi sehat).

import { useMemo } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  LifeBuoy,
  PiggyBank,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { compactRupiah, formatRupiah } from './finance-types';
import { cn } from '@/lib/utils';
import type { DashboardData } from './finance-types';
import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';

interface FinanceKpiDashboardProps {
  dashboardData: DashboardData | null;
  selectedMonth: string;
}

type Tone = 'good' | 'warn' | 'bad' | 'neutral';

const TONE_TEXT: Record<Tone, string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-rose-600 dark:text-rose-400',
  neutral: 'text-foreground',
};

const TONE_CHIP: Record<Tone, string> = {
  good: 'chip-icon chip-emerald',
  warn: 'chip-icon chip-amber',
  bad: 'chip-icon chip-rose',
  neutral: 'chip-icon chip-teal',
};

const TONE_BAR: Record<Tone, string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-500',
  bad: 'bg-rose-500',
  neutral: 'bg-primary',
};

function KpiCard({
  label,
  icon: Icon,
  tone,
  value,
  sub,
  onClick,
  ariaLabel,
  progress,
  stagger,
}: {
  label: string;
  icon: LucideIcon;
  tone: Tone;
  value: string;
  sub: string;
  onClick: () => void;
  ariaLabel: string;
  progress?: number; // 0..100 — bar opsional
  stagger: number;
}) {
  return (
    <button
      type="button"
      className="premium-card rounded-2xl p-4 text-left w-full cursor-pointer anim-stagger transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.98]"
      style={{ '--stagger': stagger } as CSSProperties}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <div className="flex items-center gap-2 mb-2 min-w-0">
        <span className={cn(TONE_CHIP[tone], 'h-8 w-8 shrink-0')} aria-hidden="true">
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground truncate">
          {label}
        </p>
      </div>
      <p className={cn('text-lg sm:text-xl font-extrabold tabular-nums leading-tight', TONE_TEXT[tone])}>
        {value}
      </p>
      {typeof progress === 'number' ? (
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden" role="presentation">
          <div
            className={cn('h-full rounded-full transition-all', TONE_BAR[tone])}
            style={{ width: `${Math.min(100, Math.max(2, progress))}%` }}
          />
        </div>
      ) : null}
      <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug line-clamp-2">{sub}</p>
    </button>
  );
}

export default function FinanceKpiDashboard({ dashboardData, selectedMonth }: FinanceKpiDashboardProps) {
  const openFinanceSubTab = useAppStore(s => s.openFinanceSubTab);

  const income = dashboardData?.monthIncome ?? 0;
  const expense = dashboardData?.monthExpense ?? 0;
  const savingsRate = dashboardData?.savingsRate ?? null; // null = pemasukan 0
  const prevExpense = dashboardData?.prevMonthExpense ?? 0;
  const budgetTotal = dashboardData?.budgetTotal ?? 0;
  const budgetSpent = dashboardData?.budgetSpent ?? 0;
  const totalBalance = dashboardData?.totalBalance ?? 0;
  const runwayDays = dashboardData?.runwayDays ?? null;

  // 1) Rasio tabungan
  const savingsTone: Tone =
    savingsRate === null ? 'neutral' : savingsRate >= 20 ? 'good' : savingsRate >= 0 ? 'warn' : 'bad';
  const savingsValue = savingsRate === null ? '—' : `${savingsRate > 0 ? '+' : ''}${savingsRate}%`;
  const savingsSub =
    savingsRate === null
      ? 'Catat pemasukan bulan ini untuk melihat rasio'
      : savingsTone === 'good'
        ? `Menyimpan ${formatRupiah(Math.max(0, income - expense))} · target sehat ≥ 20%`
        : savingsTone === 'warn'
          ? 'Dorong ke ≥ 20% supaya dana tumbuh'
          : 'Pengeluaran melebihi pemasukan bulan ini';

  // 2) vs Bulan lalu (pengeluaran MoM)
  const momDelta =
    prevExpense > 0 ? Math.round(((expense - prevExpense) / prevExpense) * 1000) / 10 : null;
  const momTone: Tone =
    momDelta === null ? 'neutral' : momDelta <= 0 ? 'good' : momDelta <= 10 ? 'warn' : 'bad';
  const momValue =
    momDelta === null ? 'Baru mulai' : `${momDelta > 0 ? '+' : ''}${momDelta}%`;
  const momSub =
    momDelta === null
      ? 'Belum ada data bulan sebelumnya'
      : `${compactRupiah(prevExpense)} → ${compactRupiah(expense)} pengeluaran`;
  const momIcon = momDelta !== null && momDelta > 0 ? TrendingUp : TrendingDown;

  // 3) Budget terpakai
  const budgetPct = budgetTotal > 0 ? Math.round((budgetSpent / budgetTotal) * 100) : 0;
  const budgetTone: Tone =
    budgetTotal === 0 ? 'neutral' : budgetPct > 100 ? 'bad' : budgetPct >= 80 ? 'warn' : 'good';
  const budgetValue = budgetTotal === 0 ? 'Belum ada' : `${budgetPct}%`;
  const budgetSub =
    budgetTotal === 0
      ? 'Klik untuk mengatur budget bulan ini'
      : `${compactRupiah(budgetSpent)} dari ${compactRupiah(budgetTotal)}`;

  // 4) Dana darurat (runway hari)
  const runwayTone: Tone =
    runwayDays === null ? 'neutral' : runwayDays >= 90 ? 'good' : runwayDays >= 30 ? 'warn' : 'bad';
  const runwayValue = runwayDays === null ? '—' : `${runwayDays} hari`;
  const runwaySub =
    runwayDays === null
      ? 'Belum ada pengeluaran tercatat bulan ini'
      : `${compactRupiah(totalBalance)} ÷ ${compactRupiah(dashboardData?.dailyAvg ?? 0)}/hari · ideal 90–180`;

  // Insight strip — rule-based, prioritas masalah dulu.
  const insight = useMemo(() => {
    const month = selectedMonth;
    if (income === 0 && expense === 0) {
      return {
        icon: PiggyBank,
        text: `Belum ada transaksi ${month} — catat pemasukan & pengeluaran untuk menghidupkan dashboard ini.`,
        tone: 'neutral' as Tone,
      };
    }
    if (income > 0 && expense > income) {
      return {
        icon: TriangleAlert,
        text: `Pengeluaran ${compactRupiah(expense - income)} melebihi pemasukan bulan ini — cek kategori teratas di Analisis.`,
        tone: 'bad' as Tone,
      };
    }
    if (runwayDays !== null && runwayDays < 30 && totalBalance > 0) {
      return {
        icon: LifeBuoy,
        text: `Dana darurat baru menutup ${runwayDays} hari biaya hidup — target aman 3–6 bulan.`,
        tone: 'warn' as Tone,
      };
    }
    if (savingsRate !== null && savingsRate >= 20) {
      return {
        icon: ShieldCheck,
        text: `Kabar baik: kamu menyimpan ${savingsValue} pemasukan bulan ini (benchmark sehat ≥ 20%).`,
        tone: 'good' as Tone,
      };
    }
    return {
      icon: ArrowUpRight,
      text: `Rasio tabungan ${savingsValue} — kecilkan pengeluaran variabel untuk mengejar target 20%.`,
      tone: 'warn' as Tone,
    };
  }, [income, expense, runwayDays, totalBalance, savingsRate, savingsValue, selectedMonth]);

  const InsightIcon = insight.icon;

  return (
    <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="chip-icon chip-teal h-8 w-8 shrink-0" aria-hidden="true">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold">Dashboard Keuangan</h3>
        </div>
        <p className="text-[11px] text-muted-foreground shrink-0 tabular-nums">{selectedMonth}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Rasio Tabungan"
          icon={PiggyBank}
          tone={savingsTone}
          value={savingsValue}
          sub={savingsSub}
          stagger={0}
          onClick={() => openFinanceSubTab('analysis')}
          ariaLabel="Rasio tabungan bulan ini — buka analisis"
        />
        <KpiCard
          label="vs Bulan Lalu"
          icon={momIcon}
          tone={momTone}
          value={momValue}
          sub={momSub}
          stagger={1}
          onClick={() => openFinanceSubTab('analysis')}
          ariaLabel="Perbandingan pengeluaran dengan bulan lalu — buka analisis"
        />
        <KpiCard
          label="Budget Terpakai"
          icon={Target}
          tone={budgetTone}
          value={budgetValue}
          sub={budgetSub}
          progress={budgetTotal > 0 ? budgetPct : undefined}
          stagger={2}
          onClick={() => openFinanceSubTab('budgets')}
          ariaLabel="Pemakaian budget bulan ini — buka budget"
        />
        <KpiCard
          label="Dana Darurat"
          icon={LifeBuoy}
          tone={runwayTone}
          value={runwayValue}
          sub={runwaySub}
          stagger={3}
          onClick={() => openFinanceSubTab('savings')}
          ariaLabel="Dana darurat hari tertutup — buka tabungan"
        />
      </div>

      {/* Insight strip */}
      <div
        className={cn(
          'mt-3 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs leading-relaxed',
          insight.tone === 'good' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
          insight.tone === 'warn' && 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
          insight.tone === 'bad' && 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
          insight.tone === 'neutral' && 'bg-muted text-muted-foreground'
        )}
        role="status"
      >
        <InsightIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="min-w-0">{insight.text}</p>
      </div>
    </div>
  );
}
