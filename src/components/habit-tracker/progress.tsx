'use client';

// components/habit-tracker/progress.tsx — TASK 45 "PROGRES" (tab baru).
//
// DESTRUCTIVE REDESIGN: seluruh analitik "Perjalananmu" (13 KPI, cincin,
// 5 chart, heatmap jam, tabel per-habit, insight, overview keuangan)
// DIPINDAHKAN dari Beranda ke tab sendiri. Brief: "Jangan memasukkan
// seluruh analytics ke Home" — Beranda kini murni perjalanan emosional
// hari ini (FEEL→DO→REWARD→REFLECT), angka jangka panjang hidup di sini.
//
// Query memakai key yang SAMA dengan Beranda (['dashboard', period,
// refreshKey, retryCount]) → cache terbagih: buka Progres setelah Beranda
// tidak memicu fetch ulang. Seluruh kartu/KPI dipindah TANPA perubahan
// logika — murni komposisi ulang (business logic & kontrak API utuh).

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/app-store';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { CountUpNumber } from '@/components/habit-tracker/count-up';
import { ScrollReveal } from '@/components/habit-tracker/scroll-reveal';
import { toDashboardData } from '@/lib/dashboard/contract';
import { jakartaDateString } from '@/lib/jakarta-date';
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
  Activity,
  ArrowUpRight,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Calendar,
  LineChart,
} from 'lucide-react';
import { type Period, PERIOD_OPTIONS } from './dashboard-types';
import { DEFAULT_DATA } from './dashboard-default-data';
import {
  ChartInfo,
  ProgressRing,
  MoodEmoji,
  EnergyEmoji,
  getMoodLabel,
  getEnergyLabel,
  PeriodFilter,
  BestWorstTile,
} from './dashboard-helpers';
import { TimeTrackedHabits } from './dashboard-time-tracked-habits';
import { LastDoneSummaryCard } from './dashboard-last-done';
import { FinanceOverviewCard } from './dashboard-finance-overview';

const DashboardCharts = dynamic(() => import('./dashboard-charts'));
const HourlyConsistency = dynamic(() => import('./hourly-consistency'));

// Catatan penamaan: default export sengaja `ProgressTab` — `Progress`
// bentrok dengan komponen <Progress> shadcn yang dipakai KPI grid.
export default function ProgressTab() {
  const refreshKey = useAppStore(s => s.refreshKey);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const openHabitFocus = useAppStore((s) => s.openHabitFocus);
  // CONNECTED-APP: periode diangkat ke store — bertahan saat pindah tab,
  // dan KPI "7/30 Hari" kini bisa memfilter halaman ini sendiri.
  const period = useAppStore((s) => s.progressPeriod) as Period;
  const setPeriod = useAppStore((s) => s.setProgressPeriod) as (p: Period) => void;
  const openTrackerDate = useAppStore((s) => s.openTrackerDate);
  const openTrackerHistory = useAppStore((s) => s.openTrackerHistory);
  const setSettingsSection = useAppStore((s) => s.setSettingsSection);
  const [retryCount, setRetryCount] = useState(0);
  const todayStr = jakartaDateString();

  // Query key IDENTIK dengan Beranda — cache terbagih antar tab.
  const { data: data, isFetching: fetching, isError: fetchError } = useQuery({
    queryKey: ['dashboard', period, refreshKey, retryCount],
    queryFn: async () => {
      const periodParam = period === '7d' ? '7' : period === '1m' ? '30' : period === '3m' ? '90' : 'all';
      const res = await fetch(`/api/dashboard?period=${periodParam}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      return toDashboardData(json, period);
    },
    retry: 1,
  });

  const loading = data === undefined && !fetchError;

  // CONNECTED-APP — insight tidak berhenti sebagai teks: tiap insight
  // membawa AKSI menuju konteks yang menghasilkan angkanya (brief #11:
  // observation + context + action).
  const insights = useMemo(() => {
    if (!data) return [];
    const items: {
      icon: React.ReactNode;
      text: string;
      type: 'success' | 'info' | 'warning';
      action?: { label: string; run: () => void };
    }[] = [];

    if (data.currentStreak >= 7) {
      items.push({
        icon: <span className="chip-soft chip-soft-amber h-8 w-8"><Flame className="h-4 w-4" /></span>,
        text: `Streak ${data.currentStreak} hari berjalan — terus pertahankan!`,
        type: 'success',
        action: { label: 'Lihat riwayat', run: () => openTrackerHistory(todayStr.slice(0, 7)) },
      });
    } else if (data.currentStreak >= 3) {
      items.push({
        icon: <span className="chip-soft chip-soft-amber h-8 w-8"><Flame className="h-4 w-4" /></span>,
        text: `Streak ${data.currentStreak} hari — momentum mulai terbentuk!`,
        type: 'info',
        action: { label: 'Lihat riwayat', run: () => openTrackerHistory(todayStr.slice(0, 7)) },
      });
    }

    if (data.weeklyChartData.length > 0) {
      const bestDay = data.weeklyChartData.reduce((best, d) => (d.rate > best.rate ? d : best), data.weeklyChartData[0]);
      items.push({
        icon: <span className="chip-soft chip-soft-teal h-8 w-8"><Trophy className="h-4 w-4" /></span>,
        text: `Hari terbaik minggu ini: ${bestDay.day} (${bestDay.rate}%).`,
        type: 'info',
        action: { label: `Buka ${bestDay.day}`, run: () => openTrackerDate(bestDay.date) },
      });
    }

    if (data.completionRate >= 80) {
      items.push({
        icon: <span className="chip-soft chip-soft-teal h-8 w-8"><Star className="h-4 w-4" /></span>,
        text: 'Luar biasa! Tingkat penyelesaianmu di atas 80%.',
        type: 'success',
        action: { label: 'Lihat riwayat', run: () => openTrackerHistory(todayStr.slice(0, 7)) },
      });
    } else if (data.completionRate < 50 && data.totalHabits > 0) {
      items.push({
        icon: <span className="chip-soft chip-soft-rose h-8 w-8"><AlertTriangle className="h-4 w-4" /></span>,
        text: 'Tingkat penyelesaikanmu di bawah 50%. Coba kurangi jumlah habit.',
        type: 'warning',
        action: {
          label: 'Kelola habit',
          run: () => {
            setSettingsSection('habits');
            setActiveTab('settings');
          },
        },
      });
    }

    if (data.productivityScore >= 80) {
      items.push({
        icon: <span className="chip-soft chip-soft-violet h-8 w-8"><Brain className="h-4 w-4" /></span>,
        text: `Skor produktivitas tinggi: ${data.productivityScore}%!`,
        type: 'success',
        // VERIFY-48 (48-c F4a): insight tanpa aksi = teks mati — skor
        // produktivitas berasal dari riwayat penyelesaian.
        action: { label: 'Lihat riwayat', run: () => openTrackerHistory(todayStr.slice(0, 7)) },
      });
    }

    return items.slice(0, 3);
  }, [data, openTrackerDate, openTrackerHistory, setActiveTab, setSettingsSection, todayStr]);

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
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-10 w-64 rounded-full" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 13 }).map((_, i) => (
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
  const weeklyBarData = displayData.weeklyChartData.map((d) => ({
    ...d,
    label: d.day.slice(0, 3),
  }));

  return (
    <div className="app-ambience relative mx-auto max-w-6xl space-y-6">
      {/* Header — nada reflektif (GROW), bukan rasa laporan. */}
      <PageHeader
        title="Progres"
        subtitle="Lihat bagaimana konsistensimu tumbuh dari waktu ke waktu."
        icon={LineChart}
        eyebrow="Perjalananmu"
      />

      {fetchError && !fetching && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">Gagal memuat data terbaru</p>
          <Button variant="outline" size="sm" onClick={() => setRetryCount((c) => c + 1)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Coba Lagi
          </Button>
        </div>
      )}

      {/* ── Period Filter ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="premium-label">Periode</span>
        <PeriodFilter period={period} onPeriodChange={setPeriod} />
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
            { label: 'Total Habit', icon: Target, chip: 'chip-teal', numeric: true, value: <CountUpNumber value={displayData.totalHabits} />, sub: displayData.graduatedCount > 0 ? `${displayData.graduatedCount} habit lulus` : 'habit aktif', key: 'habits', nav: () => setActiveTab('tracker'), navLabel: 'Buka tab tracker untuk melihat semua habit' },
            { label: 'Tingkat Selesai', icon: CheckCircle, chip: 'chip-emerald', numeric: true, value: <CountUpNumber value={displayData.completionRate} suffix="%" />, sub: null, progress: displayData.completionRate, key: 'completion' },
            { label: 'Streak Aktif', icon: Flame, chip: 'chip-orange', iconClass: displayData.currentStreak >= 7 ? 'anim-flame-pulse' : '', numeric: true, value: <CountUpNumber value={displayData.currentStreak} />, sub: 'hari', key: 'streak', nav: () => openTrackerHistory(todayStr.slice(0, 7)), navLabel: 'Lihat riwayat kalender — sumber streak' },
            { label: 'Rekor Streak', icon: Trophy, chip: 'chip-amber', numeric: true, value: <CountUpNumber value={displayData.longestStreak} />, sub: 'hari', key: 'longest', nav: () => openTrackerHistory(todayStr.slice(0, 7)), navLabel: 'Lihat riwayat kalender — sumber rekor streak' },
            { label: 'Hari Ini', icon: Zap, chip: 'chip-lime', numeric: true, value: <CountUpNumber value={displayData.successToday} suffix="%" />, sub: null, progress: displayData.successToday, key: 'success', nav: () => openTrackerDate(todayStr), navLabel: 'Buka tracker hari ini' },
            { label: '7 Hari', icon: CalendarDays, chip: 'chip-sky', numeric: true, value: <CountUpNumber value={displayData.weeklyCompletion} suffix="%" />, sub: null, progress: displayData.weeklyCompletion, key: 'weekly', nav: () => setPeriod('7d'), navLabel: 'Filter seluruh halaman ke periode 7 hari' },
            { label: '30 Hari', icon: TrendingUp, chip: 'chip-teal', numeric: true, value: <CountUpNumber value={displayData.monthlyCompletion} suffix="%" />, sub: null, progress: displayData.monthlyCompletion, key: 'monthly', nav: () => setPeriod('1m'), navLabel: 'Filter seluruh halaman ke periode 30 hari' },
            { label: 'Total XP', icon: Star, chip: 'chip-amber', numeric: true, value: <CountUpNumber value={displayData.totalXP} />, sub: `Level ${displayData.currentLevel}`, key: 'xp' },
            { label: 'Level', icon: Award, chip: 'chip-violet', numeric: true, value: <CountUpNumber value={displayData.currentLevel} />, sub: null, progress: displayData.levelProgress, progressLabel: `${Math.round(displayData.levelProgress)}%`, key: 'level' },
            { label: 'Skor', icon: Brain, chip: 'chip-emerald', numeric: true, value: <CountUpNumber value={displayData.productivityScore} suffix="%" />, sub: null, progress: displayData.productivityScore, key: 'productivity' },
            { label: 'Mood', icon: Smile, chip: 'chip-rose', value: <span className="flex min-w-0 items-center gap-2"><span className="anim-micro-pulse shrink-0"><MoodEmoji mood={displayData.moodAverage} /></span><span className="truncate text-lg font-bold">{getMoodLabel(displayData.moodAverage)}</span></span>, sub: null, key: 'mood', nav: () => openTrackerHistory(todayStr.slice(0, 7)), navLabel: 'Lihat riwayat mood di kalender' },
            { label: 'Tidur', icon: Moon, chip: 'chip-violet', value: displayData.sleepAverage != null ? <CountUpNumber value={displayData.sleepAverage} decimals={1} /> : <span aria-label="Belum ada data">—</span>, sub: displayData.sleepAverage != null ? 'jam / malam' : 'belum ada data', key: 'sleep', nav: () => openTrackerHistory(todayStr.slice(0, 7)), navLabel: 'Lihat riwayat tidur di kalender' },
            { label: 'Energi', icon: Activity, chip: 'chip-slate', value: <span className="flex min-w-0 items-center gap-2"><span className="anim-micro-pulse shrink-0"><EnergyEmoji energy={displayData.energyAverage} className="text-xl" /></span><span className="truncate text-lg font-bold">{getEnergyLabel(displayData.energyAverage)}</span></span>, sub: null, key: 'energy', nav: () => openTrackerHistory(todayStr.slice(0, 7)), navLabel: 'Lihat riwayat energi di kalender' },
          ].map((card, i) => {
            const Icon = card.icon;
            // Di Progres (bukan Beranda) semua KPI tampil — layar analytics
            // memang untuk melihat keseluruhan; mobile punya scroll sendiri.
            const kpiBody = (
              <>
                <div className="flex items-center gap-2.5">
                  <span className={cn('chip-icon h-9 w-9', card.chip)}>
                    <Icon className={cn('h-4.5 w-4.5', card.iconClass)} />
                  </span>
                  <span className="premium-label min-w-0 leading-tight">{card.label}</span>
                </div>
                <div className={cn('premium-stat mt-3 text-2xl sm:text-[1.7rem]', card.numeric && 'premium-stat-grad')}>{card.value}</div>
                {card.progress !== undefined && (
                  <div className="mt-2 flex items-center gap-1">
                    <Progress value={card.progress} className="premium-progress h-1.5 flex-1" />
                    {card.progressLabel && <span className="text-xs text-muted-foreground">{card.progressLabel}</span>}
                  </div>
                )}
                {card.sub && <p className="mt-1.5 text-xs text-muted-foreground">{card.sub}</p>}
              </>
            );
            if (card.nav) {
              return (
                <button
                  type="button"
                  key={card.key}
                  onClick={card.nav}
                  aria-label={card.navLabel}
                  className={cn(
                    'premium-card-quiet anim-stagger group relative cursor-pointer rounded-2xl p-4 text-left',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60'
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
                className="premium-card-quiet anim-stagger rounded-2xl p-4"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {kpiBody}
              </div>
            );
          })}
        </div>
      </section>

      <ScrollReveal>
      <section aria-label="Progress overview">
        <div className="premium-card-quiet rounded-2xl p-5">
          <h3 className="premium-label mb-5 flex items-center gap-2">
            Ringkasan Progres
            <ChartInfo text="Persentase hari yang berhasil menyelesaikan minimal 1 habit dari total hari dalam periode yang dipilih. Cincin 'Minggu Ini' dan 'Bulan Ini' dihitung dari minggu/bulan kalender berjalan." />
          </h3>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <div className="relative">
              <ProgressRing value={displayData.completionRate} size={110} strokeWidth={10} color="stroke-primary" label="Keseluruhan" />
            </div>
            <div className="relative">
              <ProgressRing value={displayData.weekToDateRate} size={110} strokeWidth={10} color="stroke-primary" label="Minggu Ini" />
            </div>
            <div className="relative">
              <ProgressRing value={displayData.monthToDateRate} size={110} strokeWidth={10} color="stroke-teal-500" label="Bulan Ini" />
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
        chartUnit={displayData.chartUnit}
      />
      </ScrollReveal>

      <ScrollReveal delay={150}>
        <HourlyConsistency
          periodDays={
            period === '7d' ? 7 :
            period === '1m' ? 30 :
            period === '3m' ? 90 : 365
          }
        />
      </ScrollReveal>

      <TimeTrackedHabits data={displayData.timeTrackedSummary} />

      <LastDoneSummaryCard data={displayData.lastDoneSummary} />

      <section aria-label="Peringkat habit">
        <div className="premium-card-quiet rounded-2xl p-5">
          <h3 className="premium-label mb-4 flex items-center gap-2">
            Peringkat Habit
            <ChartInfo text="Peringkat habit berdasarkan jumlah hari diselesaikan dalam periode yang dipilih. Streak dihitung dari hari terakhir sekarang ke belakang berturut-turut." />
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <BestWorstTile habit={displayData.bestHabit} tone="best" onOpen={openHabitFocus} />
            <BestWorstTile habit={displayData.worstHabit} tone="worst" onOpen={openHabitFocus} />
          </div>
        </div>
      </section>

      <FinanceOverviewCard data={displayData.financeOverview} />

      {displayData.habitDetailStats.length > 0 && (
        <section aria-label="Habit details">
          <div className="premium-card-quiet rounded-2xl p-5">
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
                        <Progress value={habit.rate} className="premium-progress h-1.5 flex-1" />
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
            {insights.map((insight, i) =>
              insight.action ? (
                <button
                  key={i}
                  type="button"
                  onClick={insight.action.run}
                  aria-label={`${insight.text} — ${insight.action.label}`}
                  className="group premium-card-quiet relative cursor-pointer rounded-xl p-4 text-left transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">{insight.icon}</div>
                    <p className="flex-1 text-sm text-muted-foreground leading-relaxed">{insight.text}</p>
                    <ArrowUpRight
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                      aria-hidden="true"
                    />
                  </div>
                  <span className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold text-primary">
                    {insight.action.label}
                    <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                  </span>
                </button>
              ) : (
                <div
                  key={i}
                  className="premium-card-quiet rounded-xl p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">{insight.icon}</div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{insight.text}</p>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}
