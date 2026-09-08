'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/app-store';
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
import { jakartaDateString } from '@/lib/jakarta-date';
import { jakartaNowParts } from '@/lib/timezone';
import {
  Target,
  BarChart3,
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
  Flag,
  ArrowUpRight,
  ArrowDownRight,
  Crown,
  AlertTriangle,
  Sparkles,
  Quote,
  RefreshCw,
  Calendar,
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
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <Skeleton className="h-72 rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  ),
});

// PHASE3-HABIT — Hourly consistency heatmap ("Kapan paling konsisten?").
// Lazy-loaded since it's below the fold and only relevant once the user
// scrolls past the dashboard charts.
const HourlyConsistency = dynamic(() => import('./hourly-consistency'), {
  ssr: false,
  loading: () => <Skeleton className="h-44 rounded-2xl" />,
});

/* ── PREMIUM UI v2 ("Rutina Aurora") — Hero greeting ─────────────────────
 * Signature teal→emerald gradient panel at the very top of the dashboard.
 * The greeting follows the Jakarta wall-clock hour; the date label is
 * formatted in Indonesian from the Jakarta date string (local-midnight
 * Date so the label is stable in any browser timezone). Client-only by
 * design — Dashboard is dynamically imported with ssr:false — but window
 * is still guarded for safety.
 */
function GreetingHero({ successToday }: { successToday: number }) {
  const { greeting, dateLabel } = useMemo(() => {
    if (typeof window === 'undefined') {
      return { greeting: 'Selamat datang 👋', dateLabel: '' };
    }
    const { hours } = jakartaNowParts();
    const greeting =
      hours >= 4 && hours < 11
        ? 'Selamat pagi 🌤'
        : hours >= 11 && hours < 15
          ? 'Selamat siang ☀️'
          : hours >= 15 && hours < 19
            ? 'Selamat sore 🌇'
            : 'Selamat malam 🌙';
    const [y, m, d] = jakartaDateString().split('-').map(Number);
    const dateLabel = new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(y, m - 1, d));
    return { greeting, dateLabel };
  }, []);

  return (
    <div className="premium-hero">
      <div className="premium-hero-bubbles" aria-hidden="true" />
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 px-5 py-5 sm:px-6">
        <div className="premium-fade-up min-w-0">
          <h2 className="text-lg font-bold tracking-tight sm:text-xl">{greeting}</h2>
          {dateLabel && <p className="mt-1 text-[13px] font-medium opacity-90">{dateLabel}</p>}
        </div>
        <div
          className="premium-fade-up flex shrink-0 items-center gap-3 rounded-2xl border border-white/25 bg-white/10 px-4 py-2.5"
          style={{ animationDelay: '120ms' }}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/25 bg-white/10">
            <Zap className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <span className="block leading-none">
            <span className="premium-stat block text-xl sm:text-2xl">{Math.round(successToday)}%</span>
            <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80">
              Hari ini
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const refreshKey = useAppStore(s => s.refreshKey);
  // ── Task 4-a "1-click wiring": deep-link actions from the global store.
  // The dashboard used to be a read-only island — KPI cards, Today's Focus
  // rows, per-habit rows and the finance card below now jump straight to the
  // tab + view that contains the data (store primitives from Task 4-foundation).
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const openHabitFocus = useAppStore((s) => s.openHabitFocus);
  const openTrackerDate = useAppStore((s) => s.openTrackerDate);
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
        icon: <span className="chip-soft chip-soft-amber h-8 w-8"><Flame className="h-4 w-4" /></span>,
        text: `Streak ${data.currentStreak} hari berjalan — terus pertahankan!`,
        type: 'success',
      });
    } else if (data.currentStreak >= 3) {
      items.push({
        icon: <span className="chip-soft chip-soft-amber h-8 w-8"><Flame className="h-4 w-4" /></span>,
        text: `Streak ${data.currentStreak} hari — momentum mulai terbentuk!`,
        type: 'info',
      });
    }

    if (data.weeklyChartData.length > 0) {
      const bestDay = data.weeklyChartData.reduce((best, d) => (d.rate > best.rate ? d : best), data.weeklyChartData[0]);
      items.push({
        icon: <span className="chip-soft chip-soft-teal h-8 w-8"><Trophy className="h-4 w-4" /></span>,
        text: `Hari terbaik minggu ini: ${bestDay.day} (${bestDay.rate}%).`,
        type: 'info',
      });
    }

    if (data.completionRate >= 80) {
      items.push({
        icon: <span className="chip-soft chip-soft-teal h-8 w-8"><Star className="h-4 w-4" /></span>,
        text: 'Luar biasa! Tingkat penyelesaianmu di atas 80%.',
        type: 'success',
      });
    } else if (data.completionRate < 50 && data.totalHabits > 0) {
      items.push({
        icon: <span className="chip-soft chip-soft-rose h-8 w-8"><AlertTriangle className="h-4 w-4" /></span>,
        text: 'Tingkat penyelesaikanmu di bawah 50%. Coba kurangi jumlah habit.',
        type: 'warning',
      });
    }

    if (data.productivityScore >= 80) {
      items.push({
        icon: <span className="chip-soft chip-soft-violet h-8 w-8"><Brain className="h-4 w-4" /></span>,
        text: `Skor produktivitas tinggi: ${data.productivityScore}%!`,
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
        <Skeleton className="h-[88px] w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-10 w-64 rounded-full" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-80 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const displayData = data || DEFAULT_DATA;
  // ONE-CLICK (bugfix 6-a): habit ids for the "Peringkat Habit" tiles —
  // carried additively by /api/dashboard's bestHabit/worstHabit. Undefined
  // on the zero-habit "N/A" fallback, in which case the tiles render as
  // static divs (no dead buttons).
  const bestHabitId = displayData.bestHabit.id;
  const worstHabitId = displayData.worstHabit.id;
  // Jakarta "today" — destination of the Today's Focus row jump (so the user
  // lands on the tracker grid ready to complete the habit).
  const todayStr = jakartaDateString();
  const weeklyBarData = displayData.weeklyChartData.map((d) => ({
    ...d,
    label: d.day.slice(0, 3),
  }));
  // PHASE3-HABIT period mapping for the hourly-consistency heatmap.
  // BUGFIX 6-a: used as the React `key` too — remounting on period change
  // resets the selected-hour detail box so it can't show stale counts from
  // the previously selected period (same instance kept its old selection).
  const hourlyPeriodDays =
    period === '7d' ? 7 :
    period === '1m' ? 30 :
    period === '3m' ? 90 : 365;

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
    <div className="app-ambience space-y-6">
      {/* ── Hero Greeting (Rutina Aurora) ───────────────────────── */}
      <GreetingHero successToday={displayData.successToday} />

      {fetchError && !fetching && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">Gagal memuat data terbaru</p>
          <Button variant="outline" size="sm" onClick={() => setRetryCount((c) => c + 1)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Coba Lagi
          </Button>
        </div>
      )}

      {/* ── Motivational Quote Card (glass tinted) ──────────────── */}
      <div className="premium-quote">
        <div className="pointer-events-none absolute right-4 top-4 opacity-10" aria-hidden="true">
          <Quote className="h-14 w-14 text-primary" />
        </div>
        <div className="relative z-10 p-5">
          {quoteLoading ? (
            <div className="flex items-center gap-3 flex-wrap gap-y-2">
              <Skeleton className="h-8 w-8 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ) : quote ? (
            <QuoteDisplay quote={quote} onRefresh={handleRefreshQuote} />
          ) : null}
        </div>
      </div>

      {/* ── Period Filter ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="premium-label">Periode</span>
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
            { label: 'Total Habit', icon: Target, chip: 'chip-teal', value: <CountUpNumber value={displayData.totalHabits} />, sub: 'habit aktif', key: 'habits', nav: () => setActiveTab('tracker'), navLabel: 'Buka tab tracker untuk melihat semua habit' },
            { label: 'Tingkat Selesai', icon: CheckCircle, chip: 'chip-emerald', value: <CountUpNumber value={displayData.completionRate} suffix="%" />, sub: null, progress: displayData.completionRate, key: 'completion' },
            { label: 'Streak Aktif', icon: Flame, chip: 'chip-orange', iconClass: displayData.currentStreak >= 7 ? 'anim-flame-pulse' : '', value: <CountUpNumber value={displayData.currentStreak} />, sub: 'hari', key: 'streak' },
            { label: 'Rekor Streak', icon: Trophy, chip: 'chip-amber', value: <CountUpNumber value={displayData.longestStreak} />, sub: 'hari', key: 'longest' },
            { label: 'Hari Ini', icon: Zap, chip: 'chip-lime', value: <CountUpNumber value={displayData.successToday} suffix="%" />, sub: null, progress: displayData.successToday, key: 'success', nav: () => setActiveTab('tracker'), navLabel: 'Buka tab tracker hari ini' },
            { label: '7 Hari', icon: CalendarDays, chip: 'chip-sky', value: <CountUpNumber value={displayData.weeklyCompletion} suffix="%" />, sub: null, progress: displayData.weeklyCompletion, key: 'weekly' },
            { label: '30 Hari', icon: TrendingUp, chip: 'chip-teal', value: <CountUpNumber value={displayData.monthlyCompletion} suffix="%" />, sub: null, progress: displayData.monthlyCompletion, key: 'monthly' },
            { label: 'Total XP', icon: Star, chip: 'chip-amber', value: <CountUpNumber value={displayData.totalXP} />, sub: `Level ${displayData.currentLevel}`, key: 'xp' },
            { label: 'Level', icon: Award, chip: 'chip-violet', value: <CountUpNumber value={displayData.currentLevel} />, sub: null, progress: displayData.levelProgress, progressLabel: `${displayData.levelProgress}%`, key: 'level' },
            { label: 'Lencana', icon: Award, chip: 'chip-rose', value: <span><CountUpNumber value={displayData.unlockedBadges} /><span className="text-sm font-normal text-muted-foreground">/{displayData.totalBadges}</span></span>, sub: null, progress: displayData.totalBadges > 0 ? (displayData.unlockedBadges / displayData.totalBadges) * 100 : 0, key: 'badges' },
            { label: 'Skor', icon: Brain, chip: 'chip-emerald', value: <CountUpNumber value={displayData.productivityScore} suffix="%" />, sub: null, progress: displayData.productivityScore, key: 'productivity' },
            { label: 'Target', icon: Flag, chip: 'chip-sky', value: <CountUpNumber value={displayData.goalProgress} suffix="%" />, sub: null, progress: displayData.goalProgress, key: 'goals', nav: () => setActiveTab('goals'), navLabel: 'Buka tab target untuk melihat progres goal' },
            { label: 'Mood', icon: Smile, chip: 'chip-rose', value: <span className="flex items-center gap-2"><span className="anim-micro-pulse"><MoodEmoji mood={displayData.moodAverage} /></span><span className="text-lg font-bold">{getMoodLabel(displayData.moodAverage)}</span></span>, sub: null, key: 'mood', nav: () => setActiveTab('tracker'), navLabel: 'Buka tab tracker untuk melihat log mood' },
            { label: 'Tidur', icon: Moon, chip: 'chip-violet', value: <CountUpNumber value={Number(displayData.sleepAverage) || 0} />, sub: 'jam / malam', key: 'sleep', nav: () => setActiveTab('tracker'), navLabel: 'Buka tab tracker untuk melihat log tidur' },
          ].map((card, i) => {
            const Icon = card.icon;
            // Hide non-essential KPI cards on mobile (< 640px) to reduce
            // cognitive overload. → 6 on mobile.
            // Hidden: longest, success, weekly, monthly, level, badges,
            // productivity, goals.
            // Visible: habits, completion, streak, xp, mood, sleep.
            // NOTE: kartu "Tantangan" (challengeProgress) dihapus — API tidak
            // pernah mengirim field itu (fitur belum ada di backend), jadi
            // kartunya selalu menampilkan "%" tanpa angka (tampak rusak).
            const MOBILE_HIDDEN = new Set(['longest', 'success', 'weekly', 'monthly', 'level', 'badges', 'productivity', 'goals']);
            const isHiddenOnMobile = MOBILE_HIDDEN.has(card.key);
            // KPI body shared by both the interactive <button> and the
            // static <div> variants below.
            const kpiBody = (
              <>
                <div className="flex items-center gap-2.5">
                  <span className={cn('chip-icon h-9 w-9', card.chip)}>
                    <Icon className={cn('h-4.5 w-4.5', card.iconClass)} />
                  </span>
                  <span className="premium-label min-w-0 leading-tight">{card.label}</span>
                </div>
                <div className="premium-stat mt-3 text-xl sm:text-2xl">{card.value}</div>
                {card.progress !== undefined && (
                  <div className="mt-2 flex items-center gap-1">
                    <Progress value={card.progress} className="h-1.5 flex-1" />
                    {card.progressLabel && <span className="text-xs text-muted-foreground">{card.progressLabel}</span>}
                  </div>
                )}
                {card.sub && <p className="mt-1.5 text-xs text-muted-foreground">{card.sub}</p>}
              </>
            );
            // ONE-CLICK (4-a): KPIs whose data lives in another tab become
            // real <button>s (keyboard focusable) with premium-card-hover
            // lift + an ArrowUpRight affordance that fades in on hover.
            if (card.nav) {
              return (
                <button
                  type="button"
                  key={card.key}
                  onClick={card.nav}
                  aria-label={card.navLabel}
                  className={cn(
                    'premium-card premium-card-sheen premium-card-hover anim-stagger group relative cursor-pointer rounded-2xl p-4 text-left',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                    isHiddenOnMobile && 'hidden sm:block'
                  )}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <ArrowUpRight
                    className="absolute right-3 top-3 h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                    aria-hidden="true"
                  />
                  {kpiBody}
                </button>
              );
            }
            return (
              <div
                key={card.key}
                className={cn('premium-card premium-card-sheen anim-stagger rounded-2xl p-4', isHiddenOnMobile && 'hidden sm:block')}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {kpiBody}
              </div>
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
        <div className="premium-card premium-card-sheen rounded-2xl p-5">
          <h3 className="premium-label mb-5 flex items-center gap-2">
            Ringkasan Progres
            <ChartInfo text="Persentase hari yang berhasil menyelesaikan minimal 1 habit dari total hari dalam periode yang dipilih." />
          </h3>
          <div className="flex items-center justify-around flex-wrap gap-6">
            <div className="relative">
              <ProgressRing value={displayData.completionRate} size={110} strokeWidth={10} color="stroke-primary" label="Keseluruhan" />
            </div>
            <div className="relative">
              <ProgressRing value={displayData.weeklyCompletion} size={110} strokeWidth={10} color="stroke-primary" label="Minggu Ini" />
            </div>
            <div className="relative">
              <ProgressRing value={displayData.monthlyCompletion} size={110} strokeWidth={10} color="stroke-teal-500" label="Bulan Ini" />
            </div>
          </div>
        </div>
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
        <HourlyConsistency key={hourlyPeriodDays} periodDays={hourlyPeriodDays} />
      </ScrollReveal>

      {/* ── Time-Tracked Habits (Waktu Habit Minggu Ini) ────────────── */}
      <TimeTrackedHabits data={displayData.timeTrackedSummary} primaryColor={primaryColor} />

      {/* ── Last Done (Terakhir Dilakukan) ─────────────────────────── */}
      <LastDoneSummaryCard data={displayData.lastDoneSummary} />

      {/* ── Bottom Row: Leaderboard + Today's Focus ─────────────── */}
      <section aria-label="Details" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="premium-card premium-card-sheen rounded-2xl p-5">
          <h3 className="premium-label mb-4 flex items-center gap-2">
            Peringkat Habit
            <ChartInfo text="Peringkat habit berdasarkan jumlah hari diselesaikan dalam periode yang dipilih. Streak dihitung dari hari terakhir sekarang ke belakang berturut-turut." />
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {/* ONE-CLICK (bugfix 6-a): the tiles previously showed an
                ArrowUpRight affordance but were static divs. Now they are
                real buttons that deep-link to the habit's TimeAnalysisDialog
                via openHabitFocus(id) — the id is carried by
                /api/dashboard's bestHabit/worstHabit (additive field).
                Falls back to a static div when no id (zero-habit "N/A"). */}
            {bestHabitId ? (
              <button
                type="button"
                onClick={() => openHabitFocus(bestHabitId)}
                aria-label={`Lihat analisis waktu habit ${displayData.bestHabit.name} (performa terbaik)`}
                className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-primary/15 bg-primary/5 p-4 text-center transition-colors hover:border-primary/30 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 dark:border-primary/20 dark:bg-primary/10"
              >
                <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                  <ArrowUpRight className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                  Performa Terbaik
                </div>
                <span className="chip-soft chip-soft-teal h-11 w-11 text-xl" aria-hidden="true">{displayData.bestHabit.icon}</span>
                <span className="text-sm font-semibold leading-tight">{displayData.bestHabit.name}</span>
                <span className="premium-stat text-xl text-primary">{displayData.bestHabit.rate}%</span>
                <Crown className="h-4 w-4 text-amber-500" aria-hidden="true" />
              </button>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-primary/15 bg-primary/5 p-4 text-center dark:border-primary/20 dark:bg-primary/10">
                <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                  <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                  Performa Terbaik
                </div>
                <span className="chip-soft chip-soft-teal h-11 w-11 text-xl" aria-hidden="true">{displayData.bestHabit.icon}</span>
                <span className="text-sm font-semibold leading-tight">{displayData.bestHabit.name}</span>
                <span className="premium-stat text-xl text-primary">{displayData.bestHabit.rate}%</span>
                <Crown className="h-4 w-4 text-amber-500" aria-hidden="true" />
              </div>
            )}
            {worstHabitId ? (
              <button
                type="button"
                onClick={() => openHabitFocus(worstHabitId)}
                aria-label={`Lihat analisis waktu habit ${displayData.worstHabit.name} (perlu perhatian)`}
                className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 text-center transition-colors hover:border-orange-500/40 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 dark:border-orange-400/20 dark:bg-orange-400/10"
              >
                <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-orange-600 dark:text-orange-400">
                  <ArrowDownRight className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                  Perlu Perhatian
                </div>
                <span className="chip-soft chip-soft-amber h-11 w-11 text-xl" aria-hidden="true">{displayData.worstHabit.icon}</span>
                <span className="text-sm font-semibold leading-tight">{displayData.worstHabit.name}</span>
                <span className="premium-stat text-xl text-orange-600 dark:text-orange-400">{displayData.worstHabit.rate}%</span>
                <AlertTriangle className="h-4 w-4 text-orange-500" aria-hidden="true" />
              </button>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 text-center dark:border-orange-400/20 dark:bg-orange-400/10">
                <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-orange-600 dark:text-orange-400">
                  <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
                  Perlu Perhatian
                </div>
                <span className="chip-soft chip-soft-amber h-11 w-11 text-xl" aria-hidden="true">{displayData.worstHabit.icon}</span>
                <span className="text-sm font-semibold leading-tight">{displayData.worstHabit.name}</span>
                <span className="premium-stat text-xl text-orange-600 dark:text-orange-400">{displayData.worstHabit.rate}%</span>
                <AlertTriangle className="h-4 w-4 text-orange-500" aria-hidden="true" />
              </div>
            )}
          </div>
        </div>

        <div className="premium-card premium-card-sheen rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="premium-label flex items-center gap-2">
              Fokus Hari Ini
              <ChartInfo text="Menampilkan daftar habit yang belum diselesaikan hari ini. Urut berdasarkan prioritas." />
            </h3>
            <Badge variant="secondary" className="text-xs">
              {displayData.todayFocus.length} tersisa
            </Badge>
          </div>
          {displayData.todayFocus.length === 0 ? (
            <div className="premium-empty">
              <div className="premium-empty-orb">
                <CheckCircle className="h-8 w-8 text-primary" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium">Semua selesai untuk hari ini! 🎉</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {displayData.todayFocus.map((habit) => (
                <div key={habit.id} className="group/row flex items-center gap-1.5">
                  {/* ONE-CLICK (4-a): row main click → jump to the tracker grid
                      (today preselected) so the user can complete it right away. */}
                  <button
                    type="button"
                    onClick={() => openTrackerDate(todayStr)}
                    aria-label={`Buka tracker hari ini untuk menyelesaikan habit ${habit.name}`}
                    className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/70 p-2.5 text-left transition-colors hover:border-primary/30 hover:bg-muted/50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="chip-soft chip-soft-teal h-9 w-9 shrink-0 text-base" aria-hidden="true">{habit.icon}</span>
                      <span className="text-sm font-medium truncate">{habit.name}</span>
                    </div>
                    <Badge variant={priorityVariant(habit.priority)} className="shrink-0 text-xs">
                      {habit.priority}
                    </Badge>
                  </button>
                  {/* ONE-CLICK (4-a): icon-button → openHabitFocus(id) opens this
                      habit's TimeAnalysisDialog on the tracker tab. Subtle on
                      mobile (always visible), fades in on row hover on desktop. */}
                  <button
                    type="button"
                    onClick={() => openHabitFocus(habit.id)}
                    aria-label={`Lihat analisis waktu habit ${habit.name}`}
                    className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus-visible:opacity-100"
                  >
                    <BarChart3 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Keuangan Bulan Ini ────────────────────────────────────────── */}
      <FinanceOverviewCard data={displayData.financeOverview} />

      {/* ── Per-Habit Performance Table ───────────────────────────────── */}
      {displayData.habitDetailStats.length > 0 && (
        <section aria-label="Habit details">
          <div className="premium-card premium-card-sheen rounded-2xl p-5">
            <h3 className="premium-label mb-4 flex items-center gap-2">
              Performa Per Habit
              <ChartInfo text="Detail statistik per habit termasuk jumlah hari selesai, completion rate, dan streak terkini dalam periode yang dipilih." />
            </h3>
            <div className="max-h-80 overflow-y-auto pr-1">
              <div className="space-y-2">
                {displayData.habitDetailStats.map((habit) => (
                  <button
                    key={habit.id}
                    type="button"
                    onClick={() => openHabitFocus(habit.id)}
                    aria-label={`Lihat analisis waktu habit ${habit.name}`}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border/70 p-3 text-left transition-colors hover:border-primary/30 hover:bg-muted/50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    <span className="chip-soft chip-soft-teal h-10 w-10 shrink-0 text-lg" aria-hidden="true">{habit.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">{habit.name}</span>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {habit.streak > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-orange-500">
                              <Flame className="h-3 w-3" aria-hidden="true" />{habit.streak}
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
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Quick Insights ──────────────────────────────────────── */}
      {insights.length > 0 && (
        <section aria-label="Quick insights">
          <div className="mb-3 flex items-center gap-2">
            <span className="chip-soft chip-soft-violet h-7 w-7" aria-hidden="true">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <h3 className="premium-label flex items-center gap-2">
              Insight Cepat
              <ChartInfo text="Analisis otomatis berdasarkan data habit 30 hari terakhir. Dibandingkan dengan periode sebelumnya." />
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insights.map((insight, i) => (
              <div
                key={i}
                className="premium-card premium-card-sheen rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">{insight.icon}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{insight.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
