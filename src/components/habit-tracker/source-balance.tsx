'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ReferenceLine } from 'recharts';
import { Wallet, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-5 w-48 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
          <Skeleton className="h-64 mt-4 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.sources.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Saldo per Sumber Dana
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
        {/* Source cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {data.sources.map((src, idx) => {
            const changePct = src.startBalance !== 0
              ? Math.round(((src.currentBalance - src.startBalance) / Math.abs(src.startBalance)) * 100)
              : 0;
            return (
              <div key={src.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-base shrink-0">{src.emoji}</span>
                    <span className="text-xs font-medium truncate">{src.name}</span>
                  </div>
                  <span className={cn(
                    'text-[10px] font-medium flex items-center gap-0.5 shrink-0',
                    src.periodChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                  )}>
                    {src.periodChange >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {formatRupiah(Math.abs(src.periodChange))}
                  </span>
                </div>
                <p className={cn(
                  'text-lg font-bold leading-tight',
                  src.currentBalance >= 0 ? 'text-foreground' : 'text-red-600'
                )}>
                  {src.currentBalance < 0 ? '-' : ''}{formatRupiah(Math.abs(src.currentBalance))}
                </p>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Awal: {formatRupiah(src.startBalance)}</span>
                  {changePct !== 0 && (
                    <span className={changePct > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>
                      {changePct > 0 ? '+' : ''}{changePct}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Combined line chart */}
        {data.sources.some(s => s.dailyData.length > 1) && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-xs font-semibold text-muted-foreground">Tren Saldo</h4>
              <div className="flex flex-wrap gap-3 ml-auto">
                {data.sources.map((src, idx) => (
                  <span key={src.id} className="flex items-center gap-1 text-[10px]">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                    {src.emoji} {src.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mergeDailyData(data.sources)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
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
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" opacity={0.5} />
                  {data.sources.map((src, idx) => (
                    <Line
                      key={src.id}
                      type="monotone"
                      dataKey={src.name}
                      stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={data.days <= 14}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Merge daily data from multiple sources into one array for Recharts
function mergeDailyData(sources: SourceBalance[]): Record<string, string | number | null>[] {
  if (sources.length === 0) return [];
  // Use the first source's daily data as the base
  const base = sources[0].dailyData;
  return base.map(day => {
    const point: Record<string, string | number | null> = {
      date: day.date,
      label: day.label,
    };
    for (const src of sources) {
      const match = src.dailyData.find(d => d.date === day.date);
      point[src.name] = match?.balance ?? null;
    }
    return point;
  });
}