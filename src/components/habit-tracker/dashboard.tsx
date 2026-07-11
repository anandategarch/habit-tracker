'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import {
  Target,
  CheckCircle,
  Flame,
  Trophy,
  Zap,
  CalendarDays,
  TrendingUp,
  TrendingDown,
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
  Quote,
  RefreshCw,
  Calendar,
  BookOpen as BookOpenIcon,
  Wallet,
  Info,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const DashboardCharts = dynamic(() => import('./dashboard-charts'), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  ),
});

function ChartInfo({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Info">
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

type Period = '7d' | '1m' | '3m' | 'all';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: '7 Hari' },
  { value: '1m', label: '1 Bulan' },
  { value: '3m', label: '3 Bulan' },
  { value: 'all', label: 'Semua' },
];

interface MotivationalQuote {
  quote: string;
  translation: string;
  author: string;
}

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
  period: string;
  habitDetailStats: { id: string; name: string; icon: string; color: string; category: string; completed: number; total: number; rate: number; streak: number }[];
  stackedBarData: { day: string; completed: number; missed: number; total: number; rate: number }[];
  weeklyPattern: { day: string; fullDay: string; rate: number; avgCompleted: string }[];
  financeOverview: {
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
    transactionCount: number;
    budgetWarning: number;
    budgetExceeded: number;
  };
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


function getMoodLabel(mood: string) {
  return mood.charAt(0).toUpperCase() + mood.slice(1);
}

function PeriodFilter({
  period,
  onPeriodChange,
}: {
  period: Period;
  onPeriodChange: (p: Period) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 p-1 bg-muted rounded-lg w-fit">
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onPeriodChange(opt.value)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150',
            period === opt.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const DEFAULT_DATA: DashboardData = {
  totalHabits: 0,
  completionRate: 0,
  currentStreak: 0,
  longestStreak: 0,
  successToday: 0,
  weeklyCompletion: 0,
  monthlyCompletion: 0,
  bestHabit: { name: 'N/A', icon: '🏆', rate: 0 },
  worstHabit: { name: 'N/A', icon: '📉', rate: 0 },
  totalXP: 0,
  currentLevel: 1,
  nextLevelXP: 100,
  currentLevelXP: 0,
  levelProgress: 0,
  unlockedBadges: 0,
  totalBadges: 0,
  challengeProgress: 0,
  goalProgress: 0,
  moodAverage: '3.0',
  sleepAverage: '7.0',
  productivityScore: 0,
  weeklyChartData: [],
  monthlyChartData: [],
  categoryPerformance: [],
  todayFocus: [],
  period: 'all',
  habitDetailStats: [],
  stackedBarData: [],
  weeklyPattern: [],
  financeOverview: { totalIncome: 0, totalExpense: 0, netBalance: 0, transactionCount: 0, budgetWarning: 0, budgetExceeded: 0 },
};

export default function Dashboard() {
  const { refreshKey } = useAppStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [period, setPeriod] = useState<Period>('all');
  const [quote, setQuote] = useState<MotivationalQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const fetchErrorRef = useRef(false);
  const loading = data === null;

  // Fetch dashboard data with period
  useEffect(() => {
    let cancelled = false;
    fetchErrorRef.current = false;
    requestAnimationFrame(() => {
      setFetching(true);
      fetch(`/api/dashboard?period=${period}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((json) => {
          if (!cancelled) {
            if (json.error) {
              setFetchError(true);
            } else {
              setData(json);
              setFetchError(false);
            }
          }
        })
        .catch(() => {
          if (!cancelled) setFetchError(true);
        })
        .finally(() => {
          if (!cancelled) setFetching(false);
        });
    });
    return () => { cancelled = true; };
  }, [refreshKey, period, retryCount]);

  // Fetch motivational quote
  useEffect(() => {
    let cancelled = false;
    requestAnimationFrame(() => {
      fetch('/api/motivational-quote')
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled && d.quote) {
            setQuote({ quote: d.quote, translation: d.translation || '', author: d.author });
          }
        })
        .catch((err) => {
          if (!cancelled) console.error('Failed to fetch motivational quote:', err);
        })
        .finally(() => {
          if (!cancelled) setQuoteLoading(false);
        });
    });
    return () => { cancelled = true; };
  }, []);

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod);
  };

  const handleRefreshQuote = () => {
    setQuoteLoading(true);
    setQuote(null);
    fetch('/api/motivational-quote?refresh=true')
      .then((r) => r.json())
      .then((d) => {
        if (d.quote) setQuote({ quote: d.quote, translation: d.translation || '', author: d.author });
      })
      .catch((err) => console.error('Failed to refresh quote:', err))
      .finally(() => setQuoteLoading(false));
  };

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

  // Chart label for the period
  const chartLabel = useMemo(() => {
    switch (period) {
      case '7d': return '7 Hari';
      case '1m': return '30 Hari';
      case '3m': return '90 Hari';
      default: return '30 Hari';
    }
  }, [period]);

  if (fetchError && !fetching) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">Failed to load dashboard data</p>
          <Button variant="outline" size="sm" onClick={() => { setFetchError(false); setRetryCount((c) => c + 1); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-10 w-64" />
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

  const displayData = data || DEFAULT_DATA;
  const weeklyBarData = displayData.weeklyChartData.map((d) => ({
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
      {/* ── Motivational Quote Card ────────────────────────────────── */}
      <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
        <div className="absolute top-3 right-3 opacity-10">
          <Quote className="h-16 w-16 text-primary" />
        </div>
        <CardContent className="p-5 relative z-10">
          {quoteLoading ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ) : quote ? (
            <div className="flex items-start gap-3">
              <div className="mt-1 shrink-0 w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm md:text-base font-medium text-foreground leading-relaxed italic">
                  &ldquo;{quote.quote}&rdquo;
                </p>
                {quote.translation && quote.translation !== quote.quote && (
                  <p className="text-xs md:text-sm text-muted-foreground leading-relaxed mt-1.5">
                    {quote.translation}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">
                    — {quote.author}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={handleRefreshQuote}
                    aria-label="Refresh quote"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ── Period Filter ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Periode:</span>
        <PeriodFilter period={period} onPeriodChange={handlePeriodChange} />
        {period !== 'all' && (
          <Badge variant="secondary" className="text-[10px]">
            Data {PERIOD_OPTIONS.find(p => p.value === period)?.label}
          </Badge>
        )}
        {fetching && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-3 w-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            Memuat...
          </div>
        )}
      </div>

      {/* ── KPI Cards Grid ──────────────────────────────────────── */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Total Habits</span>
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{displayData.totalHabits}</div>
            <p className="text-xs text-muted-foreground mt-1">Active habits</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Completion Rate</span>
              <CheckCircle className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{displayData.completionRate}%</div>
            <Progress value={displayData.completionRate} className="mt-2 h-1.5" />
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Current Streak</span>
              <Flame className="h-4 w-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold">{displayData.currentStreak}</div>
            <p className="text-xs text-muted-foreground mt-1">days</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Longest Streak</span>
              <Trophy className="h-4 w-4 text-yellow-500" />
            </div>
            <div className="text-2xl font-bold">{displayData.longestStreak}</div>
            <p className="text-xs text-muted-foreground mt-1">days</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Success Today</span>
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{displayData.successToday}%</div>
            <Progress value={displayData.successToday} className="mt-2 h-1.5" />
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Weekly</span>
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{displayData.weeklyCompletion}%</div>
            <Progress value={displayData.weeklyCompletion} className="mt-2 h-1.5 [&>[data-slot=progress-indicator]]:bg-primary" />
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Monthly</span>
              <TrendingUp className="h-4 w-4 text-teal-500" />
            </div>
            <div className="text-2xl font-bold">{displayData.monthlyCompletion}%</div>
            <Progress value={displayData.monthlyCompletion} className="mt-2 h-1.5 [&>[data-slot=progress-indicator]]:bg-teal-500" />
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Total XP</span>
              <Star className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{displayData.totalXP.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Level {displayData.currentLevel}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Level</span>
              <Award className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{displayData.currentLevel}</div>
            <div className="flex items-center gap-1 mt-1">
              <Progress value={displayData.levelProgress} className="h-1.5 flex-1" />
              <span className="text-[10px] text-muted-foreground">{displayData.levelProgress}%</span>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Badges</span>
              <Award className="h-4 w-4 text-yellow-500" />
            </div>
            <div className="text-2xl font-bold">
              {displayData.unlockedBadges}<span className="text-sm font-normal text-muted-foreground">/{displayData.totalBadges}</span>
            </div>
            <Progress value={displayData.totalBadges > 0 ? (displayData.unlockedBadges / displayData.totalBadges) * 100 : 0} className="mt-2 h-1.5" />
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Mood</span>
              <Smile className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <MoodEmoji mood={displayData.moodAverage} />
              <span className="text-lg font-bold">{getMoodLabel(displayData.moodAverage)}</span>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Sleep Avg</span>
              <Moon className="h-4 w-4 text-violet-400" />
            </div>
            <div className="text-2xl font-bold">{displayData.sleepAverage}</div>
            <p className="text-xs text-muted-foreground mt-1">hours / night</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Productivity</span>
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{displayData.productivityScore}%</div>
            <Progress value={displayData.productivityScore} className="mt-2 h-1.5" />
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Challenges</span>
              <Swords className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{displayData.challengeProgress}%</div>
            <Progress value={displayData.challengeProgress} className="mt-2 h-1.5" />
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">Goals</span>
              <Flag className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{displayData.goalProgress}%</div>
            <Progress value={displayData.goalProgress} className="mt-2 h-1.5" />
          </Card>
        </div>
      </section>

      {/* ── Progress Rings Section ───────────────────────────────── */}
      <section aria-label="Progress overview">
        <Card className="p-4">
          <CardContent className="p-0">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              Progress Overview
              <ChartInfo text="Persentase hari yang berhasil menyelesaikan minimal 1 habit dari total hari dalam periode yang dipilih." />
            </h3>
            <div className="flex items-center justify-around flex-wrap gap-6">
              <div className="relative">
                <ProgressRing value={displayData.completionRate} size={110} strokeWidth={10} color="stroke-primary" label="Overall" />
              </div>
              <div className="relative">
                <ProgressRing value={displayData.weeklyCompletion} size={110} strokeWidth={10} color="stroke-primary" label="This Week" />
              </div>
              <div className="relative">
                <ProgressRing value={displayData.monthlyCompletion} size={110} strokeWidth={10} color="stroke-teal-500" label="This Month" />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <DashboardCharts
        weeklyBarData={weeklyBarData}
        categoryPerformance={displayData.categoryPerformance}
        monthlyChartData={displayData.monthlyChartData}
        stackedBarData={displayData.stackedBarData}
        weeklyPattern={displayData.weeklyPattern}
        chartLabel={chartLabel}
      />

      {/* ── Bottom Row: Leaderboard + Today's Focus ─────────────── */}
      <section aria-label="Details" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <CardContent className="p-0">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              Habit Leaderboard
              <ChartInfo text="Peringkat habit berdasarkan jumlah hari diselesaikan dalam periode yang dipilih. Streak dihitung dari hari terakhir sekarang ke belakang berturut-turut." />
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex flex-col items-center text-center gap-2">
                <div className="flex items-center gap-1 text-xs font-medium text-primary">
                  <ArrowUpRight className="h-3 w-3" />
                  Best Performer
                </div>
                <div className="text-2xl">{displayData.bestHabit.icon}</div>
                <span className="text-sm font-semibold leading-tight">{displayData.bestHabit.name}</span>
                <span className="text-lg font-bold text-primary">{displayData.bestHabit.rate}%</span>
                <Crown className="h-4 w-4 text-yellow-500" />
              </div>
              <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900 p-4 flex flex-col items-center text-center gap-2">
                <div className="flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400">
                  <ArrowDownRight className="h-3 w-3" />
                  Needs Attention
                </div>
                <div className="text-2xl">{displayData.worstHabit.icon}</div>
                <span className="text-sm font-semibold leading-tight">{displayData.worstHabit.name}</span>
                <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{displayData.worstHabit.rate}%</span>
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardContent className="p-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                Today&apos;s Focus
                <ChartInfo text="Menampilkan daftar habit yang belum diselesaikan hari ini. Urut berdasarkan prioritas." />
              </h3>
              <Badge variant="secondary" className="text-xs">
                {displayData.todayFocus.length} remaining
              </Badge>
            </div>
            {displayData.todayFocus.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mb-2 text-primary" />
                <p className="text-sm font-medium">All done for today!</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {displayData.todayFocus.map((habit) => (
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

      {/* ── Keuangan Bulan Ini ────────────────────────────────────────── */}
      <section aria-label="Finance overview">
        <Card className="p-4">
          <CardContent className="p-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  Keuangan Bulan Ini
                  <ChartInfo text="Pemasukan dan pengeluaran dari semua transaksi bulan ini. Saldo = pemasukan − pengeluaran. Status anggaran menunjukkan jumlah kategori yang terlampaui 80% atau 100%." />
                </h3>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {displayData.financeOverview.transactionCount} transaksi
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Income */}
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Pemasukan
                </div>
                <span className="text-lg font-bold text-primary">
                  {displayData.financeOverview.totalIncome.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
              {/* Expense */}
              <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                  <TrendingDown className="h-3.5 w-3.5" />
                  Pengeluaran
                </div>
                <span className="text-lg font-bold text-red-700 dark:text-red-300">
                  {displayData.financeOverview.totalExpense.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
              {/* Net Balance */}
              <div className="rounded-lg border border-teal-200 bg-teal-50 dark:bg-teal-950/20 dark:border-teal-900 p-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-teal-600 dark:text-teal-400">
                  <Wallet className="h-3.5 w-3.5" />
                  Saldo Bersih
                </div>
                <span className={cn(
                  'text-lg font-bold',
                  displayData.financeOverview.netBalance >= 0
                    ? 'text-teal-700 dark:text-teal-300'
                    : 'text-red-700 dark:text-red-300'
                )}>
                  {displayData.financeOverview.netBalance.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
              {/* Budget Alerts */}
              <div className={cn(
                'rounded-lg border p-3 flex flex-col gap-1.5',
                (displayData.financeOverview.budgetExceeded > 0 || displayData.financeOverview.budgetWarning > 0)
                  ? 'border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900'
                  : 'border-primary/20 bg-primary/10'
              )}>
                <div className="flex items-center gap-1.5 text-xs font-medium text-orange-600 dark:text-orange-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Status Anggaran
                </div>
                {displayData.financeOverview.budgetExceeded > 0 ? (
                  <span className="text-sm font-bold text-red-600 dark:text-red-400">
                    {displayData.financeOverview.budgetExceeded} melebihi batas
                  </span>
                ) : displayData.financeOverview.budgetWarning > 0 ? (
                  <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                    {displayData.financeOverview.budgetWarning} hampir limit
                  </span>
                ) : (
                  <span className="text-sm font-bold text-primary">
                    Semua aman
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Per-Habit Performance Table ───────────────────────────────── */}
      {displayData.habitDetailStats.length > 0 && (
        <section aria-label="Habit details">
          <Card className="p-4">
            <CardContent className="p-0">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                Performa Per Habit
                <ChartInfo text="Detail statistik per habit termasuk jumlah hari selesai, completion rate, dan streak terkini dalam periode yang dipilih." />
              </h3>
              <div className="max-h-80 overflow-y-auto pr-1">
                <div className="space-y-2">
                  {displayData.habitDetailStats.map((habit) => (
                    <div
                      key={habit.id}
                      className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                    >
                      <span className="text-lg shrink-0">{habit.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate">{habit.name}</span>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {habit.streak > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] text-orange-500">
                                <Flame className="h-3 w-3" />{habit.streak}
                              </span>
                            )}
                            <span className="text-xs font-bold">{habit.rate}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={habit.rate} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {habit.completed}/{habit.total}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Quick Insights ──────────────────────────────────────── */}
      {insights.length > 0 && (
        <section aria-label="Quick insights">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Quick Insights
              <ChartInfo text="Analisis otomatis berdasarkan data habit 30 hari terakhir. Dibandingkan dengan periode sebelumnya." />
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insights.map((insight, i) => (
              <Card
                key={i}
                className={cn(
                  'p-4',
                  insight.type === 'success' && 'border-primary/30 bg-primary/5',
                  insight.type === 'warning' && 'border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900',
                  insight.type === 'info' && 'border-primary/20 bg-primary/10'
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