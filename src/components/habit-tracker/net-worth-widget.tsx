'use client';

// ─────────────────────────────────────────────────────────────────────────
// NetWorthWidget — Maybe Finance inspired net worth dashboard.
//
// Shows the user's total net worth (sum of ALL FundSource balances) plus:
//   • A big animated number with FlashRupiah (count-up + flash-on-change)
//   • A trend indicator (↑/↓ vs previous period, with percentage)
//   • A 90-day mini sparkline chart (recharts AreaChart)
//   • A source breakdown — small horizontal bars showing each source's
//     contribution to the total net worth
//
// Fetches from /api/finance/net-worth. Indonesian labels.
// Designed to be embedded at the TOP of the Finance → Ringkasan tab.
// ─────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { formatRupiah, compactRupiah } from './finance-types';
import { FlashRupiah } from './flash-number';

// ── API response shape ─────────────────────────────────────────────────────

interface NetWorthSource {
  id: string;
  name: string;
  emoji: string;
  balance: number;
  pctOfTotal: number;
}

interface NetWorthData {
  current: number;
  previous: number;
  change: number;
  changePct: number;
  history: { date: string; value: number }[];
  sources: NetWorthSource[];
  period: string;
  days: number;
}

// Source accent colors — reused from source-balance.tsx so each fund source
// renders in a consistent color across both widgets. Sources not in this map
// fall back to the app's primary green (matches the user's theme).
const SOURCE_COLORS: Record<string, string> = {
  'Kas': '#F97316',
  'Bank CIMB': '#EF4444',
  'Bank BRI': '#14B8A6',
  'Bank Superbank': '#A855F7',
  'GoPay': '#22C55E',
  'OVO': '#84CC16',
  'DANA': '#10B981',
  'ShopeePay': '#EC4899',
};
const DEFAULT_COLOR = '#22C55E';

// ── Component ──────────────────────────────────────────────────────────────

export default function NetWorthWidget() {
  const { data, isLoading } = useQuery<NetWorthData>({
    queryKey: ['finance', 'net-worth', '90d'],
    queryFn: async () => {
      const res = await fetch('/api/finance/net-worth?period=90d');
      if (!res.ok) {
        return {
          current: 0,
          previous: 0,
          change: 0,
          changePct: 0,
          history: [],
          sources: [],
          period: '90d',
          days: 90,
        } as NetWorthData;
      }
      return (await res.json()) as NetWorthData;
    },
    // Net worth changes only when fund source balances change — which happens
    // via transaction writes / balance edits. We can hold the cached value
    // for a while; mutations in the app invalidate this query key when needed.
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return (
      <Skeleton className="h-[200px] sm:h-[180px] rounded-3xl" />
    );
  }

  const isUp = data.change >= 0;
  const hasTrend = data.previous !== 0;
  const chartData = data.history.map((p) => ({ v: p.value }));
  const showChart = chartData.length > 1;
  const showBreakdown = data.sources.length > 0 && data.current !== 0;

  // No sources at all → render nothing (the rest of the overview handles the
  // empty state). This avoids showing a "Total Kekayaan: Rp 0" widget when
  // the user hasn't set up any fund sources yet.
  if (data.sources.length === 0) return null;

  return (
    <div
      className="relative overflow-hidden rounded-3xl p-5 sm:p-6 anim-gradient-shift"
      style={{
        // Match the SourceBalanceSection gradient palette (green/teal/amber)
        // so the two widgets feel like a cohesive top-of-overview band.
        background:
          'linear-gradient(135deg, rgba(34, 197, 94, 0.10), rgba(20, 184, 166, 0.07), rgba(245, 158, 11, 0.05), rgba(34, 197, 94, 0.07))',
        backgroundSize: '200% 200%',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(34, 197, 94, 0.06)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(34, 197, 94, 0.1)',
      }}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* ── Left: label + big number + trend ─────────────────────── */}
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs text-muted-foreground font-medium">Total Kekayaan</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight break-words">
            <FlashRupiah amount={data.current} />
          </p>

          {/* Trend chip — ↑/↓ vs previous period (90 days ago) */}
          {hasTrend ? (
            <div
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                isUp
                  ? 'bg-success/10 text-success dark:text-success/80'
                  : 'bg-destructive/10 text-destructive dark:text-destructive/80'
              )}
            >
              {isUp ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>
                {isUp ? '↑' : '↓'} {Math.abs(data.changePct)}% vs bulan lalu
              </span>
              <span className="text-muted-foreground ml-1 hidden sm:inline">
                ({isUp ? '+' : '−'}{formatRupiah(Math.abs(data.change))})
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted/50 text-muted-foreground">
              <Wallet className="h-3 w-3" />
              {data.sources.length} sumber dana
            </div>
          )}

          {/* Source breakdown — compact horizontal bars. Only positive
              balances get a bar (negative balances would render confusing
              "negative width" bars). Hidden if total is 0. */}
          {showBreakdown && (
            <div className="space-y-1.5 pt-1 max-w-md">
              {data.sources
                .slice()
                .sort((a, b) => b.balance - a.balance)
                .slice(0, 5)
                .map((src) => {
                  const color = SOURCE_COLORS[src.name] || DEFAULT_COLOR;
                  const positive = Math.max(0, src.balance);
                  const total = data.sources.reduce((s, x) => s + Math.max(0, x.balance), 0);
                  const widthPct = total > 0 ? Math.max(2, Math.round((positive / total) * 100)) : 0;
                  return (
                    <div key={src.id} className="flex items-center gap-2 text-xs">
                      <span className="w-5 text-center shrink-0">{src.emoji}</span>
                      <span className="w-24 sm:w-28 truncate text-muted-foreground shrink-0">
                        {src.name}
                      </span>
                      <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden min-w-[40px]">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${widthPct}%`, backgroundColor: color }}
                        />
                      </div>
                      <span className="w-14 sm:w-16 text-right font-medium shrink-0 tabular-nums">
                        {compactRupiah(src.balance)}
                      </span>
                    </div>
                  );
                })}
              {data.sources.length > 5 && (
                <p className="text-[11px] text-muted-foreground pl-7">
                  +{data.sources.length - 5} sumber lainnya
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Right: 90-day sparkline ────────────────────────────────── */}
        {showChart && (
          <div className="w-full lg:w-56 h-24 lg:h-28 shrink-0 min-w-0">
            {/* BUGFIX CHART-WIDTH: min-w-0 prevents flex overflow, and
                ResponsiveContainer needs a parent with explicit dimensions.
                The width(-1) error happens when the container has no
                measurable width (e.g. during splash/skeleton). min-w-0
                + the explicit h-24/h-28 ensures valid dimensions. */}
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <defs>
                  <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  fill="url(#netWorthGrad)"
                  dot={false}
                  isAnimationActive={false}
                />
                <YAxis hide domain={['dataMin', 'dataMax']} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Small footer hint — what "bulan lalu" means for the current period */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/40 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          {isUp ? <ArrowUpRight className="h-3 w-3 text-success" /> : <ArrowDownRight className="h-3 w-3 text-destructive" />}
          {hasTrend
            ? `Dibanding ${data.days} hari lalu`
            : 'Belum ada data perbandingan'}
        </span>
        <span className="text-muted-foreground/60">·</span>
        <span>Rentang 90 hari terakhir</span>
      </div>
    </div>
  );
}
