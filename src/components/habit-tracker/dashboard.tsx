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
import { StaggerGroup, StaggerItem } from '@/components/habit-tracker/page-transition';
import { useThemeColor } from '@/hooks/use-theme-color';
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
  Flag,
  ArrowUpRight,
  ArrowDownRight,
  Crown,
  AlertTriangle,
  Sparkles,
  Quote,
  RefreshCw,
  Calendar,
  Wallet,
  Clock,
  History,
  Minus,
} from 'lucide-react';

import type { DashboardData, MotivationalQuote, Period } from './dashboard-types';
import { PERIOD_OPTIONS } from './dashboard-types';
import { DEFAULT_DATA } from './dashboard-default-data';
import {
  ChartInfo,
  ProgressRing,

  PeriodFilter,
  QuoteDisplay,
} from './dashboard-helpers';

const DashboardCharts = dynamic(() => import('./dashboard-charts'), {
  ssr: false,
  loading: () => (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* KPI grid skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="skel-card skel-hybrid skel-stagger p-4"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <div className="h-3 w-3 skel-hybrid skel-circle" style={{ animationDelay: `${i * 60 + 30}ms` }} />
              <div className="h-3 w-20 skel-hybrid" style={{ animationDelay: `${i * 60 + 60}ms` }} />
            </div>
            <div className="h-7 w-16 skel-hybrid mb-1" style={{ animationDelay: `${i * 60 + 90}ms` }} />
            <div className="h-3 w-24 skel-hybrid" style={{ animationDelay: `${i * 60 + 120}ms` }} />
          </div>
        ))}
      </div>
      {/* Chart skeleton */}
      <div
        className="skel-card skel-hybrid skel-stagger h-64"
        style={{ animationDelay: '300ms' }}
      />
      {/* Leaderboard skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="skel-card skel-hybrid skel-stagger h-56"
            style={{ animationDelay: `${400 + i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  ),
});

export default function Dashboard() {
  const refreshKey = useAppStore(s => s.refreshKey);
  const queryClient = useQueryClient();
  const primaryColor = useThemeColor('primary');
  // FIX-COLOR-P3: added destructiveColor so the "missed target" mini-bar
  // follows the user's theme (was hardcoded #ef4444).
  const destructiveColor = useThemeColor('destructive');
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
        text: `Kamu sedang ${data.currentStreak} hari streak! Teruskan!`,
        type: 'success',
      });
    } else if (data.currentStreak >= 3) {
      items.push({
        icon: <Flame className="h-4 w-4 text-orange-400" />,
        text: `${data.currentStreak} hari streak - lagi semangat!`,
        type: 'info',
      });
    }

    if (data.weeklyChartData.length > 0) {
      const bestDay = data.weeklyChartData.reduce((best, d) => (d.rate > best.rate ? d : best), data.weeklyChartData[0]);
      items.push({
        icon: <Trophy className="h-4 w-4 text-warning" />,
        text: `Hari terbaik minggu ini adalah ${bestDay.day} (${bestDay.rate}%).`,
        type: 'info',
      });
    }

    if (data.completionRate >= 80) {
      items.push({
        icon: <Star className="h-4 w-4 text-primary" />,
        text: 'Luar biasa! Completion rate kamu di atas 80%.',
        type: 'success',
      });
    } else if (data.completionRate < 50 && data.totalHabits > 0) {
      items.push({
        icon: <AlertTriangle className="h-4 w-4 text-orange-500" />,
        text: 'Completion rate kamu di bawah 50%. Coba kurangi jumlah habit.',
        type: 'warning',
      });
    }

    if (data.productivityScore >= 80) {
      items.push({
        icon: <Brain className="h-4 w-4 text-primary" />,
        text: `Skor produktivitas tinggi ${data.productivityScore}%!`,
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
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Quote card skeleton */}
        <div
          className="skel-card skel-hybrid skel-stagger p-5 h-28"
          style={{ animationDelay: '0ms' }}
        />
        {/* Period selector skeleton */}
        <div className="flex items-center gap-2">
          <div className="h-4 w-14 skel-hybrid skel-stagger" style={{ animationDelay: '60ms' }} />
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-16 skel-hybrid skel-stagger skel-card"
              style={{ animationDelay: `${90 + i * 40}ms` }}
            />
          ))}
        </div>
        {/* KPI grid skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="skel-card skel-hybrid skel-stagger h-24"
              style={{ animationDelay: `${300 + i * 60}ms` }}
            />
          ))}
        </div>
        {/* Charts grid skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="skel-card skel-hybrid skel-stagger h-80"
              style={{ animationDelay: `${700 + i * 60}ms` }}
            />
          ))}
        </div>
        {/* Bottom cards skeleton */}
        <div
          className="skel-card skel-hybrid skel-stagger h-72"
          style={{ animationDelay: '900ms' }}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="skel-card skel-hybrid skel-stagger h-64"
              style={{ animationDelay: `${960 + i * 60}ms` }}
            />
          ))}
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
            <RefreshCw className="h-3.5 w-3.5" />
            Coba Lagi
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
        {/* ANIM-2 / Feature 4: framer-motion staggerChildren — 60ms cascade
            through cards (smoother than the previous `anim-stagger` CSS class).
            The grid wrapper is the StaggerGroup; each card is wrapped in
            StaggerItem which inherits the visible variant via context. */}
        <StaggerGroup className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {[
            { label: 'Total Habits', icon: Target, iconColor: 'text-primary', value: <CountUpNumber value={displayData.totalHabits} />, sub: 'Habit aktif', key: 'habits' },
            { label: 'Tingkat Penyelesaian', icon: CheckCircle, iconColor: 'text-primary', value: <CountUpNumber value={displayData.completionRate} suffix="%" />, sub: null, progress: displayData.completionRate, key: 'completion' },
            { label: 'Streak Saat Ini', icon: Flame, iconColor: 'text-orange-500', iconClass: displayData.currentStreak >= 7 ? 'anim-flame-pulse' : '', value: <CountUpNumber value={displayData.currentStreak} />, sub: 'hari', key: 'streak' },
            { label: 'Streak Terpanjang', icon: Trophy, iconColor: 'text-warning', value: <CountUpNumber value={displayData.longestStreak} />, sub: 'hari', key: 'longest' },
            { label: 'Sukses Hari Ini', icon: Zap, iconColor: 'text-primary', value: <CountUpNumber value={displayData.successToday} suffix="%" />, sub: null, progress: displayData.successToday, key: 'success' },
            { label: 'Mingguan', icon: CalendarDays, iconColor: 'text-primary', value: <CountUpNumber value={displayData.weeklyCompletion} suffix="%" />, sub: null, progress: displayData.weeklyCompletion, progressColor: '[&>[data-slot=progress-indicator]]:bg-primary', key: 'weekly' },
            { label: 'Bulanan', icon: TrendingUp, iconColor: 'text-teal-500', value: <CountUpNumber value={displayData.monthlyCompletion} suffix="%" />, sub: null, progress: displayData.monthlyCompletion, progressColor: '[&>[data-slot=progress-indicator]]:bg-teal-500', key: 'monthly' },
            { label: 'Total XP', icon: Star, iconColor: 'text-primary', value: <CountUpNumber value={displayData.totalXP} />, sub: `Level ${displayData.currentLevel}`, key: 'xp' },
            { label: 'Level', icon: Award, iconColor: 'text-primary', value: <CountUpNumber value={displayData.currentLevel} />, sub: null, progress: displayData.levelProgress, progressLabel: `${displayData.levelProgress}%`, key: 'level' },
            { label: 'Produktivitas', icon: Brain, iconColor: 'text-primary', value: <CountUpNumber value={displayData.productivityScore} suffix="%" />, sub: null, progress: displayData.productivityScore, key: 'productivity' },
            { label: 'Tujuan', icon: Flag, iconColor: 'text-primary', value: <CountUpNumber value={displayData.goalProgress} suffix="%" />, sub: null, progress: displayData.goalProgress, key: 'goals' },

          ].map((card) => {
            const Icon = card.icon;
            // Hide non-essential KPI cards on mobile (< 640px) to reduce
            // cognitive overload. 15 cards → 6 on mobile.
            // Hidden: longest, success, weekly, monthly, level,
            // productivity, goals.
            // Visible: habits, completion, streak, xp, mood, sleep.
            const MOBILE_HIDDEN = new Set(['longest', 'success', 'weekly', 'monthly', 'level', 'productivity', 'goals']);
            const isHiddenOnMobile = MOBILE_HIDDEN.has(card.key);
            return (
              <StaggerItem
                key={card.key}
                className={cn(isHiddenOnMobile && 'hidden sm:block')}
              >
                <Card className="p-4">
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
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      </section>

      {/* ── Progress Rings Section ───────────────────────────────── */}
      <ScrollReveal>
      <section aria-label="Progress overview">
        <Card className="p-4">
          <CardContent className="p-0">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              Ringkasan Progress
              <ChartInfo text="Persentase hari yang berhasil menyelesaikan minimal 1 habit dari total hari dalam periode yang dipilih." />
            </h3>
            <div className="flex items-center justify-around flex-wrap gap-6">
              <div className="relative">
                <ProgressRing value={displayData.completionRate} size={110} strokeWidth={10} color="stroke-primary" label="Total" />
              </div>
              <div className="relative">
                <ProgressRing value={displayData.weeklyCompletion} size={110} strokeWidth={10} color="stroke-primary" label="Minggu Ini" />
              </div>
              <div className="relative">
                <ProgressRing value={displayData.monthlyCompletion} size={110} strokeWidth={10} color="stroke-teal-500" label="Bulan Ini" />
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

      {/* ── Time-Tracked Habits (Waktu Habit Minggu Ini) ────────────── */}
      {displayData.timeTrackedSummary.length > 0 && (
        <ScrollReveal delay={200}>
        <section aria-label="Time analysis">
          <Card className="p-4">
            <CardContent className="p-0">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  Waktu Habit Minggu Ini
                  <ChartInfo text="Menampilkan jam penyelesaian habit yang memiliki tracking waktu. Rata-rata, on-target rate, dan tren dibanding minggu lalu." />
                </h3>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {displayData.timeTrackedSummary.map((th) => (
                  <div
                    key={th.id}
                    className="rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                  >
                    {/* Header row */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base shrink-0">{th.icon}</span>
                        <span className="text-sm font-medium truncate">{th.name}</span>
                        {th.targetTime && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                            target {th.targetTime}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {/* Today's time */}
                        {th.todayDone && th.todayTime && (
                          <span className={cn(
                            'text-xs font-mono font-semibold px-2 py-0.5 rounded',
                            th.targetTime && th.todayTime <= th.targetTime
                              ? 'bg-success/10 text-success dark:bg-success/15 dark:text-success/80'
                              : 'bg-warning/10 text-warning dark:bg-warning/15 dark:text-warning/80'
                          )}>
                            {th.todayTime}
                          </span>
                        )}
                        {!th.todayDone && (
                          <span className="text-xs text-muted-foreground">Belum</span>
                        )}
                        {/* Trend */}
                        {th.trend !== null && (
                          <span className={cn(
                            'text-xs font-medium flex items-center gap-0.5',
                            th.trend < 0 ? 'text-success dark:text-success/80' : th.trend > 0 ? 'text-destructive dark:text-destructive/80' : 'text-muted-foreground'
                          )}>
                            {th.trend < 0 ? <ArrowDownRight className="h-3 w-3" /> : th.trend > 0 ? <ArrowUpRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                            {th.trend === 0 ? 'sama' : `${Math.abs(th.trend)}mnt`}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Mini bar: 7-day times */}
                    <div className="flex items-end gap-1 h-10">
                      {th.weekTimes.map((wt, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                          {wt.minutes !== null ? (
                            <div
                              className="w-full rounded-sm transition-all"
                              style={{
                                height: `${Math.max(4, (wt.minutes / 1440) * 100)}%`,
                                minHeight: '4px',
                                backgroundColor: th.targetTime
                                  ? (wt.minutes <= (parseInt(th.targetTime.split(':')[0]) * 60 + parseInt(th.targetTime.split(':')[1])) ? primaryColor : destructiveColor)
                                  : primaryColor,
                                opacity: wt.minutes !== null ? 1 : 0.2,
                              }}
                              title={`${wt.day}: ${wt.time}`}
                            />
                          ) : (
                            <div className="w-full rounded-sm bg-muted h-1" title={`${wt.day}: -`} />
                          )}
                          <span className="text-[11px] text-muted-foreground leading-none">{wt.day.slice(0, 2)}</span>
                        </div>
                      ))}
                    </div>
                    {/* Stats row */}
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 mt-2 text-xs text-muted-foreground">
                      <span>Rata-rata: <strong className="text-foreground">{th.weekAvg || '-'}</strong></span>
                      {th.targetTime && (
                        <span>On-target: <strong className={th.weekOnTargetRate >= 70 ? 'text-success dark:text-success/80' : 'text-warning dark:text-warning/80'}>{th.weekOnTargetRate}%</strong> ({th.weekOnTarget}/{th.weekTotal})</span>
                      )}
                      {th.prevAvg && (
                        <span className="hidden sm:inline">Minggu lalu: {th.prevAvg}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
        </ScrollReveal>
      )}

      {/* ── Last Done (Terakhir Dilakukan) ─────────────────────────── */}
      {displayData.lastDoneSummary.length > 0 && (
        <section aria-label="Last done habits">
          <Card className="p-4">
            <CardContent className="p-0">
              <div className="flex items-center gap-2 mb-4">
                <History className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  Terakhir Dilakukan
                  <ChartInfo text="Menampilkan habit yang di-track kapan terakhir kali dikerjakan. Diurutkan dari yang paling lama / paling urgent." />
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {displayData.lastDoneSummary.filter(l => l.overdue).length} overdue
                </Badge>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {displayData.lastDoneSummary.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      'flex items-center justify-between rounded-lg border p-3 transition-colors',
                      item.overdue ? 'border-destructive/30 bg-destructive/10 dark:bg-destructive/15 dark:border-destructive/30' : 'hover:bg-muted/30'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base shrink-0">{item.icon}</span>
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block">{item.name}</span>
                        {item.interval && (
                          <span className="text-xs text-muted-foreground">setiap {item.interval}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {item.completedAt && (
                        <span className="text-xs text-muted-foreground font-mono">{item.completedAt}</span>
                      )}
                      {item.daysAgo !== null ? (
                        <span className={cn(
                          'text-xs font-semibold px-2 py-0.5 rounded-full',
                          item.overdue
                            ? 'bg-destructive/10 text-destructive dark:bg-destructive/15 dark:text-destructive/80'
                            : item.daysAgo === 0
                              ? 'bg-success/10 text-success dark:bg-success/15 dark:text-success/80'
                              : item.daysAgo <= 2
                                ? 'bg-warning/10 text-warning dark:bg-warning/15 dark:text-warning/80'
                                : 'bg-muted text-muted-foreground'
                        )}>
                          {item.daysAgo === 0 ? 'Hari ini' : `${item.daysAgo} hari lalu`}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Belum pernah</span>
                      )}
                      {item.overdue && (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Bottom Row: Leaderboard + Today's Focus ─────────────── */}
      <section aria-label="Details" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <CardContent className="p-0">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              Papan Peringkat Habit
              <ChartInfo text="Peringkat habit berdasarkan jumlah hari diselesaikan dalam periode yang dipilih. Streak dihitung dari hari terakhir sekarang ke belakang berturut-turut." />
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex flex-col items-center text-center gap-2">
                <div className="flex items-center gap-1 text-xs font-medium text-primary">
                  <ArrowUpRight className="h-3 w-3" />
                  Performa Terbaik
                </div>
                <div className="text-2xl">{displayData.bestHabit.icon}</div>
                <span className="text-sm font-semibold leading-tight">{displayData.bestHabit.name}</span>
                <span className="text-lg font-bold text-primary">{displayData.bestHabit.rate}%</span>
                <Crown className="h-4 w-4 text-warning" />
              </div>
              <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900 p-4 flex flex-col items-center text-center gap-2">
                <div className="flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400">
                  <ArrowDownRight className="h-3 w-3" />
                  Perlu Perhatian
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
                Fokus Hari Ini
                <ChartInfo text="Menampilkan daftar habit yang belum diselesaikan hari ini. Urut berdasarkan prioritas." />
              </h3>
              <Badge variant="secondary" className="text-xs">
                {displayData.todayFocus.length} tersisa
              </Badge>
            </div>
            {displayData.todayFocus.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mb-2 text-primary" />
                <p className="text-sm font-medium">Semua selesai hari ini!</p>
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
              <Badge variant="secondary" className="text-xs">
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
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 dark:bg-destructive/15 dark:border-destructive/30 p-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-destructive dark:text-destructive/80">
                  <TrendingDown className="h-3.5 w-3.5" />
                  Pengeluaran
                </div>
                <span className="text-lg font-bold text-destructive dark:text-destructive/80">
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
                    : 'text-destructive dark:text-destructive/80'
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
                  <span className="text-sm font-bold text-destructive dark:text-destructive/80">
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
              Insights
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
