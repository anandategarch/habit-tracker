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
  // ISO string of the transaction date. The client formats this to Jakarta
  // wall-clock time via `toLocaleTimeString('id-ID', { timeZone:
  // 'Asia/Jakarta' })` — same code path as the Transactions tab, so the time
  // shown here always matches the Transactions tab for the same transaction.
  date: string;
  source: string;
}

interface CategoryStats {
  name: string;
  todayAmount: number;
  todayCount: number;
  maxTransaction: number;
  avgTransaction: number;
  maxDaily: number;
  avgDaily: number;
  deltaVsAvgDaily: number;
  emoji: string;
  color: string;
}

interface DailyRecap {
  date: string;
  today: {
    income: number;
    expense: number;
    net: number;
    transactionCount: number;
    transactions: TodayTransaction[];
    categories: Array<{ name: string; amount: number; count: number; emoji: string; color: string }>;
    categoryStats: CategoryStats[];
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

/**
 * Format a transaction's ISO date string to a Jakarta wall-clock time.
 * Uses `toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })` — the
 * SAME code path as the Transactions tab (`finance-transactions.tsx:65-68`).
 * This guarantees the time shown in the daily recap always matches the time
 * shown in the Transactions tab for the same transaction.
 *
 * Returns "HH.MM" (Indonesian format uses dot separator) or empty string.
 */
function formatTxTime(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/** Format an integer hour (0-23) as "HH:00" for the peak-hour label. */
function formatHourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

/** Format a YYYY-MM-DD date as "DD-Www" (e.g. "31-Mon", "30-Sun") for chart axis labels. */
function formatDayMonthLabel(d: string): string {
  const [y, m, day] = d.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(day));
  const dayNum = date.getDate();
  // 3-letter weekday, first letter uppercase, locale-independent (en-US)
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  return `${dayNum}-${weekday}`;
}

function formatDateShort(d: string): string {
  // d = "2026-07-31" → "31 Jul"
  const [y, m, day] = d.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(day));
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/** Compact rupiah that handles 0 gracefully (returns "0" not "0k"). */
function compactRupiahSafe(n: number): string {
  if (n === 0) return '0';
  return compactRupiah(n);
}

// ── Smooth curve helper (Catmull-Rom → cubic Bezier) ────────────────────
// Converts an array of points into a smooth SVG path using the Catmull-Rom
// spline algorithm. Each segment between two points becomes a cubic Bezier
// curve whose control points are derived from the neighboring points,
// producing a continuous, natural-looking line with no sharp angles.

function catmullRomPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i++) {
    // p0 = previous point (or clamp to p1 at the start)
    // p1 = current point (segment start)
    // p2 = next point (segment end)
    // p3 = point after next (or clamp to p2 at the end)
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    // Catmull-Rom → Bezier control points (tension factor 1/6)
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return path;
}

// ── Sparkline (premium fintech line chart) ────────────────────────────────
// Smooth curved line with vibrant blue→purple gradient stroke (#5B5FFB →
// #7C6CFF) and a very soft translucent area fill (12% opacity) with subtle
// Gaussian blur beneath. Minimalist — only the "today" point is highlighted
// with a soft glow halo + background ring.

function MiniSparkline({ data }: { data: Array<{ date: string; amount: number; isToday: boolean }> }) {
  if (data.length === 0) return null;
  const values = data.map((d) => d.amount);
  const max = Math.max(...values, 1);
  const hasAnyData = values.some((v) => v > 0);

  // Wide viewBox (300×48) keeps horizontal stretch low on most screens.
  const W = 300, H = 48;
  const step = W / (data.length - 1 || 1);
  const points = data.map((d, i) => {
    const x = i * step;
    // If no data at all, draw flat line at bottom (not top).
    const y = hasAnyData ? H - (d.amount / max) * (H - 12) - 6 : H - 6;
    return { x, y, ...d };
  });

  const linePath = catmullRomPath(points);
  const areaPath = `${linePath} L ${W} ${H} L 0 ${H} Z`;

  // Find the today point (for the glowing highlight)
  const todayPoint = points.find((p) => p.isToday);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12" preserveAspectRatio="none">
        <defs>
          {/* Horizontal gradient for stroke: vibrant blue → purple */}
          <linearGradient id="spark-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#5B5FFB" />
            <stop offset="100%" stopColor="#7C6CFF" />
          </linearGradient>
          {/* Vertical gradient for area fill: 15% opacity → 0% (top → bottom) */}
          <linearGradient id="spark-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5B5FFB" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#7C6CFF" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#7C6CFF" stopOpacity="0" />
          </linearGradient>
          {/* Subtle blur filter for the area fill (soft, dreamy feel) */}
          <filter id="spark-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
          {/* Glow filter for the today point */}
          <filter id="spark-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Soft blurred area fill beneath the line */}
        {hasAnyData && (
          <path
            d={areaPath}
            fill="url(#spark-area)"
            filter="url(#spark-blur)"
          />
        )}

        {/* Smooth curved line with blue→purple gradient */}
        <path
          d={linePath}
          fill="none"
          stroke="url(#spark-stroke)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Today point: glow halo + bg ring + solid dot */}
        {hasAnyData && todayPoint && (
          <g>
            {/* Outer glow (blurred, semi-transparent) */}
            <circle
              cx={todayPoint.x}
              cy={todayPoint.y}
              r="5"
              fill="#7C6CFF"
              opacity="0.3"
              filter="url(#spark-glow)"
            />
            {/* Background ring (matches card bg — creates cutout from the line) */}
            <circle
              cx={todayPoint.x}
              cy={todayPoint.y}
              r="3.5"
              className="text-background"
              fill="currentColor"
            />
            {/* Inner solid dot */}
            <circle
              cx={todayPoint.x}
              cy={todayPoint.y}
              r="2.5"
              fill="#7C6CFF"
            />
          </g>
        )}
      </svg>

      {/* Date labels below the chart — one per data point, evenly spaced.
          Uses a flex row with each cell taking 1/N width so labels align
          exactly under each chart point. Center-aligned text. Today's label
          is highlighted (bold + colored) to match the highlighted dot above. */}
      <div className="flex mt-1">
        {data.map((d, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 text-center text-[9px] tabular-nums leading-tight',
              d.isToday
                ? 'font-bold text-[#7C6CFF]'
                : 'text-muted-foreground'
            )}
          >
            {formatDayMonthLabel(d.date)}
          </div>
        ))}
      </div>
    </div>
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
  const clampedPct = Math.min(Math.max(percentage, 0), 100);
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

// ── Hourly Heatmap (24-bar mini viz, premium) ────────────────────────────
// Shows total spending for the day as a label above the bars, then the 24-bar
// heatmap below, then the hour axis labels at the bottom.

function HourlyHeatmap({ hourly }: { hourly: number[] }) {
  const max = Math.max(...hourly, 1);
  const hasData = hourly.some((h) => h > 0);
  const total = hourly.reduce((s, a) => s + a, 0);

  if (!hasData) {
    return (
      <div className="h-8 flex items-center justify-center text-[10px] text-muted-foreground italic">
        Belum ada aktivitas
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Total spending label on top of the bars */}
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</span>
        <span className="text-xs font-bold tabular-nums text-foreground">{compactRupiahSafe(total)}</span>
      </div>
      <div className="flex items-end gap-[3px] h-10">
        {hourly.map((amt, h) => {
          const hRatio = amt / max;
          const isLateNight = h >= 22 || h < 5;
          const isMorning = h >= 5 && h < 12;
          const isAfternoon = h >= 12 && h < 18;
          const color = amt === 0 ? 'bg-muted/30'
            : isLateNight ? 'bg-purple-400 dark:bg-purple-500'
            : isMorning ? 'bg-amber-400 dark:bg-amber-500'
            : isAfternoon ? 'bg-primary'
            : 'bg-blue-400 dark:bg-blue-500';
          return (
            <Tooltip key={h}>
              <TooltipTrigger asChild>
                <div
                  className={cn('flex-1 min-w-[4px] rounded-sm transition-all hover:opacity-80 cursor-default', color)}
                  style={{ height: amt === 0 ? '3px' : `${Math.max(10, hRatio * 100)}%` }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-medium">{formatHourLabel(h)}</p>
                <p className="text-muted-foreground">{amt > 0 ? formatRupiah(amt) : '—'}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground px-0.5">
        {HOUR_LABELS.map((h) => <span key={h}>{h}</span>)}
      </div>
    </div>
  );
}

// ── Category Insight Row (per-category deep stats) ───────────────────────
// For each category that has transactions today, shows:
//   Row 1: emoji + name + today's total + delta badge (vs avg daily)
//   Row 2: muted mini-stats — Max tx, Avg tx, Max/day, Avg/day
//
// Delta badge:
//   - Negative (today < avg) → green "↓ Xk below avg" (good for expense)
//   - Positive (today > avg) → red "↑ Xk above avg" (overspending)
//   - Zero → muted "at avg"

function CategoryInsightRow({ stats, pct }: { stats: CategoryStats; pct: number }) {
  const delta = stats.deltaVsAvgDaily;
  const isBelow = delta < 0;
  const isAbove = delta > 0;
  const isAtAvg = delta === 0;

  const deltaColorClass = isAtAvg ? 'text-muted-foreground'
    : isBelow ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';
  const DeltaIcon = isAtAvg ? Minus : isBelow ? TrendingDown : TrendingUp;

  return (
    <div className="py-1.5 border-b border-border/40 last:border-b-0">
      {/* Row 1: emoji + name + count + pct + today amount + delta badge */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="text-sm shrink-0">{stats.emoji}</span>
          <span className="text-xs font-medium truncate">{stats.name}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">· {stats.todayCount}x</span>
          <span className="text-[10px] text-muted-foreground/70 shrink-0 tabular-nums">({pct}%)</span>
        </div>
        <span className="text-xs font-bold tabular-nums shrink-0">
          {compactRupiahSafe(stats.todayAmount)}
        </span>
        <div className={cn('flex items-center gap-0.5 shrink-0 min-w-[60px] justify-end', deltaColorClass)}>
          <DeltaIcon className="h-3 w-3 shrink-0" />
          <span className="text-[10px] font-medium tabular-nums">
            {isAtAvg ? 'at avg' : `${compactRupiahSafe(Math.abs(delta))}`}
          </span>
        </div>
      </div>

      {/* Row 2: mini-stats line — Max tx, Avg tx, Max/day, Avg/day */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 pl-5 text-[10px] text-muted-foreground">
        <span className="shrink-0">
          Max tx <span className="font-medium text-foreground/80 tabular-nums">{compactRupiahSafe(stats.maxTransaction)}</span>
        </span>
        <span className="shrink-0 text-muted-foreground/50">·</span>
        <span className="shrink-0">
          Avg tx <span className="font-medium text-foreground/80 tabular-nums">{compactRupiahSafe(stats.avgTransaction)}</span>
        </span>
        <span className="shrink-0 text-muted-foreground/50">·</span>
        <span className="shrink-0">
          Max/day <span className="font-medium text-foreground/80 tabular-nums">{compactRupiahSafe(stats.maxDaily)}</span>
        </span>
        <span className="shrink-0 text-muted-foreground/50">·</span>
        <span className="shrink-0">
          Avg/day <span className="font-medium text-foreground/80 tabular-nums">{compactRupiahSafe(stats.avgDaily)}</span>
        </span>
      </div>
    </div>
  );
}

// ── Comparison Pill ──────────────────────────────────────────────────────

function ComparisonPill({ changePct, direction, label }: { changePct: number | null; direction: string; label: string }) {
  if (changePct === null || direction === 'unknown') {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}: —</span>
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
    <div className={cn('flex items-center gap-1 text-xs font-medium min-w-0', colorClass)}>
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{label} {Math.abs(changePct)}%</span>
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
    <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border max-w-full', severityClass)}>
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate min-w-0">{alert.message}</span>
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
    <div className="flex items-center gap-1.5 min-w-0">
      <div className={cn('flex items-center justify-center w-6 h-6 rounded-md shrink-0', iconClass ?? 'bg-muted/50 text-muted-foreground')}>
        <Icon className="h-3 w-3" />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide truncate">{label}</p>
        <p className={cn('text-xs sm:text-sm font-semibold truncate', valueClass)}>{value}</p>
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
        <div className="bg-gradient-to-br from-[#5B5FFB]/[0.025] via-[#7C6CFF]/[0.015] to-transparent px-4 py-6 sm:px-6 text-center">
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
      <div className="relative bg-gradient-to-br from-[#5B5FFB]/[0.025] via-[#7C6CFF]/[0.015] to-transparent px-4 py-4 sm:px-6 sm:py-5">
        {/* Top row: label + date + budget ring */}
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <p className="text-xs text-muted-foreground font-medium">Hari Ini</p>
              {gamification.dailyBadge && (
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 gap-0.5">
                  <span>{gamification.dailyBadge.emoji}</span>
                  <span className="font-medium">{gamification.dailyBadge.name}</span>
                </Badge>
              )}
            </div>
            <p className={cn(
              'text-xl sm:text-3xl font-bold tracking-tight break-words',
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
              <ProgressRing percentage={dailyBudget.percentage} status={dailyBudget.status} size={48}>
                <div className="text-center">
                  <p className="text-[9px] font-bold leading-none">{dailyBudget.percentage}%</p>
                </div>
              </ProgressRing>
              <p className="text-[9px] text-muted-foreground text-center leading-tight">
                dari {compactRupiahSafe(dailyBudget.target)}
              </p>
            </div>
          )}
        </div>

        {/* Comparison pills row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
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
              'flex items-center gap-1 text-xs font-medium min-w-0',
              predictions.trendDirection.direction === 'up' ? 'text-red-500' : 'text-emerald-500'
            )}>
              {predictions.trendDirection.direction === 'up' ? <TrendingUp className="h-3 w-3 shrink-0" /> : <TrendingDown className="h-3 w-3 shrink-0" />}
              <span className="truncate">Tren {predictions.trendDirection.direction === 'up' ? 'naik' : 'turun'}</span>
            </div>
          )}
        </div>

        {/* Sparkline — premium line chart with blue→purple gradient.
            Date labels (DD-Www) are rendered inside the component, one per
            data point, so we don't duplicate them here. */}
        <div className="mt-4">
          <MiniSparkline data={sparkline.daily7d} />
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
        <div className="px-2 py-2.5 sm:px-3">
          <StatTile
            label="Masuk"
            value={<CountUpRupiah amount={today.income} />}
            icon={ArrowUpRight}
            iconClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
            valueClass="text-emerald-600 dark:text-emerald-400"
          />
        </div>
        <div className="px-2 py-2.5 sm:px-3">
          <StatTile
            label="Keluar"
            value={<CountUpRupiah amount={today.expense} />}
            icon={ArrowDownRight}
            iconClass="bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400"
            valueClass="text-red-600 dark:text-red-400"
          />
        </div>
        <div className="px-2 py-2.5 sm:px-3">
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
                Besok max {compactRupiahSafe(predictions.smartCapTomorrow)}
              </p>
            )}
          </div>
        </div>

        {/* Top transaction (largest single expense today) — kept per user request.
            The "Spending tertinggi" (peak hour) row was removed because the
            hourly heatmap below already visualizes peak activity.
            Emoji is looked up from categoryStats (which carries the DB emoji). */}
        {today.topTransaction && (() => {
          const topCat = today.topTransaction.category;
          const meta = today.categoryStats.find((c) => c.name === topCat)
            ?? today.categories.find((c) => c.name === topCat);
          return (
            <div className="flex items-center gap-1.5 text-xs min-w-0">
              <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-muted-foreground shrink-0">Terbesar:</span>
              {meta && <span className="text-sm shrink-0">{meta.emoji}</span>}
              <span className="font-medium truncate">{topCat}</span>
              <span className="text-muted-foreground shrink-0">·</span>
              <span className="font-medium shrink-0">{compactRupiahSafe(today.topTransaction.amount)}</span>
            </div>
          );
        })()}

        {/* Per-category deep insights — only categories with transactions today.
            Shows today's amount + delta vs avg daily, plus max/avg per-tx and
            per-day stats from the last 30 days. Placed above the hourly heatmap
            because it's more actionable (category-level pattern vs time-of-day). */}
        {today.categoryStats.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Brain className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Insight per kategori</span>
            </div>
            <div className="rounded-lg bg-muted/20 px-2.5 py-0.5">
              {today.categoryStats.map((cat) => {
                const pct = today.expense > 0 ? Math.round((cat.todayAmount / today.expense) * 100) : 0;
                return (
                  <CategoryInsightRow key={cat.name} stats={cat} pct={pct} />
                );
              })}
            </div>
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
        </div>

        {/* Category pills section removed — redundant with "Insight per
            kategori" above, which shows the same name + today amount plus
            max/avg stats and delta. The pct (proportion of total expense)
            is now shown inline in each CategoryInsightRow to preserve that
            info without duplicating the category list. */}

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {patterns.bestDayThisMonth && (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-emerald-500 shrink-0">🏆</span>
                <span className="text-muted-foreground shrink-0">Best:</span>
                <span className="font-medium shrink-0">{formatDateShort(patterns.bestDayThisMonth.date)}</span>
                <span className="text-muted-foreground shrink-0">·</span>
                <span className="font-medium truncate">{compactRupiahSafe(patterns.bestDayThisMonth.amount)}</span>
              </div>
            )}
            {patterns.worstDayThisMonth && (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-red-500 shrink-0">📉</span>
                <span className="text-muted-foreground shrink-0">Worst:</span>
                <span className="font-medium shrink-0">{formatDateShort(patterns.worstDayThisMonth.date)}</span>
                <span className="text-muted-foreground shrink-0">·</span>
                <span className="font-medium truncate">{compactRupiahSafe(patterns.worstDayThisMonth.amount)}</span>
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
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Transaksi hari ini</span>
              </div>
              {today.transactionCount > today.transactions.length && (
                <span className="text-[10px] text-muted-foreground">+{today.transactionCount - today.transactions.length} lainnya</span>
              )}
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
              {today.transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-2 py-1 text-xs">
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 w-12">
                    {formatTxTime(tx.date)}
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
                    {tx.type === 'income' ? '+' : '−'}{compactRupiahSafe(tx.amount)}
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
