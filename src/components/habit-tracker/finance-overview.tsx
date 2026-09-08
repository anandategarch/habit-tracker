'use client';

import { useEffect, useRef, useState } from 'react';
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
  // BUGFIX POST-1 #7 + DESIGN-1: Use refs for direct style mutation (zero re-renders
  // on mousemove). Declared BEFORE useEffect supaya react-hooks/immutability rule
  // tidak complain (refs modified in effect must be declared before effect).
  const tiltTransformRef = useRef<HTMLDivElement>(null);
  const shineOverlayRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [tiltEnabled, setTiltEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const hoverMq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    // BUGFIX POST-3 #5: Reset tilt+shine+hover saat tiltEnabled flips to false
    // (e.g. user toggles prefers-reduced-motion while hovering)
    const update = () => {
      const enabled = hoverMq.matches && !reduceMq.matches;
      setTiltEnabled(enabled);
      if (!enabled) {
        // BUGFIX DESIGN-1: Reset DOM directly (not dead setState)
        setIsHovering(false);
        if (tiltTransformRef.current) {
          tiltTransformRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
        }
        if (shineOverlayRef.current) {
          shineOverlayRef.current.style.background = '';
        }
      }
    };
    update();
    hoverMq.addEventListener('change', update);
    reduceMq.addEventListener('change', update);
    return () => {
      hoverMq.removeEventListener('change', update);
      reduceMq.removeEventListener('change', update);
    };
  }, []);

  // BUGFIX POST-1 #7: handleHeroMouseMove uses direct ref mutation (declared
  // above) instead of setState for tilt+shine. Zero React re-renders on mousemove.

  const handleHeroMouseMove = (e: React.MouseEvent) => {
    if (!tiltEnabled) return;
    const rect = heroCardRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Normalised position within the card (0..1)
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    // Max ~8deg tilt: (0.5 - y) * 16 → ±8deg at edges
    const tiltX = (0.5 - y) * 16;
    const tiltY = (x - 0.5) * 16;
    // Direct style mutation (no setState → no re-render)
    if (tiltTransformRef.current) {
      tiltTransformRef.current.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
    }
    if (shineOverlayRef.current) {
      shineOverlayRef.current.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.15) 0%, transparent 50%)`;
    }
  };

  const handleHeroMouseEnter = () => {
    if (!tiltEnabled) return;
    setIsHovering(true);
  };

  const handleHeroMouseLeave = () => {
    setIsHovering(false);
    // BUGFIX DESIGN-1: Direct ref mutation (not setState) — tilt/shine state
    // is dead (never read in render). Sebelumnya setTilt/setShine adalah no-op
    // → card STAYS TILTED after mouse leaves. Now: reset DOM directly.
    if (tiltTransformRef.current) {
      tiltTransformRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    }
    if (shineOverlayRef.current) {
      shineOverlayRef.current.style.background = '';
    }
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

      {/* ── HERO CARD: Finance Summary — premium aurora gradient ────── */}
      {/* PREMIUM-UI ("Rutina Aurora"): balance summary dibungkus .premium-hero
          (gradien teal→emerald, teks terang, ornamen bubbles) + chip-icon
          emerald/rose untuk Pemasukan/Pengeluaran + angka .premium-stat.
          3D tilt + shine logic (desktop hover only) dipertahankan — ref &
          mouse handler dipindah ke <div> polong (bukan Card) supaya glow
          shadow .premium-hero tidak tertimpa `.card-shadow-premium` milik
          Card default (unlayered, urutan sumber lebih akhir di globals.css). */}
      <div
        ref={heroCardRef}
        onMouseMove={handleHeroMouseMove}
        onMouseEnter={handleHeroMouseEnter}
        onMouseLeave={handleHeroMouseLeave}
        className="premium-hero anim-stagger"
      >
        {/* BUGFIX POST-1 #7: Inner div holds the transform via ref (direct
            style mutation) instead of state on Card. Zero re-renders on mousemove. */}
        <div
          ref={tiltTransformRef}
          style={{
            transform: tiltEnabled ? 'perspective(1000px) rotateX(0deg) rotateY(0deg)' : undefined,
            transition: 'transform 0.2s ease-out',
            // BUGFIX DESIGN-2: Hapus transformStyle: preserve-3d — di preserve-3d
            // context, z-index di-ignore (children paint by 3D Z-position). Shine
            // overlay (z-20) ter-hidden behind content. Default 'flat' restores
            // normal z-index stacking.
          }}
        >
          {/* ── 3D Shine overlay (desktop hover only) ── */}
          {tiltEnabled && (
            <div
              ref={shineOverlayRef}
              aria-hidden="true"
              className={cn(
                'absolute inset-0 pointer-events-none z-20 transition-opacity duration-200',
                isHovering ? 'opacity-100' : 'opacity-0'
              )}
            />
          )}
          {/* Ornamen bubble dekoratif (aria-hidden) */}
          <div className="premium-hero-bubbles" aria-hidden="true" />

          {/* Top section: big balance number + income/expense chips */}
          <div className="relative px-4 py-5 sm:px-6 sm:py-6">
            <p
              className="premium-label"
              style={{ color: 'rgba(240, 253, 250, 0.62)' }}
            >
              Total Saldo
            </p>
            <p
              className={cn(
                'premium-stat text-3xl sm:text-4xl mt-1.5',
                dashboardData.balance >= 0 ? 'text-white' : 'text-rose-200'
              )}
            >
              <CountUpRupiah amount={dashboardData.balance} bounce={dashboardData.balance >= 0} />
            </p>
            <p className="text-xs text-white/70 mt-1.5">
              <CountUpNumber value={dashboardData.transactionCount} /> transaksi bulan ini
              {dashboardData.netCashFlow !== undefined && (
                <span className="ml-1.5">
                  ·{' '}
                  <span
                    className={cn(
                      'font-medium tabular-nums',
                      dashboardData.netCashFlow >= 0 ? 'text-emerald-200' : 'text-rose-200'
                    )}
                  >
                    {dashboardData.netCashFlow >= 0 ? '+' : '−'}
                    {formatRupiah(Math.abs(dashboardData.netCashFlow))}
                  </span>
                  {' '}arus kas
                </span>
              )}
            </p>

            {/* Income vs expense — glassy chips with gradient icon chips.
                Layout vertikal (ikon+label di baris atas, nominal di bawah)
                supaya nominal panjang (mis. "Rp 10.850.000") muat penuh tanpa
                truncate di lebar chip mobile yang sempit. */}
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {/* Income */}
              <div className="rounded-2xl bg-white/10 border border-white/15 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="chip-icon chip-emerald h-7 w-7" aria-hidden="true">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
                    Pemasukan
                  </p>
                </div>
                <p className="premium-stat text-sm sm:text-base text-white truncate mt-1.5">
                  <CountUpRupiah amount={dashboardData.totalIncome} flashColor="green" />
                </p>
                {dashboardData.previousMonth.income > 0 && (
                  <p className={cn('text-[11px] mt-0.5', incomeChange >= 0 ? 'text-emerald-200' : 'text-rose-200')}>
                    ↑ {Math.abs(incomeChange)}% vs lalu
                  </p>
                )}
              </div>

              {/* Expense */}
              <div className="rounded-2xl bg-white/10 border border-white/15 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="chip-icon chip-rose h-7 w-7" aria-hidden="true">
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
                    Pengeluaran
                  </p>
                </div>
                <p className="premium-stat text-sm sm:text-base text-white truncate mt-1.5">
                  <CountUpRupiah amount={dashboardData.totalExpense} flashColor="red" />
                </p>
                {dashboardData.previousMonth.expense > 0 && (
                  <p className={cn('text-[11px] mt-0.5', expenseChange <= 0 ? 'text-emerald-200' : 'text-rose-200')}>
                    ↓ {Math.abs(expenseChange)}% vs lalu
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Bottom section: avg/day + projection (inline) */}
          <div className="relative px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-white/15">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white/60">Rata-rata:</span>
              <span className="text-xs font-semibold text-white tabular-nums">{formatRupiah(dashboardData.avgDailyExpense)}/hari</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white/60">Proyeksi:</span>
              <span className="text-xs font-semibold text-white tabular-nums">{formatRupiah(dashboardData.projectedMonthlyExpense)}/bln</span>
            </div>
          </div>
        </div>{/* BUGFIX POST-1 #7: close inner tiltTransformRef div */}
      </div>

      {/* ── SPENDING HEATMAP (shadcn-fintech inspired) ──────────────────── */}
      {/* Monthly calendar grid colored by daily expense intensity. Tap a
          cell to reveal that day's total + transaction count. Sits below
          the hero summary card so users see the "where did my money go this
          month" picture immediately after the headline numbers. */}
      <div
        className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger"
        style={{ animationDelay: '60ms' }}
      >
        <SpendingHeatmap
          transactions={transactions}
          selectedMonth={selectedMonth}
        />
      </div>

      {/* ── Last Done Tracking (compact list, no grid of cards) ── */}
      {lastDoneData.length > 0 && (
        <div
          className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 anim-stagger"
          style={{ animationDelay: '100ms' }}
        >
          <div className="mb-2 flex items-center gap-2.5">
            <span className="chip-icon chip-amber h-8 w-8" aria-hidden="true">
              <Clock className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold tracking-tight">Terakhir Transaksi</h3>
            <ChartInfo text="Menampilkan kapan terakhir transaksi untuk kategori yang kamu tandai 'Track Terakhir Transaksi' di pengaturan Kategori. Diurutkan dari yang paling lama belum transaksi." />
          </div>
          {/* PREMIUM-UI: baris .premium-list-item dengan avatar emoji squircle
              (tint warna kategori) — konsisten dengan baris transaksi. */}
          <div className="space-y-0.5">
            {lastDoneData.map(item => (
              <div key={item.category} className="premium-list-item">
                <span
                  className="h-9 w-9 rounded-xl grid place-items-center text-base shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                  style={{ backgroundColor: `${item.color}20` }}
                  aria-hidden="true"
                >
                  {item.emoji}
                </span>
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
        </div>
      )}

    </div>
  );
}
