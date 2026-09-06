'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { CountUpNumber } from '@/components/habit-tracker/count-up';
import { ScrollReveal } from '@/components/habit-tracker/scroll-reveal';
import { WeeklyReview } from '@/components/habit-tracker/weekly-review';
import { useThemeColor } from '@/hooks/use-theme-color';
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
  Quote,
  RefreshCw,
  Calendar,
  BookOpen as BookOpenIcon,
} from 'lucide-react';
import { type Period, PERIOD_OPTIONS, type MotivationalQuote, type DashboardData } from './dashboard-types';
import { DEFAULT_DATA } from './dashboard-default-data';
import { ChartInfo, ProgressRing, MoodEmoji, getMoodLabel, PeriodFilter, QuoteDisplay } from './dashboard-helpers';
import { TimeTrackedHabits } from './dashboard-time-tracked-habits';
import { LastDoneSummaryCard } from './dashboard-last-done';
import { FinanceOverviewCard } from './dashboard-finance-overview';

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

// PHASE3-HABIT — Hourly consistency heatmap ("Kapan paling konsisten?").
// Lazy-loaded since it's below the fold and only relevant once the user
// scrolls past the dashboard charts.
const HourlyConsistency = dynamic(() => import('./hourly-consistency'), {
  ssr: false,
  loading: () => <Skeleton className="h-44 rounded-xl" />,
});

export default function Dashboard() {
  const refreshKey = useAppStore(s => s.refreshKey);
  const queryClient = useQueryClient();
  const primaryColor = useThemeColor('primary');
  const [period, setPeriod] = useState<Period>('all');
  const [retryCount, setRetryCount] = useState(0);

  // ── Dashboard data (TanStack Query) ────────────────────────────────────
  // Replaces manual useEffect + useState + fetch pattern.
  // Benefits: automatic dedup, background refetch, cache sharing, race-free.
  const { data: data, isFetching: fetching, isError: fetchError } = useQuery({
    queryKey: ['dashboard', period, refreshKey, retryCount],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard?period=${period}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      return json as DashboardData;
    },
    retry: 1,
  });

  // ── Motivational quote (TanStack Query) ────────────────────────────────
  const { data: quoteData, isLoading: quoteLoading } = useQuery<{
    quote?: string;
    translation?: string;
    author?: string;
  }>({
    queryKey: ['motivational-quote'],
    queryFn: async () => {
      const r = await fetch('/api/motivational-quote');
      return r.json();
    },
    staleTime: Infinity, // quote doesn't change unless user manually refreshes
  });

  const quote: MotivationalQuote | null = quoteData?.quote
    ? { quote: quoteData.quote, translation: quoteData.translation || '', author: quoteData.author || '' }
    : null;

  const loading = data === undefined && !fetchError;

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod);
  };

  const handleRefreshQuote = () => {
    // Force refetch with a fresh request (bypass cache)
    queryClient.invalidateQueries({ queryKey: ['motivational-quote'] });
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
      case 'all': return 'Semua';
      default: return '30 Hari';
    }
  }, [period]);

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

  const priorityVariant = (p?: string) => {
    // Guard against null/undefined — previously crashed on .toLowerCase()
    // if a habit had a missing priority field.
    switch ((p ?? 'medium').toLowerCase()) {
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
      {fetchError && !fetching && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">Gagal memuat data terbaru</p>
          <Button variant="outline" size="sm" onClick={() => setRetryCount((c) => c + 1)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      )}
      {/* ── Motivational Quote Card ────────────────────────────────── */}
      <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
        <div className="absolute top-3 right-3 opacity-10">
          <Quote className="h-16 w-16 text-primary" />
        </div>
        <CardContent className="p-5 relative z-10">
          {quoteLoading ? (
            <div className="flex items-center gap-3 flex-wrap gap-y-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ) : quote ? (
            <QuoteDisplay quote={quote} onRefresh={handleRefreshQuote} />
          ) : null}
        </CardContent>
      </Card>

      {/* ── Period Filter ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap gap-y-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Periode:</span>
        <PeriodFilter period={period} onPeriodChange={handlePeriodChange} />
        {period !== 'all' && (
          <Badge variant="secondary" className="text-xs">
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
          {[
            { label: 'Total Habits', icon: Target, iconColor: 'text-primary', value: <CountUpNumber value={displayData.totalHabits} />, sub: 'Active habits', key: 'habits' },
            { label: 'Completion Rate', icon: CheckCircle, iconColor: 'text-primary', value: <CountUpNumber value={displayData.completionRate} suffix="%" />, sub: null, progress: displayData.completionRate, key: 'completion' },
            { label: 'Current Streak', icon: Flame, iconColor: 'text-orange-500', iconClass: displayData.currentStreak >= 7 ? 'anim-flame-pulse' : '', value: <CountUpNumber value={displayData.currentStreak} />, sub: 'days', key: 'streak' },
            { label: 'Longest Streak', icon: Trophy, iconColor: 'text-yellow-500', value: <CountUpNumber value={displayData.longestStreak} />, sub: 'days', key: 'longest' },
            { label: 'Success Today', icon: Zap, iconColor: 'text-primary', value: <CountUpNumber value={displayData.successToday} suffix="%" />, sub: null, progress: displayData.successToday, key: 'success' },
            { label: 'Weekly', icon: CalendarDays, iconColor: 'text-primary', value: <CountUpNumber value={displayData.weeklyCompletion} suffix="%" />, sub: null, progress: displayData.weeklyCompletion, progressColor: '[&>[data-slot=progress-indicator]]:bg-primary', key: 'weekly' },
            { label: 'Monthly', icon: TrendingUp, iconColor: 'text-teal-500', value: <CountUpNumber value={displayData.monthlyCompletion} suffix="%" />, sub: null, progress: displayData.monthlyCompletion, progressColor: '[&>[data-slot=progress-indicator]]:bg-teal-500', key: 'monthly' },
            { label: 'Total XP', icon: Star, iconColor: 'text-primary', value: <CountUpNumber value={displayData.totalXP} />, sub: `Level ${displayData.currentLevel}`, key: 'xp' },
            { label: 'Level', icon: Award, iconColor: 'text-primary', value: <CountUpNumber value={displayData.currentLevel} />, sub: null, progress: displayData.levelProgress, progressLabel: `${displayData.levelProgress}%`, key: 'level' },
            { label: 'Badges', icon: Award, iconColor: 'text-yellow-500', value: <span><CountUpNumber value={displayData.unlockedBadges} /><span className="text-sm font-normal text-muted-foreground">/{displayData.totalBadges}</span></span>, sub: null, progress: displayData.totalBadges > 0 ? (displayData.unlockedBadges / displayData.totalBadges) * 100 : 0, key: 'badges' },
            { label: 'Productivity', icon: Brain, iconColor: 'text-primary', value: <CountUpNumber value={displayData.productivityScore} suffix="%" />, sub: null, progress: displayData.productivityScore, key: 'productivity' },
            { label: 'Challenges', icon: Swords, iconColor: 'text-primary', value: <CountUpNumber value={displayData.challengeProgress} suffix="%" />, sub: null, progress: displayData.challengeProgress, key: 'challenges' },
            { label: 'Goals', icon: Flag, iconColor: 'text-primary', value: <CountUpNumber value={displayData.goalProgress} suffix="%" />, sub: null, progress: displayData.goalProgress, key: 'goals' },
            { label: 'Mood', icon: Smile, iconColor: 'text-primary', value: <span className="flex items-center gap-2"><span className="anim-micro-pulse"><MoodEmoji mood={displayData.moodAverage} /></span><span className="text-lg font-bold">{getMoodLabel(displayData.moodAverage)}</span></span>, sub: null, key: 'mood' },
            { label: 'Sleep Avg', icon: Moon, iconColor: 'text-violet-400', value: <CountUpNumber value={Number(displayData.sleepAverage) || 0} />, sub: 'hours / night', key: 'sleep' },
          ].map((card, i) => {
            const Icon = card.icon;
            // Hide non-essential KPI cards on mobile (< 640px) to reduce
            // cognitive overload. 15 cards → 6 on mobile.
            // Hidden: longest, success, weekly, monthly, level, badges,
            // productivity, challenges, goals.
            // Visible: habits, completion, streak, xp, mood, sleep.
            const MOBILE_HIDDEN = new Set(['longest', 'success', 'weekly', 'monthly', 'level', 'badges', 'productivity', 'challenges', 'goals']);
            const isHiddenOnMobile = MOBILE_HIDDEN.has(card.key);
            return (
              <Card
                key={card.key}
                className={cn('p-4 anim-stagger', isHiddenOnMobile && 'hidden sm:block')}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
                  <Icon className={cn('h-4 w-4', card.iconColor, card.iconClass)} />
                </div>
                <div className="tabular-nums text-xl sm:text-2xl font-bold">{card.value}</div>
                {card.progress !== undefined && (
                  <div className="flex items-center gap-1 mt-2">
                    <Progress value={card.progress} className={cn('h-1.5 flex-1', card.progressColor)} />
                    {card.progressLabel && <span className="text-xs text-muted-foreground">{card.progressLabel}</span>}
                  </div>
                )}
                {card.sub && <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>}
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── Weekly Review + AI Insights ──────────────────────────── */}
      <ScrollReveal>
        <WeeklyReview />
      </ScrollReveal>

      {/* ── Progress Rings Section ───────────────────────────────── */}
      <ScrollReveal>
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
      </ScrollReveal>

      <ScrollReveal delay={100}>
      <DashboardCharts
        weeklyBarData={weeklyBarData}
        categoryPerformance={displayData.categoryPerformance}
        monthlyChartData={displayData.monthlyChartData}
        stackedBarData={displayData.stackedBarData}
        weeklyPattern={displayData.weeklyPattern}
        chartLabel={chartLabel}
      />
      </ScrollReveal>

      {/* PHASE3-HABIT — Hourly consistency heatmap ("Kapan paling konsisten?").
          Shows which hours of the day the user most consistently completes
          habits, across ALL habits (not per-habit). Period matches the
          dashboard's selected period (7d/1m/3m → 7/30/90 days; all → 365). */}
      <ScrollReveal delay={150}>
        <HourlyConsistency
          periodDays={
            period === '7d' ? 7 :
            period === '1m' ? 30 :
            period === '3m' ? 90 : 365
          }
        />
      </ScrollReveal>

      {/* ── Time-Tracked Habits (Waktu Habit Minggu Ini) ────────────── */}
      <TimeTrackedHabits data={displayData.timeTrackedSummary} primaryColor={primaryColor} />

      {/* ── Last Done (Terakhir Dilakukan) ─────────────────────────── */}
      <LastDoneSummaryCard data={displayData.lastDoneSummary} />

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
                    <Badge variant={priorityVariant(habit.priority)} className="shrink-0 text-xs">
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
      <FinanceOverviewCard data={displayData.financeOverview} />

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
                              <span className="flex items-center gap-0.5 text-xs text-orange-500">
                                <Flame className="h-3 w-3" />{habit.streak}
                              </span>
                            )}
                            <span className="text-xs font-bold">{habit.rate}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={habit.rate} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground shrink-0">
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