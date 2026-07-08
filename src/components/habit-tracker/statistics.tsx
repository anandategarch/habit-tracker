'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Cell,
} from 'recharts';
import {
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Calendar,
  Flame,
  Award,
  Target,
  AlertTriangle,
} from 'lucide-react';

interface StatisticsData {
  totalCompletion: number;
  totalEntries: number;
  missCount: number;
  successRate: number;
  averageScore: number;
  bestDay: { date: string; rate: number };
  worstDay: { date: string; rate: number };
  bestWeek: { week: string; rate: number };
  bestMonth: { month: string; rate: number };
  longestSuccess: number;
  longestFailure: number;
  totalDaysTracked: number;
}

function ProgressRing({ value, size = 64, strokeWidth = 5 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;
  const color = value >= 80 ? 'text-green-500' : value >= 50 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
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
          className={cn(color, 'transition-all duration-700 ease-out')}
        />
      </svg>
      <span className="absolute text-xs font-bold text-foreground">{Math.round(value)}%</span>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color,
  children,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="group hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={cn('text-2xl font-bold mt-1', color || 'text-foreground')}>{value}</p>
            {subValue && <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>}
          </div>
          {children || (
            <div className={cn('p-2 rounded-lg shrink-0', color === 'text-green-600' ? 'bg-green-100 dark:bg-green-950/50' : color === 'text-amber-600' ? 'bg-amber-100 dark:bg-amber-950/50' : color === 'text-red-500' ? 'bg-red-100 dark:bg-red-950/50' : 'bg-muted')}>
              <Icon className={cn('h-4 w-4', color === 'text-green-600' ? 'text-green-600' : color === 'text-amber-600' ? 'text-amber-600' : color === 'text-red-500' ? 'text-red-500' : 'text-muted-foreground')} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function HighlightCard({
  icon: Icon,
  label,
  date,
  rate,
  color,
  trend,
}: {
  icon: React.ElementType;
  label: string;
  date: string;
  rate: number;
  color: string;
  trend: 'up' | 'down';
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : TrendingDown;

  return (
    <Card className="group hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon className={cn('h-4 w-4', color)} />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-sm font-semibold text-foreground">{date}</p>
        <div className="flex items-center gap-2 mt-2">
          <TrendIcon className={cn('h-3.5 w-3.5', color)} />
          <span className={cn('text-lg font-bold', color)}>{rate.toFixed(1)}%</span>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Highlights skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-3 w-16 mb-3" />
              <Skeleton className="h-4 w-28 mb-2" />
              <Skeleton className="h-6 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Chart skeleton */}
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function Statistics() {
  const { refreshKey } = useAppStore();
  const [data, setData] = useState<StatisticsData | null>(null);
  const loading = data === null;

  useEffect(() => {
    let cancelled = false;
    fetch('/api/statistics')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d && typeof d.totalCompletion === 'number') {
          setData(d);
        } else if (!cancelled) {
          setData({ totalCompletion: 0, totalEntries: 0, missCount: 0, successRate: 0, averageScore: 0, bestDay: { date: 'N/A', rate: 0 }, worstDay: { date: 'N/A', rate: 0 }, bestWeek: { week: 'N/A', rate: 0 }, bestMonth: { month: 'N/A', rate: 0 }, longestSuccess: 0, longestFailure: 0, totalDaysTracked: 0 });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData({ totalCompletion: 0, totalEntries: 0, missCount: 0, successRate: 0, averageScore: 0, bestDay: { date: 'N/A', rate: 0 }, worstDay: { date: 'N/A', rate: 0 }, bestWeek: { week: 'N/A', rate: 0 }, bestMonth: { month: 'N/A', rate: 0 }, longestSuccess: 0, longestFailure: 0, totalDaysTracked: 0 });
        }
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'Completed', value: data.totalCompletion, color: '#22c55e' },
      { name: 'Missed', value: data.missCount, color: '#f59e0b' },
    ];
  }, [data]);

  const total = useMemo(() => {
    if (!data) return 0;
    return data.totalCompletion + data.missCount;
  }, [data]);

  if (loading) return <LoadingSkeleton />;

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Target className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-lg font-medium text-muted-foreground">No statistics yet</p>
        <p className="text-sm text-muted-foreground/70 mt-1">Start tracking habits to see your stats</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Statistics</h2>
        <p className="text-sm text-muted-foreground mt-1">Your habit tracking performance at a glance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard
          icon={CheckCircle}
          label="Total Completions"
          value={data.totalCompletion}
          subValue={`of ${data.totalEntries} entries`}
          color="text-green-600"
        />

        <StatCard
          icon={XCircle}
          label="Miss Count"
          value={data.missCount}
          subValue={total > 0 ? `${((data.missCount / total) * 100).toFixed(1)}% of total` : undefined}
          color="text-amber-600"
        />

        {/* Success Rate with progress ring */}
        <Card className="group hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Success Rate</p>
                <p className="text-lg font-bold mt-1 text-green-600">{data.successRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">Overall completion</p>
              </div>
              <ProgressRing value={data.successRate} size={56} strokeWidth={4} />
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Average Score</p>
                <p className="text-lg font-bold mt-1 text-foreground">{data.averageScore.toFixed(1)}%</p>
                <div className="mt-2 h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700 ease-out',
                      data.averageScore >= 80
                        ? 'bg-green-500'
                        : data.averageScore >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                    )}
                    style={{ width: `${Math.min(data.averageScore, 100)}%` }}
                  />
                </div>
              </div>
              <div className="p-2 rounded-lg bg-muted shrink-0">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <StatCard
          icon={Calendar}
          label="Days Tracked"
          value={data.totalDaysTracked}
          subValue="Total active days"
        />

        <StatCard
          icon={Flame}
          label="Best Streak"
          value={`${data.longestSuccess}d`}
          subValue="Consecutive successes"
          color="text-green-600"
        />

        <StatCard
          icon={TrendingDown}
          label="Worst Streak"
          value={`${data.longestFailure}d`}
          subValue="Consecutive misses"
          color="text-red-500"
        />
      </div>

      {/* Highlights Section */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Highlights</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <HighlightCard
            icon={Award}
            label="Best Day"
            date={data.bestDay?.date && isValid(parseISO(data.bestDay.date)) ? format(parseISO(data.bestDay.date), 'MMM d, yyyy') : 'N/A'}
            rate={data.bestDay?.rate ?? 0}
            color="text-green-600"
            trend="up"
          />
          <HighlightCard
            icon={AlertTriangle}
            label="Worst Day"
            date={data.worstDay?.date && isValid(parseISO(data.worstDay.date)) ? format(parseISO(data.worstDay.date), 'MMM d, yyyy') : 'N/A'}
            rate={data.worstDay?.rate ?? 0}
            color="text-red-500"
            trend="down"
          />
          <HighlightCard
            icon={TrendingUp}
            label="Best Week"
            date={data.bestWeek?.week ?? 'N/A'}
            rate={data.bestWeek?.rate ?? 0}
            color="text-green-600"
            trend="up"
          />
          <HighlightCard
            icon={Award}
            label="Best Month"
            date={data.bestMonth?.month ?? 'N/A'}
            rate={data.bestMonth?.rate ?? 0}
            color="text-green-600"
            trend="up"
          />
        </div>
      </div>

      {/* Visual Comparison Chart */}
      {total > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Completion vs Misses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={80}
                    tick={{ fontSize: 13, fill: 'hsl(var(--foreground))', fontWeight: 500 }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: 'hsl(var(--foreground))',
                    }}
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                    formatter={(value: number) => [`${value} entries`, 'Count']}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={36}>
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

