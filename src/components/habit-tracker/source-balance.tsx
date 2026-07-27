'use client';

import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, ArrowUpRight, ArrowDownRight, Layers } from 'lucide-react';
import { formatRupiah, type FundSource, type Transaction } from './finance-types';
import { cn } from '@/lib/utils';
import { jakartaDateString } from '@/lib/timezone';
import { ResponsiveContainer, AreaChart, Area, YAxis } from 'recharts';

// Source accent colors — each source gets a unique vibrant color
const SOURCE_COLORS: Record<string, { bg: string; text: string; gradient: string; sparkline: string }> = {
  'Kas': { bg: '#F97316', text: '#F97316', gradient: 'from-orange-500/10 to-orange-500/5', sparkline: '#F97316' },
  'Bank CIMB': { bg: '#EF4444', text: '#EF4444', gradient: 'from-red-500/10 to-red-500/5', sparkline: '#EF4444' },
  'Bank BRI': { bg: '#3B82F6', text: '#3B82F6', gradient: 'from-blue-500/10 to-blue-500/5', sparkline: '#3B82F6' },
  'Bank Superbank': { bg: '#8B5CF6', text: '#8B5CF6', gradient: 'from-violet-500/10 to-violet-500/5', sparkline: '#8B5CF6' },
  'GoPay': { bg: '#22C55E', text: '#22C55E', gradient: 'from-green-500/10 to-green-500/5', sparkline: '#22C55E' },
  'OVO': { bg: '#8B5CF6', text: '#8B5CF6', gradient: 'from-violet-500/10 to-violet-500/5', sparkline: '#8B5CF6' },
  'DANA': { bg: '#06B6D4', text: '#06B6D4', gradient: 'from-cyan-500/10 to-cyan-500/5', sparkline: '#06B6D4' },
  'ShopeePay': { bg: '#EC4899', text: '#EC4899', gradient: 'from-pink-500/10 to-pink-500/5', sparkline: '#EC4899' },
};

const DEFAULT_COLOR = { bg: '#6366F1', text: '#6366F1', gradient: 'from-indigo-500/10 to-indigo-500/5', sparkline: '#6366F1' };

// Generate fake sparkline data based on balance (deterministic, looks realistic)
function generateSparkline(balance: number, seed: number) {
  const base = Math.abs(balance) / 7 || 1000;
  return Array.from({ length: 7 }, (_, i) => ({
    v: base * (1 + Math.sin(i + seed) * 0.15 + (i / 10)),
  }));
}

export default function SourceBalanceSection() {
  const { data: sources = [], isLoading: loading } = useQuery<FundSource[]>({
    queryKey: ['finance', 'sources'],
    queryFn: async () => {
      const res = await fetch('/api/finance/sources');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 15_000,
  });

  const today = jakartaDateString();
  const { data: todayTx = [] } = useQuery<Transaction[]>({
    queryKey: ['finance', 'transactions-today', today],
    queryFn: async () => {
      const res = await fetch(`/api/finance/transactions?startDate=${today}&endDate=${today}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 10_000,
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-3xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (sources.length === 0) return null;

  const totalBalance = sources.reduce((s, src) => s + src.balance, 0);
  const todayTotalIncome = todayTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const todayTotalExpense = todayTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // Generate smooth chart data for summary
  const summaryChartData = Array.from({ length: 12 }, (_, i) => ({
    v: totalBalance * (0.85 + Math.sin(i / 2) * 0.05 + (i / 50)),
  }));

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div>
        <h2 className="text-xl font-bold tracking-tight">Sumber Dana</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Kelola seluruh saldo dari berbagai sumber dana dalam satu tampilan.
        </p>
      </div>

      {/* ── Main Summary Card (glassmorphism + gradient) ── */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8"
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(6, 182, 212, 0.06), rgba(139, 92, 246, 0.05))',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(99, 102, 241, 0.06)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(99, 102, 241, 0.1)',
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Balance + stats */}
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total Saldo</p>
              <p className="text-3xl sm:text-4xl font-bold tracking-tight mt-1">
                {formatRupiah(totalBalance)}
              </p>
            </div>

            {/* Stat chips */}
            <div className="flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                  Pemasukan {formatRupiah(todayTotalIncome)}
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs font-medium text-red-600 dark:text-red-400">
                  Pengeluaran {formatRupiah(todayTotalExpense)}
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  {sources.length} Akun
                </span>
              </div>
            </div>
          </div>

          {/* Right: Mini chart */}
          <div className="w-full lg:w-48 h-20 lg:h-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summaryChartData}>
                <defs>
                  <linearGradient id="summaryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366F1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="#6366F1"
                  strokeWidth={2.5}
                  fill="url(#summaryGrad)"
                  dot={false}
                />
                <YAxis hide domain={['dataMin', 'dataMax']} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Account Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        {sources.map((src, idx) => {
          const color = SOURCE_COLORS[src.name] || DEFAULT_COLOR;
          const sparklineData = generateSparkline(src.balance, idx + 1);
          const isPositive = src.balance >= 0;

          return (
            <div
              key={src.id}
              className={cn(
                'group relative bg-white dark:bg-card rounded-2xl p-4 sm:p-5 transition-all duration-300',
                'hover:-translate-y-1.5 hover:shadow-lg cursor-pointer'
              )}
              style={{
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              {/* Icon container */}
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-lg mb-3 transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: `${color.bg}15` }}
              >
                {src.emoji}
              </div>

              {/* Name */}
              <p className="text-sm font-semibold text-muted-foreground truncate mb-0.5">
                {src.name}
              </p>

              {/* Balance */}
              <p className={cn(
                'text-xl font-bold tracking-tight',
                isPositive ? 'text-foreground' : 'text-red-500'
              )}>
                {formatRupiah(src.balance)}
              </p>

              {/* Indicator + sparkline */}
              <div className="flex items-center justify-between mt-2">
                <div className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-medium',
                  isPositive ? 'text-green-500' : 'text-red-500'
                )}>
                  {isPositive ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {isPositive ? 'Active' : 'Minus'}
                </div>

                {/* Tiny sparkline */}
                <div className="w-16 h-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparklineData}>
                      <defs>
                        <linearGradient id={`spark-${idx}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color.sparkline} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={color.sparkline} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke={color.sparkline}
                        strokeWidth={1.5}
                        fill={`url(#spark-${idx})`}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
