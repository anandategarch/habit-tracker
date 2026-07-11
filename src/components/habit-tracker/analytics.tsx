'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Activity, Brain } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// ── Types ──────────────────────────────────────────────────────────────────
interface CompletionPoint {
  date: string;
  label: string;
  completed: number;
  total: number;
  rate: number;
}

interface MovingAvgPoint extends CompletionPoint {
  movingAvg: number;
}

interface WeeklyPoint {
  week: string;
  completed: number;
  total: number;
  rate: number;
}

interface MonthlyPoint {
  month: string;
  completed: number;
  total: number;
  rate: number;
}

interface CategoryPoint {
  category: string;
  done: number;
  total: number;
  rate: number;
}

interface HabitDistPoint {
  name: string;
  icon: string;
  completed: number;
  total: number;
  rate: number;
  color: string;
}

interface MoodPoint {
  date: string;
  mood: number;
  energy: number;
  sleep: number;
  completionRate: number;
}

interface DayOfWeekPoint {
  day: string;
  done: number;
  total: number;
  rate: number;
}

interface AnalyticsData {
  completionTrend: CompletionPoint[];
  movingAverage: MovingAvgPoint[];
  weeklyTrend: WeeklyPoint[];
  monthlyTrend: MonthlyPoint[];
  categoryPerformance: CategoryPoint[];
  habitDistribution: HabitDistPoint[];
  moodData: MoodPoint[];
  dayOfWeekPerformance: DayOfWeekPoint[];
  forecast: number;
  daysElapsed: number;
  daysInMonth: number;
}

// ── Color palette (green-centric) ──────────────────────────────────────────
const COLORS = [
  '#22c55e',
  '#16a34a',
  '#15803d',
  '#86efac',
  '#4ade80',
  '#a7f3d0',
  '#f97316',
  '#eab308',
  '#ef4444',
  '#06b6d4',
];

const GREEN_500 = '#22c55e';
const GREEN_400 = '#4ade80';
const GREEN_600 = '#16a34a';
const GREEN_100 = '#dcfce7';
const GREEN_50 = '#f0fdf4';

// ── Custom tooltip ─────────────────────────────────────────────────────────
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
      <p className="mb-1 font-medium text-muted-foreground">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}%
        </p>
      ))}
    </div>
  );
}

// ── Percent formatter for YAxis ────────────────────────────────────────────
function pctTick(v: number) {
  return `${v}%`;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function AnalyticsTab() {
  const [period, setPeriod] = useState('30');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, startLoadingTransition] = useTransition();

  // Trigger fetch when period changes
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    startLoadingTransition(async () => {
      try {
        const r = await fetch(`/api/analytics?period=${period}`, {
          signal: controller.signal,
        });
        const json = r.ok ? await r.json() : null;
        if (!cancelled && json) setData(json);
      } catch {
        // aborted or network error
      }
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [period]);

  // ── Derived ────────────────────────────────────────────────────────────
  const latestRate =
    data?.completionTrend?.length
      ? data.completionTrend[data.completionTrend.length - 1].rate
      : 0;
  const prevRate =
    data?.completionTrend?.length > 1
      ? data.completionTrend[data.completionTrend.length - 2].rate
      : 0;
  const trendUp = latestRate >= prevRate;
  const trendDiff = Math.abs(latestRate - prevRate).toFixed(1);

  // Merge completionTrend with movingAverage for dual-line chart
  const mergedTrend = data
    ? data.completionTrend.map((c, i) => ({
        ...c,
        movingAvg: data.movingAverage[i]?.movingAvg ?? 0,
      }))
    : [];

  // Mood scatter data
  const moodScatter = data?.moodData.map((d) => ({
    x: d.mood,
    y: d.completionRate,
    energy: d.energy,
    sleep: d.sleep,
  }));

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Analytics
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track your habit completion trends, performance, and correlations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Period:</span>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="60">60 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
          <Badge
            variant="outline"
            className={`gap-1 border ${
              trendUp
                ? 'border-primary text-primary bg-primary/10'
                : 'border-red-400 text-red-700 bg-red-50'
            }`}
          >
            {trendUp ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {trendDiff}%
          </Badge>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[320px] w-full rounded-xl" />
          ))}
        </div>
      ) : !data ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No analytics data available yet. Start tracking habits to see trends.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Row 1: Completion Trend + Forecast ─────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Completion Trend */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">
                  Completion Trend &amp; Moving Average
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={mergedTrend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickFormatter={pctTick}
                        tick={{ fontSize: 11 }}
                      />
                      <RechartsTooltip
                        content={<ChartTooltip />}
                        labelKey="label"
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="rate"
                        name="Completion Rate"
                        stroke={GREEN_500}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="movingAvg"
                        name="Moving Average"
                        stroke="#eab308"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Forecast Card */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Monthly Forecast
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center items-center gap-4">
                <div className="relative flex items-center justify-center">
                  {/* ring progress */}
                  <svg width="140" height="140" viewBox="0 0 140 140">
                    <circle
                      cx="70"
                      cy="70"
                      r="58"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="12"
                    />
                    <circle
                      cx="70"
                      cy="70"
                      r="58"
                      fill="none"
                      stroke={GREEN_500}
                      strokeWidth="12"
                      strokeDasharray={`${(data.forecast / 100) * 364.4} 364.4`}
                      strokeLinecap="round"
                      transform="rotate(-90 70 70)"
                    />
                  </svg>
                  <span className="absolute text-3xl font-bold text-primary">
                    {data.forecast.toFixed(0)}%
                  </span>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Predicted end-of-month rate
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Day {data.daysElapsed} of {data.daysInMonth}
                  </p>
                  <div className="w-full bg-muted rounded-full h-2 mt-2">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{
                        width: `${(data.daysElapsed / data.daysInMonth) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 w-full mt-2">
                  <div className="text-center p-3 rounded-lg bg-primary/10">
                    <p className="text-2xl font-bold text-primary">
                      {latestRate.toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Current</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-yellow-50">
                    <p className="text-2xl font-bold text-yellow-700">
                      {data.forecast.toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Forecast</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Row 2: Weekly Trend + Monthly Trend ─────────────────────── */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Weekly Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Weekly Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.weeklyTrend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                      <YAxis
                        domain={[0, 100]}
                        tickFormatter={pctTick}
                        tick={{ fontSize: 11 }}
                      />
                      <RechartsTooltip
                        content={<ChartTooltip />}
                        labelKey="week"
                      />
                      <Bar
                        dataKey="rate"
                        name="Completion Rate"
                        fill={GREEN_500}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monthly Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis
                        domain={[0, 100]}
                        tickFormatter={pctTick}
                        tick={{ fontSize: 11 }}
                      />
                      <RechartsTooltip
                        content={<ChartTooltip />}
                        labelKey="month"
                      />
                      <Bar
                        dataKey="rate"
                        name="Completion Rate"
                        fill={GREEN_600}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Row 3: Category Radar + Habit Distribution Pie ──────────── */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Category Performance Radar */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Category Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      cx="50%"
                      cy="50%"
                      outerRadius="70%"
                      data={data.categoryPerformance}
                    >
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis
                        dataKey="category"
                        tick={{ fontSize: 11 }}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={{ fontSize: 10 }}
                        tickFormatter={pctTick}
                      />
                      <Radar
                        name="Completion Rate"
                        dataKey="rate"
                        stroke={GREEN_500}
                        fill={GREEN_500}
                        fillOpacity={0.3}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Habit Distribution Pie */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Habit Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[320px] flex items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.habitDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={2}
                        dataKey="completed"
                        nameKey="name"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {data.habitDistribution.map((entry, idx) => (
                          <Cell
                            key={`cell-${idx}`}
                            fill={entry.color || COLORS[idx % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload as HabitDistPoint;
                          return (
                            <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
                              <p className="font-medium">
                                {d.icon} {d.name}
                              </p>
                              <p className="text-muted-foreground">
                                {d.completed}/{d.total} completed ({d.rate.toFixed(0)}%)
                              </p>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Row 4: Day of Week + Mood Correlation ──────────────────── */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Day of Week Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Day of Week Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.dayOfWeekPerformance}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis
                        domain={[0, 100]}
                        tickFormatter={pctTick}
                        tick={{ fontSize: 11 }}
                      />
                      <RechartsTooltip
                        content={<ChartTooltip />}
                        labelKey="day"
                      />
                      <Bar
                        dataKey="rate"
                        name="Completion Rate"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={36}
                      >
                        {data.dayOfWeekPerformance.map((_, idx) => (
                          <Cell
                            key={`dow-${idx}`}
                            fill={
                              idx === 5 || idx === 6
                                ? '#86efac'
                                : GREEN_500
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Mood vs Completion Correlation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  Mood vs Completion
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis
                        type="number"
                        dataKey="x"
                        name="Mood"
                        domain={[0, 5]}
                        ticks={[1, 2, 3, 4, 5]}
                        tickFormatter={(v: number) =>
                          ['', '😰', '😟', '😐', '🙂', '😊'][v] || ''
                        }
                        tick={{ fontSize: 14 }}
                        label={{
                          value: 'Mood',
                          position: 'insideBottomRight',
                          offset: -5,
                          fontSize: 12,
                        }}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        name="Completion"
                        domain={[0, 100]}
                        tickFormatter={pctTick}
                        tick={{ fontSize: 11 }}
                        label={{
                          value: 'Completion %',
                          angle: -90,
                          position: 'insideLeft',
                          offset: 10,
                          fontSize: 12,
                        }}
                      />
                      <ZAxis
                        type="number"
                        dataKey="energy"
                        range={[40, 200]}
                        name="Energy"
                      />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload as {
                            x: number;
                            y: number;
                            energy: number;
                            sleep: number;
                          };
                          return (
                            <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm space-y-1">
                              <p className="font-medium">
                                Mood: {['', '😰', '😟', '😐', '🙂', '😊'][d.x]} ({d.x}/5)
                              </p>
                              <p className="text-primary font-semibold">
                                Completion: {d.y.toFixed(0)}%
                              </p>
                              <p className="text-muted-foreground">
                                Energy: {d.energy}/5 &middot; Sleep: {d.sleep}h
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Scatter
                        data={moodScatter}
                        fill={GREEN_500}
                        fillOpacity={0.7}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}