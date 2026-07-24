'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ReferenceLine } from 'recharts';
import { Wallet, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Info, TrendingUp, TrendingDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatRupiah, CHART_COLORS } from './finance-types';
import { cn } from '@/lib/utils';

interface DailyPoint {
  date: string;
  label: string;
  balance: number;
  netFlow: number;
}

interface SourceBalance {
  id: string;
  name: string;
  emoji: string;
  currentBalance: number;
  startBalance: number;
  periodIncome: number;
  periodExpense: number;
  periodChange: number;
  dailyData: DailyPoint[];
}

interface BalanceHistoryData {
  sources: SourceBalance[];
  period: string;
  days: number;
}

const PERIOD_OPTIONS = [
  { value: '7d', label: '7 Hari' },
  { value: '1m', label: '1 Bulan' },
  { value: '3m', label: '3 Bulan' },
] as const;

const PERIOD_LABELS: Record<string, string> = {
  '7d': '7 hari',
  '1m': '1 bulan',
  '3m': '3 bulan',
};

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

// Custom tooltip
function BalanceTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-2 shadow-md text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="flex justify-between gap-3">
          <span>{entry.dataKey === 'balance' ? 'Saldo' : entry.dataKey}</span>
          <span className="font-semibold">{formatRupiah(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

export default function SourceBalanceSection() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('1m');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const { data: data, isFetching: fetching } = useQuery<BalanceHistoryData>({
    queryKey: ['finance', 'balance-history', period],
    queryFn: async () => {
      const res = await fetch(`/api/finance/sources/balance-history?period=${period}`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 30_000,
  });

  // Reset selected index when data/period changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIdx(0);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [data, period]);

  const handleCardClick = useCallback((idx: number) => {
    setSelectedIdx(idx);
    cardRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, []);

  // Handle scroll to update selected index (for mobile swipe)
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !data) return;
    const container = scrollRef.current;
    const scrollLeft = container.scrollLeft;
    const cardWidth = container.firstElementChild?.getBoundingClientRect().width || 0;
    const gap = 10; // gap-2.5
    const idx = Math.round(scrollLeft / (cardWidth + gap));
    if (idx >= 0 && idx < data.sources.length && idx !== selectedIdx) {
      setSelectedIdx(idx);
    }
  }, [data, selectedIdx]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-3 sm:p-4 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-16 rounded-lg" />
          <div className="flex gap-2.5 overflow-hidden">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-40 rounded-lg flex-shrink-0" />)}
          </div>
          <Skeleton className="h-40 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.sources.length === 0) return null;

  const totalBalance = data.sources.reduce((s, src) => s + src.currentBalance, 0);
  const totalChange = data.sources.reduce((s, src) => s + src.periodChange, 0);
  const selectedSource = data.sources[selectedIdx];
  const color = CHART_COLORS[selectedIdx % CHART_COLORS.length];

  const chartData = selectedSource.dailyData.map(d => ({
    date: d.date,
    label: d.label,
    balance: d.balance,
    [selectedSource.name]: d.balance,
  }));

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-3 sm:pb-3 sm:pt-4 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Saldo Sumber Dana
            <ChartInfo text="Saldo dihitung mundur dari saldo saat ini dikurangi transaksi di periode tersebut. Pastikan saldo sumber dana sudah diisi dengan benar untuk akurasi." />
          </CardTitle>
          <div className="flex gap-1">
            {PERIOD_OPTIONS.map(opt => (
              <Button
                key={opt.value}
                size="sm"
                variant={period === opt.value ? 'default' : 'outline'}
                className="h-6 sm:h-7 text-[10px] sm:text-xs px-2 sm:px-2.5"
                onClick={() => setPeriod(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-2.5 sm:space-y-3">

        {/* ── Total Balance Hero (compact) ── */}
        <div className="rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/15 px-3 py-2.5 sm:px-4 sm:py-3">
          <p className="text-[10px] sm:text-xs text-muted-foreground">Total Saldo Semua Sumber</p>
          <p className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight leading-tight">{formatRupiah(totalBalance)}</p>
          <div className="flex items-center gap-1 mt-0.5">
            {totalChange >= 0 ? (
              <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-500 dark:text-red-400" />
            )}
            <span className={cn(
              'text-[10px] sm:text-xs font-medium',
              totalChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
            )}>
              {totalChange >= 0 ? '+' : ''}{formatRupiah(totalChange)}
            </span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">dalam {PERIOD_LABELS[period] || period}</span>
          </div>
        </div>

        {/* ── Horizontal Scrollable Source Cards ── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-0.5 px-0.5"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {data.sources.map((src, idx) => {
            const isActive = idx === selectedIdx;
            const changePct = src.startBalance !== 0
              ? Math.round(((src.currentBalance - src.startBalance) / Math.abs(src.startBalance)) * 100)
              : 0;
            const cardColor = CHART_COLORS[idx % CHART_COLORS.length];
            return (
              <div
                key={src.id}
                ref={el => { cardRefs.current[idx] = el; }}
                onClick={() => handleCardClick(idx)}
                className={cn(
                  'flex-shrink-0 w-[165px] sm:w-[195px] lg:w-[220px] snap-start rounded-lg border-2 p-2.5 sm:p-3 transition-all cursor-pointer select-none',
                  isActive
                    ? 'border-primary/40 bg-primary/5 shadow-sm'
                    : 'border-transparent bg-muted/40 hover:bg-muted/60'
                )}
              >
                {/* Header: emoji + name + change */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center text-sm sm:text-base flex-shrink-0"
                      style={{ backgroundColor: `${cardColor}15` }}
                    >
                      {src.emoji}
                    </div>
                    <span className="text-xs sm:text-sm font-semibold truncate">{src.name}</span>
                  </div>
                  <span className={cn(
                    'flex items-center gap-0.5 text-[10px] font-semibold flex-shrink-0',
                    src.periodChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                  )}>
                    {src.periodChange >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    <span className="hidden sm:inline">{formatRupiah(Math.abs(src.periodChange))}</span>
                    <span className="sm:hidden">{Math.abs(src.periodChange) >= 1000000 ? `${(Math.abs(src.periodChange) / 1000000).toFixed(1)}jt` : Math.abs(src.periodChange) >= 1000 ? `${(Math.abs(src.periodChange) / 1000).toFixed(0)}rb` : `${Math.abs(src.periodChange)}`}</span>
                  </span>
                </div>

                {/* Balance */}
                <p className={cn(
                  'text-base sm:text-lg lg:text-xl font-bold tracking-tight leading-tight mb-2',
                  src.currentBalance >= 0 ? 'text-foreground' : 'text-red-600'
                )}>
                  {src.currentBalance < 0 ? '-' : ''}{formatRupiah(Math.abs(src.currentBalance))}
                </p>

                {/* Footer: start balance + percentage */}
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Awal {formatRupiah(src.startBalance)}</span>
                  {changePct !== 0 && (
                    <span className={cn(
                      'font-semibold',
                      changePct > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                    )}>
                      {changePct > 0 ? '+' : ''}{changePct}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Dot Indicators ── */}
        {data.sources.length > 1 && (
          <div className="flex justify-center gap-1 lg:hidden">
            {data.sources.map((src, idx) => (
              <button
                key={src.id}
                onClick={() => handleCardClick(idx)}
                className={cn(
                  'h-1 rounded-full transition-all',
                  idx === selectedIdx
                    ? 'w-5 bg-primary'
                    : 'w-1 bg-muted-foreground/25'
                )}
                aria-label={`Pilih ${src.name}`}
              />
            ))}
          </div>
        )}

        {/* ── Selected Source Summary (inline row) ── */}
        {selectedSource && (
          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs bg-muted/30 rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2">
            <span className="text-emerald-600 dark:text-emerald-400">
              ↑ {formatRupiah(selectedSource.periodIncome)}
            </span>
            <span className="text-muted-foreground/50">|</span>
            <span className="text-red-500 dark:text-red-400">
              ↓ {formatRupiah(selectedSource.periodExpense)}
            </span>
            <span className="text-muted-foreground/50">|</span>
            <span className={cn(
              'font-medium',
              selectedSource.periodChange >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            )}>
              Σ {selectedSource.periodChange >= 0 ? '+' : ''}{formatRupiah(selectedSource.periodChange)}
            </span>
          </div>
        )}

        {/* ── Chart ── */}
        {selectedSource.dailyData.length > 1 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1 sm:mb-2">
              <h4 className="text-[10px] sm:text-xs font-semibold text-muted-foreground">
                Tren{data.sources.length > 1 ? `: ${selectedSource.emoji} ${selectedSource.name}` : ' Saldo'}
              </h4>
              {/* Desktop legend pills */}
              <div className="hidden lg:flex flex-wrap gap-2 ml-auto">
                {data.sources.map((src, idx) => {
                  const isActive = idx === selectedIdx;
                  return (
                    <button
                      key={src.id}
                      onClick={() => handleCardClick(idx)}
                      className={cn(
                        'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors',
                        isActive
                          ? 'border-foreground/20 bg-foreground/5 font-medium'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                      {src.emoji} {src.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="h-36 sm:h-44 lg:h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id={`bg-${selectedIdx}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.12} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9 }}
                    interval={data.days <= 7 ? 0 : data.days <= 30 ? 4 : 9}
                  />
                  <YAxis
                    tick={{ fontSize: 9 }}
                    tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${(v / 1000).toFixed(0)}rb` : String(v)}
                    width={45}
                  />
                  <RechartsTooltip content={<BalanceTooltip />} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" opacity={0.3} />
                  <Line
                    type="monotone"
                    dataKey={selectedSource.name}
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}