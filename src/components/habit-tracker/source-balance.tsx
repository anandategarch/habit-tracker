'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatRupiah, CHART_COLORS, type FundSource, type Transaction } from './finance-types';
import { cn } from '@/lib/utils';
import { jakartaDateString } from '@/lib/timezone';

function ChartInfo({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
            aria-label="Info"
          >
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

export default function SourceBalanceSection() {
  // ── Fetch sources (real-time balance from FundSource table) ────────────
  // Balance is updated atomically when transactions are created/updated/deleted,
  // so this always reflects the current actual balance — no period calculation needed.
  const { data: sources = [], isLoading: loading } = useQuery<FundSource[]>({
    queryKey: ['finance', 'sources'],
    queryFn: async () => {
      const res = await fetch('/api/finance/sources');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 15_000,
  });

  // ── Fetch today's transactions (for income/expense today per source) ───
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
      <Card>
        <CardContent className="p-3 sm:p-4 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-16 rounded-lg" />
          <div className="flex gap-2.5 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-40 rounded-lg flex-shrink-0" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sources.length === 0) return null;

  // ── Calculate today's income/expense per source ────────────────────────
  const todayFlowBySource = new Map<string, { income: number; expense: number }>();
  for (const tx of todayTx) {
    const flow = todayFlowBySource.get(tx.source) || { income: 0, expense: 0 };
    if (tx.type === 'income') flow.income += tx.amount;
    else flow.expense += tx.amount;
    todayFlowBySource.set(tx.source, flow);
  }

  const totalBalance = sources.reduce((s, src) => s + src.balance, 0);
  const todayTotalIncome = todayTx
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const todayTotalExpense = todayTx
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const todayNet = todayTotalIncome - todayTotalExpense;

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-3 sm:pb-3 sm:pt-4 sm:px-4">
        <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Saldo Sumber Dana
          <ChartInfo text="Saldo real-time per sumber dana. Saldo otomatis terupdate saat Anda menambah, mengedit, atau menghapus transaksi. Arus kas hari ini ditampilkan di bawah setiap kartu." />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-2.5 sm:space-y-3">
        {/* ── Total Balance Hero ── */}
        <div className="rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/15 px-3 py-2.5 sm:px-4 sm:py-3">
          <p className="text-[10px] sm:text-xs text-muted-foreground">Total Saldo Semua Sumber</p>
          <p className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight leading-tight">
            {formatRupiah(totalBalance)}
          </p>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] sm:text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
              <ArrowUpRight className="h-3 w-3" />
              {formatRupiah(todayTotalIncome)}
            </span>
            <span className="text-muted-foreground/50">|</span>
            <span className="text-red-500 dark:text-red-400 flex items-center gap-0.5">
              <ArrowDownRight className="h-3 w-3" />
              {formatRupiah(todayTotalExpense)}
            </span>
            <span className="text-muted-foreground/50">|</span>
            <span
              className={cn(
                'font-medium',
                todayNet >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-500 dark:text-red-400'
              )}
            >
              Σ {todayNet >= 0 ? '+' : ''}
              {formatRupiah(todayNet)}
            </span>
            <span className="text-muted-foreground">hari ini</span>
          </div>
        </div>

        {/* ── Source Cards (horizontal scroll) ── */}
        <div
          className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-0.5 px-0.5"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {sources.map((src, idx) => {
            const cardColor = CHART_COLORS[idx % CHART_COLORS.length];
            const flow = todayFlowBySource.get(src.name) || { income: 0, expense: 0 };
            const netToday = flow.income - flow.expense;

            return (
              <div
                key={src.id}
                className="flex-shrink-0 w-[165px] sm:w-[195px] lg:w-[220px] snap-start rounded-lg border-2 border-transparent bg-muted/40 hover:bg-muted/60 p-2.5 sm:p-3 transition-colors"
              >
                {/* Header: emoji + name */}
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
                </div>

                {/* Balance (real-time) */}
                <p
                  className={cn(
                    'text-base sm:text-lg lg:text-xl font-bold tracking-tight leading-tight mb-2',
                    src.balance >= 0 ? 'text-foreground' : 'text-red-600'
                  )}
                >
                  {src.balance < 0 ? '-' : ''}
                  {formatRupiah(Math.abs(src.balance))}
                </p>

                {/* Today's flow */}
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                    <ArrowUpRight className="h-2.5 w-2.5" />
                    {flow.income >= 1000000
                      ? `${(flow.income / 1000000).toFixed(1)}jt`
                      : flow.income >= 1000
                        ? `${(flow.income / 1000).toFixed(0)}rb`
                        : `${flow.income}`}
                  </span>
                  <span className="text-red-500 dark:text-red-400 flex items-center gap-0.5">
                    <ArrowDownRight className="h-2.5 w-2.5" />
                    {flow.expense >= 1000000
                      ? `${(flow.expense / 1000000).toFixed(1)}jt`
                      : flow.expense >= 1000
                        ? `${(flow.expense / 1000).toFixed(0)}rb`
                        : `${flow.expense}`}
                  </span>
                  {netToday !== 0 && (
                    <span
                      className={cn(
                        'font-semibold',
                        netToday > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-500 dark:text-red-400'
                      )}
                    >
                      {netToday > 0 ? '+' : ''}
                      {Math.abs(netToday) >= 1000000
                        ? `${(Math.abs(netToday) / 1000000).toFixed(1)}jt`
                        : Math.abs(netToday) >= 1000
                          ? `${(Math.abs(netToday) / 1000).toFixed(0)}rb`
                          : `${Math.abs(netToday)}`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
