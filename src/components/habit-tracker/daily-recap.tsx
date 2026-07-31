'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, Zap, Target, Flame,
  Trophy, Sparkles, Clock, ArrowUpRight, ArrowDownRight, Coffee, Moon,
  Activity, Brain, Award, Calendar, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRupiah, compactRupiah } from './finance-types';
import { CountUpRupiah, CountUpNumber } from './count-up';

// ── Types (mirrors API response) ─────────────────────────────────────────

interface TodayTransaction {
  id: string;
  type: string;
  amount: number;
  category: string;
  description: string | null;
  hour: number;
  source: string;
}

interface DailyRecap {
  date: string;
  today: {
    income: number;
    expense: number;
    net: number;
    transactionCount: number;
    transactions: TodayTransaction[];
    categories: Array<{ name: string; amount: number; count: number }>;
    sources: Array<{ name: string; amount: number }>;
    hourlyBreakdown: number[];
    peakHour: { hour: number; amount: number } | null;
    topTransaction: TodayTransaction | null;
  };
  comparison: {
    vsYesterday: { expense: number; changePct: number | null; direction: string };
    vs7DayAverage: { average: number; changePct: number | null; direction: string };
  };
  streaks: {
    noSpendStreak: number;
    smartSpenderStreak: number;
    budgetStreak: number;
  };
  predictions: {
    monthEndProjection: number;
    burnRate: number;
    trendDirection: { slope: number; direction: string };
    budgetETA: { daysLeft: number; willExceed: boolean; projectedOver: number } | null;
    smartCapTomorrow: number | null;
  };
  alerts: Array<{
    type: string;
    severity: 'info' | 'warning' | 'danger';
    message: string;
    data?: Record<string, unknown>;
  }>;
  patterns: {
    bestDayThisMonth: { date: string; amount: number } | null;
    worstDayThisMonth: { date: string; amount: number } | null;
    dayOfWeekPattern: Array<{ day: string; avgAmount: number; count: number }>;
    personalityTag: { tag: string; emoji: string; description: string };
    transactionDiversity: number;
    cashFlowHealth: { ratio: number; status: 'healthy' | 'warning' | 'danger' };
    savingsRate: number;
    categoryAnomaly: Array<{ category: string; zScore: number; amount: number; isAnomaly: boolean; avgAmount: number }>;
  };
  gamification: {
    dailyBadge: { id: string; name: string; emoji: string; description: string } | null;
    comboMultiplier: number;
    personalRecord: { isRecord: boolean; amount: number; rank: number; totalDays: number } | null;
  };
  sparkline: {
    daily7d: Array<{ date: string; amount: number; isToday: boolean }>;
    isTodayLowest: boolean;
    isTodayHighest: boolean;
  };
  dailyBudget: {
    target: number | null;
    spent: number;
    remaining: number;
    percentage: number;
    status: 'under' | 'on_track' | 'nearing' | 'over' | 'no_budget';
  } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const HOUR_LABELS = ['00', '03', '06', '09', '12', '15', '18', '21'];

function formatHour(h: number): string {
  if (h === 0) return '00:00';
  return `${String(h).padStart(2, '0')}:00`;
}

function formatDateShort(d: string): string {
  // d = "2026-07-31" → "31 Jul"
  const [y, m, day] = d.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(day));
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

// ── Sparkline (mini 7-day line chart, no library) ────────────────────────

function MiniSparkline({ data }: { data: Array<{ date: string; amount: number; isToday: boolean }> }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.amount), 1);
  const W = 100, H = 28;
  const step = W / (data.length - 1 || 1);
  const points = data.map((d, i) => {
    const x = i * step;
    const y = H - (d.amount / max) * (H - 4) - 2;
    return { x, y, ...d };
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const areaPath = `${path} L ${W} ${H} L 0 ${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-7" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#spark-grad)" className="text-primary" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={p.isToday ? 2.2 : 1.2}
          className={p.isToday ? 'text-primary' : 'text-muted-foreground'}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

// ── Progress Ring (circular progress, Apple Watch style) ──────────────────

function ProgressRing({
  percentage,
  size = 56,
  strokeWidth = 5,
  status = 'under',
  children,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  status?: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.min(percentage, 100);
  const offset = circumference - (clampedPct / 100) * circumference;

  const colorClass =
    status === 'over' ? 'text-red-500'
    : status === 'nearing' ? 'text-amber-500'
    : status === 'on_track' ? 'text-primary'
    : 'text-emerald-500';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn('transition-all duration-700 ease-out', colorClass)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

// ── Hourly Heatmap (24-bar mini viz) ─────────────────────────────────────

function HourlyHeatmap({ hourly }: { hourly: number[] }) {
  const max = Math.max(...hourly, 1);
  return (
    <div className="flex items-end gap-[2px] h-8">
      {hourly.map((amt, h) => {
        const hRatio = amt / max;
        const isLateNight = h >= 22 || h < 5;
        const isMorning = h >= 5 && h < 12;
        const isAfternoon = h >= 12 && h < 18;
        const color = amt === 0 ? 'bg-muted/40'
          : isLateNight ? 'bg-purple-400'
          : isMorning ? 'bg-amber-400'
          : isAfternoon ? 'bg-primary'
          : 'bg-blue-400';
        return (
          <Tooltip key={h}>
            <TooltipTrigger asChild>
              <div
                className={cn('flex-1 min-w-[3px] rounded-sm transition-all hover:opacity-80', color)}
                style={{ height: amt === 0 ? '4px' : `${Math.max(8, hRatio * 100)}%` }}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p className="font-medium">{formatHour(h)}</p>
              <p className="text-muted-foreground">{amt > 0 ? formatRupiah(amt) : '—'}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ── Comparison Pill ──────────────────────────────────────────────────────

function ComparisonPill({ changePct, direction, label }: { changePct: number | null; direction: string; label: string }) {
  if (changePct === null || direction === 'unknown') {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span>{label}: —</span>
      </div>
    );
  }
  const isUp = direction === 'up';
  const isSame = direction === 'same';
  // For expense, "down" is good (green), "up" is bad (red)
  const colorClass = isSame ? 'text-muted-foreground'
    : isUp ? 'text-red-500'
    : 'text-emerald-500';
  const Icon = isSame ? Minus : isUp ? TrendingUp : TrendingDown;
  return (
    <div className={cn('flex items-center gap-1 text-xs font-medium', colorClass)}>
      <Icon className="h-3 w-3" />
      <span>{label} {Math.abs(changePct)}%</span>
    </div>
  );
}

// ── Alert Chip ───────────────────────────────────────────────────────────

function AlertChip({ alert }: { alert: DailyRecap['alerts'][number] }) {
  const severityClass =
    alert.severity === 'danger' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900'
    : alert.severity === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900'
    : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900';
  const Icon = alert.type === 'late_night' ? Moon
    : alert.type === 'big_ticket' ? Zap
    : alert.type === 'over_budget' ? AlertTriangle
    : alert.type === 'nearing_budget' ? Target
    : alert.type === 'unusual_activity' ? Activity
    : alert.type === 'recurring' ? Calendar
    : Sparkles;
  return (
    <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border', severityClass)}>
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{alert.message}</span>
    </div>
  );
}

// ── Stat Tile ────────────────────────────────────────────────────────────

function StatTile({
  label, value, icon: Icon, iconClass, valueClass,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  iconClass?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className={cn('flex items-center justify-center w-7 h-7 rounded-lg shrink-0', iconClass ?? 'bg-muted/50 text-muted-foreground')}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{label}</p>
        <p className={cn('text-sm font-semibold truncate', valueClass)}>{value}</p>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────

export default function DailyRecap() {
  const { data: recap, isLoading } = useQuery<DailyRecap>({
    queryKey: ['finance', 'daily-recap'],
    queryFn: async () => {
      const res = await fetch('/api/finance/daily-recap');
      if (!res.ok) throw new Error('Failed to fetch daily recap');
      return res.json();
    },
    staleTime: 30_000,
  });

  if (isLoading || !recap) {
    return (
      <Card className="overflow-hidden">
        <div className="p-4 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-40" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        </div>
      </Card>
    );
  }

  const { today, comparison, streaks, predictions, alerts, patterns, gamification, sparkline, dailyBudget } = recap;

  // ── Empty state: no transactions today ─────────────────────────────
  const isEmpty = today.transactionCount === 0 && today.income === 0;

  if (isEmpty) {
    return (
      <Card className="overflow-hidden anim-stagger">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-4 py-6 sm:px-6 text-center">
          <div className="text-3xl mb-2">🌤️</div>
          <p className="text-sm font-semibold">Belum ada aktivitas hari ini</p>
          <p className="text-xs text-muted-foreground mt-1">
            Catat transaksi pertama untuk mulai melacak insight harianmu
          </p>
          {patterns.personalityTag && (
            <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-background/60 backdrop-blur-sm border border-border/50">
              <span>{patterns.personalityTag.emoji}</span>
              <span className="text-xs font-medium">{patterns.personalityTag.tag}</span>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden anim-stagger">
      {/* ── HERO SECTION ─────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-4 py-4 sm:px-6 sm:py-5">
        {/* Top row: label + date + budget ring */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs text-muted-foreground font-medium">Hari Ini</p>
              {gamification.dailyBadge && (
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 gap-0.5">
                  <span>{gamification.dailyBadge.emoji}</span>
                  <span className="font-medium">{gamification.dailyBadge.name}</span>
                </Badge>
              )}
            </div>
            <p className={cn(
              'text-2xl sm:text-3xl font-bold tracking-tight',
              today.expense > 0 ? 'text-foreground' : 'text-emerald-500'
            )}>
              <CountUpRupiah amount={today.expense} />
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              total pengeluaran · <CountUpNumber value={today.transactionCount} /> transaksi
            </p>
          </div>

          {/* Budget ring (if set) */}
          {dailyBudget && dailyBudget.target && (
            <div className="flex flex-col items-center gap-1 shrink-0">
              <ProgressRing percentage={dailyBudget.percentage} status={dailyBudget.status} size={56}>
                <div className="text-center">
                  <p className="text-[10px] font-bold leading-none">{dailyBudget.percentage}%</p>
                </div>
              </ProgressRing>
              <p className="text-[9px] text-muted-foreground text-center leading-tight">
                dari<br />{compactRupiah(dailyBudget.target)}
              </p>
            </div>
          )}
        </div>

        {/* Comparison pills row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
          <ComparisonPill
            changePct={comparison.vsYesterday.changePct}
            direction={comparison.vsYesterday.direction}
            label="vs kemarin"
          />
          <ComparisonPill
            changePct={comparison.vs7DayAverage.changePct}
            direction={comparison.vs7DayAverage.direction}
            label="vs 7 hari"
          />
          {predictions.trendDirection.direction !== 'flat' && (
            <div className={cn(
              'flex items-center gap-1 text-xs font-medium',
              predictions.trendDirection.direction === 'up' ? 'text-red-500' : 'text-emerald-500'
            )}>
              {predictions.trendDirection.direction === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span>Tren {predictions.trendDirection.direction === 'up' ? 'naik' : 'turun'}</span>
            </div>
          )}
        </div>

        {/* Sparkline */}
        <div className="mt-3 -mb-1">
          <MiniSparkline data={sparkline.daily7d} />
          <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
            <span>7 hari lalu</span>
            <span>Hari ini</span>
          </div>
        </div>
      </div>

      {/* ── ALERTS (if any) ──────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <>
          <div className="border-t border-border" />
          <div className="px-4 py-2.5 sm:px-6 flex flex-wrap gap-1.5">
            {alerts.map((alert, i) => (
              <AlertChip key={i} alert={alert} />
            ))}
          </div>
        </>
      )}

      {/* ── 3 STAT TILES: income / expense / net ─────────────────────── */}
      <div className="border-t border-border" />
      <div className="grid grid-cols-3 divide-x divide-border">
        <div className="px-3 py-2.5">
          <StatTile
            label="Masuk"
            value={<CountUpRupiah amount={today.income} />}
            icon={ArrowUpRight}
            iconClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
            valueClass="text-emerald-600 dark:text-emerald-400"
          />
        </div>
        <div className="px-3 py-2.5">
          <StatTile
            label="Keluar"
            value={<CountUpRupiah amount={today.expense} />}
            icon={ArrowDownRight}
            iconClass="bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400"
            valueClass="text-red-600 dark:text-red-400"
          />
        </div>
        <div className="px-3 py-2.5">
          <StatTile
            label="Bersih"
            value={<CountUpRupiah amount={today.net} />}
            icon={Activity}
            iconClass={cn(
              'bg-muted/50',
              today.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            )}
            valueClass={today.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
          />
        </div>
      </div>

      {/* ── BUDGET PROGRESS BAR (if set, and not already shown as ring) ── */}
      {dailyBudget && dailyBudget.target && dailyBudget.status === 'over' && (
        <>
          <div className="border-t border-border" />
          <div className="px-4 py-2.5 sm:px-6 bg-red-50/50 dark:bg-red-950/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Over budget
              </span>
              <span className="text-xs font-bold text-red-600 dark:text-red-400">
                +{formatRupiah(Math.abs(dailyBudget.remaining))}
              </span>
            </div>
            <Progress value={Math.min(dailyBudget.percentage, 100)} className="h-1.5 bg-red-100 dark:bg-red-950/50" />
          </div>
        </>
      )}

      {/* ── INSIGHTS GRID ────────────────────────────────────────────── */}
      <div className="border-t border-border" />
      <div className="px-4 py-3 sm:px-6 space-y-3">

        {/* Personality tag + streaks row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
            <span className="text-sm">{patterns.personalityTag.emoji}</span>
            <span className="text-xs font-semibold text-primary">{patterns.personalityTag.tag}</span>
          </div>
          {streaks.noSpendStreak > 0 && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 text-xs font-medium">
              <Sparkles className="h-3 w-3" />
              {streaks.noSpendStreak} hari no-spend
            </div>
          )}
          {streaks.smartSpenderStreak >= 2 && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-xs font-medium">
              <Flame className="h-3 w-3" />
              {streaks.smartSpenderStreak}× hemat
            </div>
          )}
          {streaks.budgetStreak >= 2 && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 text-xs font-medium">
              <Target className="h-3 w-3" />
              {streaks.budgetStreak}× on budget
            </div>
          )}
          {gamification.comboMultiplier > 1 && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 text-xs font-bold">
              🔥 {gamification.comboMultiplier}× Combo
            </div>
          )}
        </div>

        {/* Personality description */}
        <p className="text-xs text-muted-foreground italic">
          {patterns.personalityTag.description}
        </p>

        {/* Predictions row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/30 p-2.5">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Proyeksi bulan</span>
            </div>
            <p className="text-sm font-bold">{formatRupiah(predictions.monthEndProjection)}</p>
            {predictions.budgetETA && predictions.budgetETA.willExceed && (
              <p className="text-[10px] text-red-500 mt-0.5">
                ⚠️ Over {formatRupiah(predictions.budgetETA.projectedOver)}
              </p>
            )}
          </div>
          <div className="rounded-lg bg-muted/30 p-2.5">
            <div className="flex items-center gap-1 mb-0.5">
              <Zap className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Burn rate</span>
            </div>
            <p className="text-sm font-bold">{formatRupiah(predictions.burnRate)}/hari</p>
            {predictions.smartCapTomorrow !== null && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Besok max {compactRupiah(predictions.smartCapTomorrow)}
              </p>
            )}
          </div>
        </div>

        {/* Peak hour + top transaction */}
        {today.peakHour && (
          <div className="flex items-center gap-2 text-xs">
            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Spending tertinggi:</span>
            <span className="font-medium">{formatHour(today.peakHour.hour)}</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-medium">{formatRupiah(today.peakHour.amount)}</span>
          </div>
        )}
        {today.topTransaction && (
          <div className="flex items-center gap-2 text-xs">
            <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="text-muted-foreground">Transaksi terbesar:</span>
            <span className="font-medium">{today.topTransaction.category}</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-medium">{formatRupiah(today.topTransaction.amount)}</span>
          </div>
        )}

        {/* Hourly heatmap */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Aktivitas per jam</span>
            </div>
            <span className="text-[10px] text-muted-foreground">24 jam</span>
          </div>
          <TooltipProvider delayDuration={200}>
            <HourlyHeatmap hourly={today.hourlyBreakdown} />
          </TooltipProvider>
          <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
            {HOUR_LABELS.map((h) => <span key={h}>{h}</span>)}
          </div>
        </div>

        {/* Category pills */}
        {today.categories.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <Brain className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Kategori</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {today.categories.map((cat) => {
                const pct = today.expense > 0 ? Math.round((cat.amount / today.expense) * 100) : 0;
                return (
                  <div
                    key={cat.name}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50 border border-border/50 text-xs"
                  >
                    <span className="font-medium">{cat.name}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-semibold">{formatRupiah(cat.amount)}</span>
                    <span className="text-[10px] text-muted-foreground">({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Gamification: personal record */}
        {gamification.personalRecord && (
          <div className={cn(
            'rounded-lg p-2.5 border',
            gamification.personalRecord.isRecord
              ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900'
              : 'bg-muted/30 border-border/50'
          )}>
            <div className="flex items-center gap-2">
              <Award className={cn(
                'h-4 w-4 shrink-0',
                gamification.personalRecord.isRecord ? 'text-amber-500' : 'text-muted-foreground'
              )} />
              <div className="flex-1 min-w-0">
                {gamification.personalRecord.isRecord ? (
                  <>
                    <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      🏆 NEW RECORD! Pengeluaran terendah {gamification.personalRecord.totalDays} hari
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Peringkat #{gamification.personalRecord.rank} terendah dari {gamification.personalRecord.totalDays} hari
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Best/worst day reference */}
        {(patterns.bestDayThisMonth || patterns.worstDayThisMonth) && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {patterns.bestDayThisMonth && (
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-500">🏆</span>
                <span className="text-muted-foreground">Best:</span>
                <span className="font-medium">{formatDateShort(patterns.bestDayThisMonth.date)}</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-medium">{compactRupiah(patterns.bestDayThisMonth.amount)}</span>
              </div>
            )}
            {patterns.worstDayThisMonth && (
              <div className="flex items-center gap-1.5">
                <span className="text-red-500">📉</span>
                <span className="text-muted-foreground">Worst:</span>
                <span className="font-medium">{formatDateShort(patterns.worstDayThisMonth.date)}</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-medium">{compactRupiah(patterns.worstDayThisMonth.amount)}</span>
              </div>
            )}
          </div>
        )}

        {/* Cash flow health + savings rate */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/30 p-2.5">
            <div className="flex items-center gap-1 mb-0.5">
              <Activity className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Cash flow</span>
            </div>
            <p className={cn(
              'text-sm font-bold',
              patterns.cashFlowHealth.status === 'healthy' ? 'text-emerald-500'
              : patterns.cashFlowHealth.status === 'warning' ? 'text-amber-500'
              : 'text-red-500'
            )}>
              {patterns.cashFlowHealth.status === 'healthy' ? 'Sehat'
              : patterns.cashFlowHealth.status === 'warning' ? 'Hati-hati'
              : 'Boros'}
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 p-2.5">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Savings rate</span>
            </div>
            <p className={cn(
              'text-sm font-bold',
              patterns.savingsRate >= 50 ? 'text-emerald-500'
              : patterns.savingsRate >= 0 ? 'text-amber-500'
              : 'text-red-500'
            )}>
              {patterns.savingsRate}%
            </p>
          </div>
        </div>

        {/* Category anomaly (if any anomaly detected) */}
        {patterns.categoryAnomaly.filter((c) => c.isAnomaly).length > 0 && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-2.5">
            <div className="flex items-center gap-1 mb-1">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase tracking-wide font-medium">Anomali terdeteksi</span>
            </div>
            {patterns.categoryAnomaly.filter((c) => c.isAnomaly).map((c) => (
              <p key={c.category} className="text-xs text-amber-700 dark:text-amber-400">
                {c.category} {formatRupiah(c.amount)} — {c.zScore}σ di atas normal ({compactRupiah(c.avgAmount)})
              </p>
            ))}
          </div>
        )}

        {/* Today's transactions list (compact) */}
        {today.transactions.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Transaksi hari ini</span>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
              {today.transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-2 py-1 text-xs">
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 w-10">
                    {formatHour(tx.hour)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {tx.description || tx.category}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {tx.category} · {tx.source}
                    </p>
                  </div>
                  <span className={cn(
                    'font-semibold tabular-nums shrink-0',
                    tx.type === 'income' ? 'text-emerald-500' : 'text-red-500'
                  )}>
                    {tx.type === 'income' ? '+' : '−'}{compactRupiah(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
