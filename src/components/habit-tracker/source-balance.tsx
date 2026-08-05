'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Wallet, ArrowUpRight, ArrowDownRight, Pencil } from 'lucide-react';
import { formatRupiah, formatNominalInput, parseNominalInput, type FundSource, type Transaction } from './finance-types';
import { cn } from '@/lib/utils';
import { jakartaDateString } from '@/lib/timezone';
import { toast } from 'sonner';
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

// ── Types for balance-history API response ───────────────────────────────

interface BalanceHistoryPoint {
  date: string;
  label: string;
  balance: number;
  netFlow: number;
}

interface SourceHistory {
  id: string;
  name: string;
  emoji: string;
  currentBalance: number;
  startBalance: number;
  periodIncome: number;
  periodExpense: number;
  periodChange: number;
  dailyData: BalanceHistoryPoint[];
}

interface BalanceHistoryResponse {
  sources: SourceHistory[];
  period: string;
  days: number;
}

export default function SourceBalanceSection() {
  const queryClient = useQueryClient();
  const [balanceEditId, setBalanceEditId] = useState<string | null>(null);
  const [balanceEditValue, setBalanceEditValue] = useState('');

  const { data: sources = [], isLoading: loading } = useQuery<FundSource[]>({
    queryKey: ['finance', 'sources'],
    queryFn: async () => {
      const res = await fetch('/api/finance/sources');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 15_000,
  });

  // Inline balance edit — same logic as finance.tsx SourcesTab.
  // PATCH /api/finance/sources/[id]/balance creates an adjustment
  // transaction (income if diff > 0, expense if diff < 0) + atomically
  // increments the balance. See route.ts for details.
  //
  // Bug fix: previously fired PATCH even when the value didn't change
  // (user clicked nominal then clicked away without editing). Now we
  // compare the new value with the current balance FIRST — if same,
  // just close edit mode silently (no network call, no toast).
  const handleSaveBalance = async (sourceId: string) => {
    const raw = parseNominalInput(balanceEditValue);
    const val = parseFloat(raw);
    if (isNaN(val)) { setBalanceEditId(null); setBalanceEditValue(''); return; }

    // Find the current balance for this source. If the new value equals
    // the current balance, skip the PATCH entirely — no change needed.
    const source = sources.find((s) => s.id === sourceId);
    const currentBalance = source?.balance ?? 0;
    if (val === currentBalance) {
      // No change — close edit mode silently (no toast, no network call)
      setBalanceEditId(null);
      setBalanceEditValue('');
      return;
    }

    try {
      const res = await fetch(`/api/finance/sources/${sourceId}/balance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: val }),
      });
      if (res.ok) {
        const data = await res.json();
        queryClient.invalidateQueries({ queryKey: ['finance', 'sources'] });
        queryClient.invalidateQueries({ queryKey: ['finance', 'transactions'] });
        queryClient.invalidateQueries({ queryKey: ['finance', 'daily-recap'] });
        queryClient.invalidateQueries({ queryKey: ['finance', 'balance-history'] });
        if (data?.adjustment) {
          const adj = data.adjustment;
          const sign = adj.type === 'income' ? '+' : '−';
          toast.success(`Saldo diupdate — transaksi "${sign}${formatRupiah(adj.amount)}" dibuat`);
        } else {
          toast.success('Saldo diupdate');
        }
      } else {
        toast.error('Gagal update saldo');
      }
    } catch { toast.error('Gagal update saldo'); }
    setBalanceEditId(null);
    setBalanceEditValue('');
  };

  const today = jakartaDateString();
  const { data: todayTx = [] } = useQuery<Transaction[]>({
    queryKey: ['finance', 'transactions-today', today],
    queryFn: async () => {
      // Send full ISO datetime strings (not date-only) to avoid UTC midnight
      // truncation. Previously sent "2026-08-01" which API parsed as UTC
      // midnight → transactions after midnight excluded.
      const startDate = `${today}T00:00:00+07:00`;
      const endDate = `${today}T23:59:59+07:00`;
      const res = await fetch(`/api/finance/transactions?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 10_000,
  });

  // Fetch REAL balance history (30 days) for the charts — replaces fake
  // Math.sin() data that previously showed misleading sinusoidal curves.
  const { data: balanceHistory } = useQuery<BalanceHistoryResponse | null>({
    queryKey: ['finance', 'balance-history', '1m'],
    queryFn: async () => {
      const res = await fetch('/api/finance/sources/balance-history?period=1m');
      if (!res.ok) return null;
      const data = await res.json();
      // API returns [] on error, { sources, period, days } on success
      if (Array.isArray(data) || !data.sources) return null;
      return data as BalanceHistoryResponse;
    },
    staleTime: 30_000,
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

  // Build REAL summary chart data: sum all sources' daily balances per date.
  // All sources share the same date range from the API, so we iterate by index.
  const historySources = balanceHistory?.sources ?? [];
  const firstSourceData = historySources[0]?.dailyData ?? [];
  const summaryChartData = firstSourceData.map((point, i) => ({
    v: historySources.reduce((sum, s) => sum + (s.dailyData[i]?.balance || 0), 0),
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
              <p className="text-2xl sm:text-3xl font-bold tracking-tight mt-1 break-words">
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

          {/* Right: Mini chart — REAL 30-day total balance trend */}
          {summaryChartData.length > 1 && (
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
          )}
        </div>
      </div>

      {/* ── Account Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        {sources.map((src, idx) => {
          const color = SOURCE_COLORS[src.name] || DEFAULT_COLOR;
          const isPositive = src.balance >= 0;

          // REAL sparkline data: this source's 30-day balance history
          const sourceHistory = historySources.find((h) => h.name === src.name);
          const sparklineData = (sourceHistory?.dailyData ?? []).map((d) => ({ v: d.balance }));

          return (
            <div
              key={src.id}
              className={cn(
                'group relative bg-white dark:bg-card rounded-2xl p-4 sm:p-5 transition-all duration-300',
                'hover:-translate-y-1 hover:shadow-md'
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

              {/* Balance — clickable for inline edit (creates adjustment tx) */}
              {balanceEditId === src.id ? (
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">Rp</span>
                  <Input
                    autoFocus
                    className="h-7 text-base font-bold w-32 px-1.5 py-0"
                    value={balanceEditValue}
                    onChange={e => setBalanceEditValue(formatNominalInput(e.target.value))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveBalance(src.id);
                      if (e.key === 'Escape') { setBalanceEditId(null); setBalanceEditValue(''); }
                    }}
                    onBlur={() => handleSaveBalance(src.id)}
                  />
                </div>
              ) : (
                <button
                  className="group/balance inline-flex items-center gap-1 text-xl font-bold tracking-tight hover:opacity-70 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    setBalanceEditId(src.id);
                    setBalanceEditValue(src.balance ? String(Math.abs(src.balance)) : '');
                  }}
                  title="Klik untuk adjust saldo"
                >
                  <span className={isPositive ? 'text-foreground' : 'text-red-500'}>
                    {formatRupiah(src.balance)}
                  </span>
                  <Pencil className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover/balance:opacity-100 transition-opacity" />
                </button>
              )}

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

                {/* Tiny sparkline — REAL 30-day balance history */}
                {sparklineData.length > 1 ? (
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
                ) : (
                  /* If no history (new source, <2 data points), show a subtle
                     flat placeholder instead of a fake wave. */
                  <div className="w-16 h-6 flex items-center">
                    <div className="w-full h-px bg-muted-foreground/20" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
