'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Info, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
// PERF-FIX (FIX-TIER3 / Fix 15): removed unused `date-fns` imports
// (`format` and `id as idLocale` were imported but never called in this
// file — verified via grep).
import { cn } from '@/lib/utils';
import { formatRupiah } from './finance-types';
import { CountUpRupiah, CountUpNumber } from './count-up';
import type { DashboardData, LastDoneItem, Transaction } from './finance-types';
import SourceBalanceSection from './source-balance';
import DailyRecap from './daily-recap';
import NetWorthWidget from './net-worth-widget';
import { SpendingHeatmap } from './finance-spending-heatmap';

function ChartInfo({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0" aria-label="Info">
            <Info className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface FinanceOverviewProps {
  dashboardData: DashboardData;
  lastDoneData: LastDoneItem[];
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
  // SHADCN-PHASE-3: SpendingHeatmap needs the month's transactions (to
  // compute per-day expense totals + counts) and the selected month key
  // (yyyy-MM) to build the calendar grid. Both come from the parent
  // <Finance> component, which already fetches transactions via useQuery
  // (enabled on overview + transactions tabs — see finance.tsx).
  transactions: Transaction[];
  selectedMonth: string;
}

export default function FinanceOverview({
  dashboardData,
  lastDoneData,
  getCategoryMeta,
  transactions,
  selectedMonth,
}: FinanceOverviewProps) {
  const incomeChange = dashboardData.previousMonth.income > 0
    ? Math.round(((dashboardData.totalIncome - dashboardData.previousMonth.income) / dashboardData.previousMonth.income) * 100)
    : 0;

  const expenseChange = dashboardData.previousMonth.expense > 0
    ? Math.round(((dashboardData.totalExpense - dashboardData.previousMonth.expense) / dashboardData.previousMonth.expense) * 100)
    : 0;

  // ── 3D Tilt + shine effect for the hero "Total Saldo" card ──────────────
  // Inspired by shadcn-fintech's 3D credit cards. Only enabled when:
  //   1. Device has a fine pointer + hover capability (skip touch / coarse)
  //   2. User has NOT requested reduced motion
  // On mobile/touch the card stays static — better perf + UX.
  const heroCardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [shine, setShine] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);
  const [tiltEnabled, setTiltEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const hoverMq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setTiltEnabled(hoverMq.matches && !reduceMq.matches);
    update();
    hoverMq.addEventListener('change', update);
    reduceMq.addEventListener('change', update);
    return () => {
      hoverMq.removeEventListener('change', update);
      reduceMq.removeEventListener('change', update);
    };
  }, []);

  const handleHeroMouseMove = (e: React.MouseEvent) => {
    if (!tiltEnabled) return;
    const rect = heroCardRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Normalised position within the card (0..1)
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    // Max ~8deg tilt: (0.5 - y) * 16 → ±8deg at edges
    setTilt({ x: (0.5 - y) * 16, y: (x - 0.5) * 16 });
    setShine({ x: x * 100, y: y * 100 });
  };

  const handleHeroMouseEnter = () => {
    if (!tiltEnabled) return;
    setIsHovering(true);
  };

  const handleHeroMouseLeave = () => {
    setIsHovering(false);
    setTilt({ x: 0, y: 0 });
    setShine({ x: 50, y: 50 });
  };

  return (
    <div className="space-y-4 mt-4">
      {/* ── NET WORTH WIDGET (Maybe Finance inspired) ─────────────────── */}
      {/* Sits at the very top of Ringkasan: total kekayaan + 90-day sparkline
          + per-source breakdown. Self-fetches from /api/finance/net-worth
          and renders null if the user has no fund sources yet. */}
      <NetWorthWidget />

      {/* ── DAILY RECAP: Today's transaction insights (premium) ──────── */}
      <DailyRecap />

      {/* Saldo per Sumber Dana */}
      <SourceBalanceSection />

      {/* ── HERO CARD: Finance Summary ─────────────────────────── */}
      <Card
        ref={heroCardRef}
        onMouseMove={handleHeroMouseMove}
        onMouseEnter={handleHeroMouseEnter}
        onMouseLeave={handleHeroMouseLeave}
        style={{
          animationDelay: '0ms',
          transform: tiltEnabled
            ? `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`
            : undefined,
          transition: 'transform 0.2s ease-out',
          transformStyle: 'preserve-3d',
        }}
        className={cn(
          'overflow-hidden anim-stagger relative',
          isHovering && tiltEnabled && 'shadow-[0_20px_50px_-10px_rgba(20,184,166,0.4)]'
        )}
      >
        {/* ── 3D Shine overlay (desktop hover only) ──
            Subtle radial gloss that follows the cursor. Lives above the
            gradient section but below interactive tooltips (pointer-events
            disabled). Rendered only when tilt is enabled to keep the DOM
            lean on touch devices. */}
        {tiltEnabled && (
          <div
            aria-hidden="true"
            className={cn(
              'absolute inset-0 pointer-events-none z-20 transition-opacity duration-200',
              isHovering ? 'opacity-100' : 'opacity-0'
            )}
            style={{
              background: `radial-gradient(circle at ${shine.x}% ${shine.y}%, rgba(255,255,255,0.15) 0%, transparent 50%)`,
            }}
          />
        )}
        {/* Top section: big balance number — ACTUAL total from fund sources.
            Animated gradient shift for premium feel. */}
        <div className="anim-gradient-shift px-4 py-4 sm:px-6 sm:py-5" style={{ backgroundImage: 'linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(280 70% 60% / 0.06), hsl(var(--primary) / 0.08), hsl(200 70% 60% / 0.05))' }}>
          <p className="text-xs text-muted-foreground font-medium">Total Saldo</p>
          <p className={cn(
            'text-2xl sm:text-3xl font-bold tracking-tight mt-0.5',
            dashboardData.balance >= 0 ? 'text-primary' : 'text-destructive'
          )}>
            <CountUpRupiah amount={dashboardData.balance} bounce={dashboardData.balance >= 0} />
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            <CountUpNumber value={dashboardData.transactionCount} /> transaksi bulan ini
            {dashboardData.netCashFlow !== undefined && (
              <span className="ml-1.5">
                ·{' '}
                <span className={dashboardData.netCashFlow >= 0 ? 'text-primary' : 'text-destructive'}>
                  {dashboardData.netCashFlow >= 0 ? '+' : '−'}
                  {formatRupiah(Math.abs(dashboardData.netCashFlow))}
                </span>
                {' '}arus kas
              </span>
            )}
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Middle section: income vs expense (2 columns) */}
        <div className="grid grid-cols-2 divide-x divide-border">
          {/* Income */}
          <div className="px-4 py-3 sm:px-6">
            <div className="flex items-center gap-1 mb-0.5">
              <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">Pemasukan</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-primary"><CountUpRupiah amount={dashboardData.totalIncome} flashColor="green" /></p>
            {dashboardData.previousMonth.income > 0 && (
              <p className={cn('text-xs mt-0.5', incomeChange >= 0 ? 'text-primary' : 'text-destructive')}>
                {incomeChange >= 0 ? '↑' : '↓'} {Math.abs(incomeChange)}% vs lalu
              </p>
            )}
          </div>

          {/* Expense */}
          <div className="px-4 py-3 sm:px-6">
            <div className="flex items-center gap-1 mb-0.5">
              <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
              <span className="text-xs font-medium text-destructive">Pengeluaran</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-destructive"><CountUpRupiah amount={dashboardData.totalExpense} flashColor="red" /></p>
            {dashboardData.previousMonth.expense > 0 && (
              <p className={cn('text-xs mt-0.5', expenseChange <= 0 ? 'text-primary' : 'text-destructive')}>
                {expenseChange <= 0 ? '↓' : '↑'} {Math.abs(expenseChange)}% vs lalu
              </p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Bottom section: avg/day + projection (inline) */}
        <div className="px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Rata-rata:</span>
            <span className="text-xs font-semibold">{formatRupiah(dashboardData.avgDailyExpense)}/hari</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Proyeksi:</span>
            <span className="text-xs font-semibold">{formatRupiah(dashboardData.projectedMonthlyExpense)}/bln</span>
          </div>
        </div>
      </Card>

      {/* ── SPENDING HEATMAP (shadcn-fintech inspired) ──────────────────── */}
      {/* Monthly calendar grid colored by daily expense intensity. Tap a
          cell to reveal that day's total + transaction count. Sits below
          the hero summary card so users see the "where did my money go this
          month" picture immediately after the headline numbers. */}
      <Card className="anim-stagger" style={{ animationDelay: '60ms' }}>
        <CardContent className="pt-4">
          <SpendingHeatmap
            transactions={transactions}
            selectedMonth={selectedMonth}
          />
        </CardContent>
      </Card>

      {/* ── Last Done Tracking (compact list, no grid of cards) ── */}
      {lastDoneData.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              Terakhir Transaksi
              <ChartInfo text="Menampilkan kapan terakhir transaksi untuk kategori yang kamu tandai 'Track Terakhir Transaksi' di pengaturan Kategori. Diurutkan dari yang paling lama belum transaksi." />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-1.5">
              {lastDoneData.map(item => (
                <div key={item.category} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-b-0">
                  <span className="text-base shrink-0">{item.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.category}</p>
                    {item.daysAgo !== null ? (
                      <p className="text-xs text-muted-foreground">
                        {item.daysAgo === 0 ? 'Hari ini' : item.daysAgo === 1 ? 'Kemarin' : `${item.daysAgo} hari lalu`}
                        {item.lastAmount !== null ? ` · ${formatRupiah(item.lastAmount)}` : ''}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Belum ada transaksi</p>
                    )}
                  </div>
                  {item.daysAgo !== null && item.daysAgo > 7 && (
                    <div className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0',
                      item.daysAgo > 14 ? 'bg-destructive/10 text-destructive dark:bg-destructive/15 dark:text-destructive/80' : 'bg-warning/10 text-warning dark:bg-warning/15 dark:text-warning/80'
                    )}>
                      {item.daysAgo}d
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
