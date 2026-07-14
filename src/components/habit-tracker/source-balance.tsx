'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
          <button type="button" className="inline-flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0" aria-label="Info">
            <Info className="w-3.5 h-3.5" />
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
    <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="flex justify-between gap-4">
          <span>{entry.dataKey === 'balance' ? 'Saldo' : entry.dataKey}</span>
          <span className="font-semibold">{formatRupiah(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

export default function SourceBalanceSection() {
  const [data, setData] = useState<BalanceHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('1m');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/finance/sources/balance-history?period=${period}`);
        if (!cancelled) {
          if (res.ok) setData(await res.json());
          else setData(null);
        }
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [period]);

  // Reset selected index when data/period changes
  useEffect(() => {
    setSelectedIdx(0);
    // Scroll to first card
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
    const gap = 12; // gap-3
    const idx = Math.round(scrollLeft / (cardWidth + gap));
    if (idx >= 0 && idx < data.sources.length && idx !== selectedIdx) {
      setSelectedIdx(idx);
    }
  }, [data, selectedIdx]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-4">
          <Skeleton className="h-5 w-48" />
          <div className="flex gap-1">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-7 w-16 rounded-md" />)}
          </div>
          <Skeleton className="h-20 rounded-xl" />
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 w-48 rounded-xl flex-shrink-0" />)}
          </div>
          <Skeleton className="h-56 rounded-xl" />
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
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Saldo Sumber Dana
            <ChartInfo text="Saldo dihitung mundur dari saldo saat ini dikurangi transaksi di periode tersebut. Pastikan saldo sumber dana sudah diisi dengan benar untuk akurasi." />
          </CardTitle>
          <div className="flex gap-1">
            {PERIOD_OPTIONS.map(opt => (
              <Button
                key={opt.value}
                size="sm"
                variant={period === opt.value ? 'default' : 'outline'}
                className="h-7 text-xs px-2.5"
                onClick={() => setPeriod(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {/* ── Total Balance Hero ── */}
        <div className="rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/15 p-4">
          <p className="text-xs text-muted-foreground mb-0.5">Total Saldo Semua Sumber</p>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight">{formatRupiah(totalBalance)}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            {totalChange >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
            )}
            <span className={cn(
              'text-xs font-medium',
              totalChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
            )}>
              {totalChange >= 0 ? '+' : ''}{formatRupiah(totalChange)}
            </span>
            <span className="text-xs text-muted-foreground">dalam {PERIOD_LABELS[period] || period}</span>
          </div>
        </div>

        {/* ── Horizontal Scrollable Source Cards ── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-1 -mx-1 px-1"
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
                  'flex-shrink-0 w-[200px] sm:w-[220px] snap-start rounded-xl border-2 p-4 transition-all cursor-pointer select-none',
                  isActive
                    ? 'border-primary/40 bg-primary/5 shadow-sm'
                    : 'border-transparent bg-muted/40 hover:bg-muted/60'
                )}
              >
                {/* Header: emoji + name + change */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                      style={{ backgroundColor: `${cardColor}15` }}
                    >
                      {src.emoji}
                    </div>
                    <span className="text-sm font-semibold truncate">{src.name}</span>
                  </div>
                  <span className={cn(
                    'flex items-center gap-0.5 text-[11px] font-semibold flex-shrink-0',
                    src.periodChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                  )}>
                    {src.periodChange >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    {formatRupiah(Math.abs(src.periodChange))}
                  </span>
                </div>

                {/* Balance */}
                <p className={cn(
                  'text-xl font-bold tracking-tight leading-tight mb-3',
                  src.currentBalance >= 0 ? 'text-foreground' : 'text-red-600'
                )}>
                  {src.currentBalance < 0 ? '-' : ''}{formatRupiah(Math.abs(src.currentBalance))}
                </p>

                {/* Footer: percentage + start balance */}
                <div className="flex items-center justify-between text-[11px]">
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

        {/* ── Dot Indicators (only show if scrolling on mobile) ── */}
        {data.sources.length > 1 && (
          <div className="flex justify-center gap-1.5 lg:hidden">
            {data.sources.map((src, idx) => (
              <button
                key={src.id}
                onClick={() => handleCardClick(idx)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  idx === selectedIdx
                    ? 'w-6 bg-primary'
                    : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                )}
                aria-label={`Pilih ${src.name}`}
              />
            ))}
          </div>
        )}

        {/* ── Selected Source Summary ── */}
        {selectedSource && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/50 p-2.5 text-center">
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mb-0.5">Pemasukan</p>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{formatRupiah(selectedSource.periodIncome)}</p>
            </div>
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/50 p-2.5 text-center">
              <p className="text-[10px] text-red-600 dark:text-red-400 mb-0.5">Pengeluaran</p>
              <p className="text-sm font-bold text-red-600 dark:text-red-400">{formatRupiah(selectedSource.periodExpense)}</p>
            </div>
            <div className="rounded-lg bg-muted/50 border p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-1">
                <ArrowLeftRight className="h-2.5 w-2.5" /> Bersih
              </p>
              <p className={cn(
                'text-sm font-bold',
                selectedSource.periodChange >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              )}>
                {selectedSource.periodChange >= 0 ? '+' : ''}{formatRupiah(selectedSource.periodChange)}
              </p>
            </div>
          </div>
        )}

        {/* ── Chart (single source, or multi-source on desktop) ── */}
        {selectedSource.dailyData.length > 1 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-xs font-semibold text-muted-foreground">
                Tren Saldo{data.sources.length > 1 ? `: ${selectedSource.emoji} ${selectedSource.name}` : ''}
              </h4>
              {/* On desktop, show all-source legend toggle */}
              <div className="hidden lg:flex flex-wrap gap-2.5 ml-auto">
                {data.sources.map((src, idx) => {
                  const isActive = idx === selectedIdx;
                  return (
                    <button
                      key={src.id}
                      onClick={() => handleCardClick(idx)}
                      className={cn(
                        'flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border transition-colors',
                        isActive
                          ? 'border-foreground/20 bg-foreground/5 font-medium'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                      {src.emoji} {src.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id={`balanceGrad-${selectedIdx}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    interval={data.days <= 7 ? 0 : data.days <= 30 ? 4 : 9}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${(v / 1000).toFixed(0)}rb` : String(v)}
                    width={55}
                  />
                  <RechartsTooltip content={<BalanceTooltip />} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" opacity={0.4} />
                  <Line
                    type="monotone"
                    dataKey={selectedSource.name}
                    stroke={color}
                    strokeWidth={2.5}
                    dot={data.days <= 14}
                    activeDot={{ r: 5, strokeWidth: 2 }}
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