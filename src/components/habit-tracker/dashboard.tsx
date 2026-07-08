'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Cell,
  PieChart,
  Pie,
  RadialBarChart,
  RadialBar,
  AreaChart,
  Area,
} from 'recharts';
import {
  Target,
  CheckCircle,
  Flame,
  Trophy,
  Zap,
  CalendarDays,
  TrendingUp,
  Star,
  Award,
  Smile,
  Moon,
  Brain,
  Swords,
  Flag,
  ArrowUpRight,
  ArrowDownRight,
  Crown,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

interface DashboardData {
  totalHabits: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  successToday: number;
  weeklyCompletion: number;
  monthlyCompletion: number;
  bestHabit: { name: string; icon: string; rate: number };
  worstHabit: { name: string; icon: string; rate: number };
  totalXP: number;
  currentLevel: number;
  nextLevelXP: number;
  currentLevelXP: number;
  levelProgress: number;
  unlockedBadges: number;
  totalBadges: number;
  challengeProgress: number;
  goalProgress: number;
  moodAverage: string;
  sleepAverage: string;
  productivityScore: number;
  weeklyChartData: { day: string; date: string; completed: number; total: number; rate: number }[];
  monthlyChartData: { day: string; completed: number; total: number; rate: number }[];
  categoryPerformance: { category: string; done: number; total: number; rate: number }[];
  todayFocus: { id: string; name: string; icon: string; priority: string }[];
}

function ProgressRing({
  value,
  size = 100,
  strokeWidth = 8,
  color = 'stroke-primary',
  label,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-lg font-bold">{value}%</span>
      </div>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

function MoodEmoji({ mood }: { mood: string }) {
  const map: Record<string, string> = {
    great: '😊',
    good: '🙂',
    okay: '😐',
    bad: '😔',
    terrible: '😢',
  };
  const emoji = map[mood.toLowerCase()] || '😐';
  const colorMap: Record<string, string> = {
    great: 'text-green-500',
    good: 'text-green-400',
    okay: 'text-yellow-500',
    bad: 'text-orange-500',
    terrible: 'text-red-500',
  };
  return (
    <span className={cn('text-2xl', colorMap[mood.toLowerCase()] || 'text-muted-foreground')}>
      {emoji}
    </span>
  );
}

const CATEGORY_COLORS = [
  'hsl(142, 71%, 45%)',
  'hsl(160, 84%, 39%)',
  'hsl(174, 72%, 35%)',
  'hsl(84, 81%, 44%)',
  'hsl(142, 71%, 55%)',
  'hsl(160, 84%, 50%)',
  'hsl(174, 72%, 46%)',
  'hsl(84, 81%, 55%)',
];

function getMoodLabel(mood: string) {
  return mood.charAt(0).toUpperCase() + mood.slice(1);
}

export default function Dashboard() {
  const { refreshKey } = useAppStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const loading = data === null;

  useEffect(() => {
    let cancelled = false;
    fetch('/api/dashboard')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled && !json.error) setData(json);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const insights = useMemo(() => {
    if (!data) return [];
    const items: { icon: React.ReactNode; text: string; type: 'success' | 'info' | 'warning' }[] = [];

    if (data.currentStreak >= 7) {
      items.push({
        icon: <Flame className="h-4 w-4 text-orange-500" />,
        text: `You're on a ${data.currentStreak} day streak! Keep it going!`,
        type: 'success',
      });
    } else if (data.currentStreak >= 3) {
      items.push({
        icon: <Flame className="h-4 w-4 text-orange-400" />,
        text: `${data.currentStreak} day streak - building momentum!`,
        type: 'info',
      });
    }

    if (data.weeklyChartData.length > 0) {
      const bestDay = data.weeklyChartData.reduce((best, d) => (d.rate > best.rate ? d : best), data.weeklyChartData[0]);
      items.push({
        icon: <Trophy className="h-4 w-4 text-yellow-500" />,
        text: `Your best day this week was ${bestDay.day} (${bestDay.rate}%).`,
        type: 'info',
      });
    }

    if (data.completionRate >= 80) {
      items.push({
        icon: <Star className="h-4 w-4 text-primary" />,
        text: 'Outstanding! Your completion rate is above 80%.',
        type: 'success',
      });
    } else if (data.completionRate < 50 && data.totalHabits > 0) {
      items.push({
        icon: <AlertTriangle className="h-4 w-4 text-orange-500" />,
        text: 'Your completion rate is below 50%. Try reducing habit count.',
        type: 'warning',
      });
    }

    if (data.productivityScore >= 80) {
      items.push({
        icon: <Brain className="h-4 w-4 text-primary" />,
        text: `High productivity score of ${data.productivityScore}%!`,
        type: 'success',
      });
    }

    return items.slice(0, 3);
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Unable to load dashboard data.</p>
      </div>
    );
  }

  const weeklyBarData = data.weeklyChartData.map((d) => ({
    ...d,
    label: d.day.slice(0, 3),
  }));

  const priorityVariant = (p: string) => {
    switch (p.toLowerCase()) {
      case 'high':
        return 'destructive' as const;
      case 'medium':
        return 'default' as const;
      default:
        return 'secondary' as const;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── KPI Cards Grid ──────────────────────────────────────── */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {/* Total Habits */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Total Habits</span>
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{data.totalHabits}</div>
            <p className="text-xs text-muted-foreground mt-1">Active habits</p>
          </Card>

          {/* Completion Rate */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Completion Rate</span>
              <CheckCircle className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{data.completionRate}%</div>
            <Progress value={data.completionRate} className="mt-2 h-1.5" />
          </Card>

          {/* Current Streak */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Current Streak</span>
              <Flame className="h-4 w-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold">{data.currentStreak}</div>
            <p className="text-xs text-muted-foreground mt-1">days</p>
          </Card>

          {/* Longest Streak */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Longest Streak</span>
              <Trophy className="h-4 w-4 text-yellow-500" />
            </div>
            <div className="text-2xl font-bold">{data.longestStreak}</div>
            <p className="text-xs text-muted-foreground mt-1">days</p>
          </Card>

          {/* Success Today */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Success Today</span>
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{data.successToday}%</div>
            <Progress value={data.successToday} className="mt-2 h-1.5" />
          </Card>

          {/* Weekly Completion */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Weekly</span>
              <CalendarDays className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold">{data.weeklyCompletion}%</div>
            <Progress value={data.weeklyCompletion} className="mt-2 h-1.5 [&>[data-slot=progress-indicator]]:bg-emerald-500" />
          </Card>

          {/* Monthly Completion */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Monthly</span>
              <TrendingUp className="h-4 w-4 text-teal-500" />
            </div>
            <div className="text-2xl font-bold">{data.monthlyCompletion}%</div>
            <Progress value={data.monthlyCompletion} className="mt-2 h-1.5 [&>[data-slot=progress-indicator]]:bg-teal-500" />
          </Card>

          {/* Total XP */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Total XP</span>
              <Star className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{data.totalXP.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Level {data.currentLevel}</p>
          </Card>

          {/* Current Level */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Level</span>
              <Award className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{data.currentLevel}</div>
            <div className="flex items-center gap-1 mt-1">
              <Progress value={data.levelProgress} className="h-1.5 flex-1" />
              <span className="text-[10px] text-muted-foreground">{data.levelProgress}%</span>
            </div>
          </Card>

          {/* Badges */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Badges</span>
              <Award className="h-4 w-4 text-yellow-500" />
            </div>
            <div className="text-2xl font-bold">
              {data.unlockedBadges}<span className="text-sm font-normal text-muted-foreground">/{data.totalBadges}</span>
            </div>
            <Progress value={(data.unlockedBadges / data.totalBadges) * 100} className="mt-2 h-1.5" />
          </Card>

          {/* Mood Average */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Mood</span>
              <Smile className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <MoodEmoji mood={data.moodAverage} />
              <span className="text-lg font-bold">{getMoodLabel(data.moodAverage)}</span>
            </div>
          </Card>

          {/* Sleep Average */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Sleep Avg</span>
              <Moon className="h-4 w-4 text-violet-400" />
            </div>
            <div className="text-2xl font-bold">{data.sleepAverage}</div>
            <p className="text-xs text-muted-foreground mt-1">hours / night</p>
          </Card>

          {/* Productivity Score */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Productivity</span>
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{data.productivityScore}%</div>
            <Progress value={data.productivityScore} className="mt-2 h-1.5" />
          </Card>

          {/* Challenge Progress */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Challenges</span>
              <Swords className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{data.challengeProgress}%</div>
            <Progress value={data.challengeProgress} className="mt-2 h-1.5" />
          </Card>

          {/* Goal Progress */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Goals</span>
              <Flag className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{data.goalProgress}%</div>
            <Progress value={data.goalProgress} className="mt-2 h-1.5" />
          </Card>
        </div>
      </section>

      {/* ── Progress Rings Section ───────────────────────────────── */}
      <section aria-label="Progress overview">
        <Card className="p-4">
          <CardContent className="p-0">
            <h3 className="text-sm font-semibold mb-4">Progress Overview</h3>
            <div className="flex items-center justify-around flex-wrap gap-6">
              <div className="relative">
                <ProgressRing value={data.completionRate} size={110} strokeWidth={10} color="stroke-primary" label="Overall" />
              </div>
              <div className="relative">
                <ProgressRing value={data.weeklyCompletion} size={110} strokeWidth={10} color="stroke-emerald-500" label="This Week" />
              </div>
              <div className="relative">
                <ProgressRing value={data.monthlyCompletion} size={110} strokeWidth={10} color="stroke-teal-500" label="This Month" />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Middle Row: Weekly Chart + Category Performance ─────── */}
      <section aria-label="Charts" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly Completion Bar Chart */}
        <Card className="p-4">
          <CardContent className="p-0">
            <h3 className="text-sm font-semibold mb-4">Weekly Completion</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyBarData} margin={{ top: 20, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`${value}%`, 'Completion']}
                  />
                  <Bar dataKey="rate" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {weeklyBarData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.rate >= 80 ? 'hsl(142, 71%, 45%)' : entry.rate >= 50 ? 'hsl(142, 71%, 60%)' : 'hsl(142, 71%, 75%)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Performance */}
        <Card className="p-4">
          <CardContent className="p-0">
            <h3 className="text-sm font-semibold mb-4">Category Performance</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.categoryPerformance}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                    width={80}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`${value}%`, 'Rate']}
                  />
                  <Bar dataKey="rate" radius={[0, 6, 6, 0]} maxBarSize={20}>
                    {data.categoryPerformance.map((_, index) => (
                      <Cell
                        key={index}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                        fillOpacity={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Monthly Trend Chart (Full Width) ────────────────────── */}
      <section aria-label="Monthly trend">
        <Card className="p-4">
          <CardContent className="p-0">
            <h3 className="text-sm font-semibold mb-4">30-Day Completion Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.monthlyChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`${value}%`, 'Completion']}
                  />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke="hsl(142, 71%, 45%)"
                    strokeWidth={2}
                    fill="url(#greenGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Bottom Row: Leaderboard + Today's Focus ─────────────── */}
      <section aria-label="Details" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Habit Leaderboard */}
        <Card className="p-4">
          <CardContent className="p-0">
            <h3 className="text-sm font-semibold mb-4">Habit Leaderboard</h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Best Habit */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex flex-col items-center text-center gap-2">
                <div className="flex items-center gap-1 text-xs font-medium text-primary">
                  <ArrowUpRight className="h-3 w-3" />
                  Best Performer
                </div>
                <div className="text-2xl">{data.bestHabit.icon}</div>
                <span className="text-sm font-semibold leading-tight">{data.bestHabit.name}</span>
                <span className="text-lg font-bold text-primary">{data.bestHabit.rate}%</span>
                <Crown className="h-4 w-4 text-yellow-500" />
              </div>
              {/* Worst Habit */}
              <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900 p-4 flex flex-col items-center text-center gap-2">
                <div className="flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400">
                  <ArrowDownRight className="h-3 w-3" />
                  Needs Attention
                </div>
                <div className="text-2xl">{data.worstHabit.icon}</div>
                <span className="text-sm font-semibold leading-tight">{data.worstHabit.name}</span>
                <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{data.worstHabit.rate}%</span>
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Focus */}
        <Card className="p-4">
          <CardContent className="p-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Today&apos;s Focus</h3>
              <Badge variant="secondary" className="text-xs">
                {data.todayFocus.length} remaining
              </Badge>
            </div>
            {data.todayFocus.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mb-2 text-primary" />
                <p className="text-sm font-medium">All done for today!</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {data.todayFocus.map((habit) => (
                  <div
                    key={habit.id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg shrink-0">{habit.icon}</span>
                      <span className="text-sm font-medium truncate">{habit.name}</span>
                    </div>
                    <Badge variant={priorityVariant(habit.priority)} className="shrink-0 text-[10px]">
                      {habit.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Quick Insights ──────────────────────────────────────── */}
      {insights.length > 0 && (
        <section aria-label="Quick insights">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Quick Insights</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insights.map((insight, i) => (
              <Card
                key={i}
                className={cn(
                  'p-4',
                  insight.type === 'success' && 'border-primary/30 bg-primary/5',
                  insight.type === 'warning' && 'border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900',
                  insight.type === 'info' && 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900'
                )}
              >
                <CardContent className="p-0 flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">{insight.icon}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{insight.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}