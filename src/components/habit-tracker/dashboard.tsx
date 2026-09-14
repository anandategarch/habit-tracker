'use client';

// components/habit-tracker/dashboard.tsx — TASK 45 "TODAY" (destructive v2).
//
// DESTRUCTIVE REDESIGN: Beranda dibongkar lagi setelah Task 44. Seluruh
// analitik "Perjalananmu" (13 KPI, cincin, 5 chart, heatmap, tabel
// per-habit, insight, overview keuangan) DIPINDAH ke tab PROGRES baru
// (progress.tsx) — brief: "Jangan memasukkan seluruh analytics ke Home".
//
// Beranda kini murni siklus hari ini — FEEL → DO → REWARD → REFLECT → GROW:
//   ① FEEL    TodayHero — sapaan personal + pohon + progres + streak/level
//   ② DO      Rutinitas Hari Ini — pending dulu, done dirayakan
//   ③ REFLECT Check-in Harian — percakapan mood/energi/tidur
//   ④ REFLECT Quote — pengingat pribadi (serif Fraunces)
//   ⑤ GROW    Tinjauan Mingguan — momentum
//   ⑥ GROW    Kartu "Sekilas Perjalananmu" — jendela mungil ke tab Progres
//             (streak + tingkat selesai + CTA), BUKAN 12 kartu analytics.
//
// GreetingHero (pra-Task 44) & zona analytics Task 44 dihapus dari file ini.
// Logika data (query /api/dashboard, kontrak, check-in FIFO) TIDAK berubah.

import { useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/app-store';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowRight, Flame, RefreshCw } from 'lucide-react';
import { ScrollReveal } from '@/components/habit-tracker/scroll-reveal';
import { WeeklyReview } from '@/components/habit-tracker/weekly-review';
import { toDashboardData } from '@/lib/dashboard/contract';
import { jakartaDateString } from '@/lib/jakarta-date';
import { type MotivationalQuote } from './dashboard-types';
import { DEFAULT_DATA } from './dashboard-default-data';
import { QuoteDisplay } from './dashboard-helpers';
import { TodayHero } from './today-hero';
import { TodayHabitsCard } from './today-habits';
import { DailyCheckInCard } from './daily-check-in-card';

/** Payload ringan GET /api/daily-logs?date= untuk kartu check-in Beranda. */
type DailyLogPayloadLite = { date?: string; mood?: number; energy?: number; sleep?: number } | null;

export default function Dashboard() {
  const refreshKey = useAppStore(s => s.refreshKey);
  // Deep-link 1-klik (pola lama teruji): baris habit → tracker / analisis.
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const openHabitFocus = useAppStore((s) => s.openHabitFocus);
  const openTrackerDate = useAppStore((s) => s.openTrackerDate);
  // Jalur CTA empty-state — sama dengan FAB "Habit Baru".
  const triggerQuickAdd = useAppStore((s) => s.triggerQuickAdd);
  const todayStr = jakartaDateString();
  const [retryCount, setRetryCount] = useState(0);
  // Tick kutipan — queryKey berganti tiap klik "Ganti kutipan" sehingga
  // fetch baru membawa ?refresh=1&exclude=<teks sekarang> (non-repeat).
  const [quoteTick, setQuoteTick] = useState(0);
  const currentQuoteTextRef = useRef<string | null>(null);

  // ── Dashboard data (TanStack Query) ────────────────────────────────────
  // Period tetap 'all' (Beranda hanya butuh data today + streak). QueryKey
  // SAMA dengan default tab Progres → cache terbagih antar tab.
  const { data: data, isFetching: fetching, isError: fetchError } = useQuery({
    queryKey: ['dashboard', 'all', refreshKey, retryCount],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard?period=all`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      return toDashboardData(json, 'all');
    },
    retry: 1,
  });

  // ── Motivational quote (TanStack Query) ────────────────────────────────
  const { data: quoteData, isLoading: quoteLoading } = useQuery<{
    text?: string;
    author?: string;
  }>({
    queryKey: ['motivational-quote', quoteTick],
    queryFn: async ({ queryKey }) => {
      const tick = (queryKey as [string, number])[1] ?? 0;
      const exclude = tick > 0 ? currentQuoteTextRef.current ?? '' : '';
      const url =
        tick > 0 && exclude
          ? `/api/motivational-quote?refresh=1&exclude=${encodeURIComponent(exclude)}`
          : '/api/motivational-quote';
      const r = await fetch(url);
      const json = await r.json();
      if (typeof json?.text === 'string' && json.text) currentQuoteTextRef.current = json.text;
      return json;
    },
    staleTime: Infinity,
  });

  // ── Check-in harian — nilai mood/energi/tidur HARI INI. Key SAMA dengan
  // tracker (['daily-logs', tanggal]) → cache terbagih antar tab.
  const { data: dailyLogData } = useQuery<DailyLogPayloadLite>({
    queryKey: ['daily-logs', todayStr],
    queryFn: async () => {
      const res = await fetch(`/api/daily-logs?date=${todayStr}`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 15_000,
  });
  // Gate tanggal (anti stale keepPreviousData).
  const checkInValue = useMemo(() => {
    if (!dailyLogData) return null;
    const dataDate = dailyLogData.date?.slice(0, 10);
    if (dataDate && dataDate !== todayStr) return null;
    return {
      mood: dailyLogData.mood ?? 3,
      energy: dailyLogData.energy ?? 3,
      sleep: dailyLogData.sleep ?? 7,
    };
  }, [dailyLogData, todayStr]);

  const quote: MotivationalQuote | null = quoteData?.text
    ? { quote: quoteData.text, translation: '', author: quoteData.author || '' }
    : null;

  const loading = data === undefined && !fetchError;

  const handleRefreshQuote = () => {
    setQuoteTick((t) => t + 1);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton = urutan journey hari ini (hero, habits, check-in, quote) */}
        <Skeleton className="h-[228px] w-full rounded-3xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  const displayData = data || DEFAULT_DATA;

  return (
    <div className="app-ambience relative space-y-6">
      {/* ① FEEL — Today Hero (sapaan personal + pohon + progres + streak) */}
      <TodayHero
        userName={displayData.userName}
        completed={displayData.todayCompletedCount}
        total={displayData.todayTotalCount}
        currentStreak={displayData.currentStreak}
        level={displayData.currentLevel}
        levelProgress={displayData.levelProgress}
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

      {/* ② DO — Rutinitas Hari Ini (pending dulu, done dirayakan) */}
      <TodayHabitsCard
        habits={displayData.todayHabits}
        todayStr={todayStr}
        onOpenTracker={openTrackerDate}
        onOpenHabit={openHabitFocus}
        onAddHabit={() => {
          triggerQuickAdd('habit');
          setActiveTab('settings');
        }}
      />

      {/* ③ REFLECT — Check-in Harian (percakapan, mood/energi/tidur) */}
      <DailyCheckInCard
        key={`${todayStr}|${checkInValue ? 'row' : 'none'}`}
        date={todayStr}
        value={checkInValue}
      />

      {/* ④ REFLECT — Quote (pengingat pribadi, serif Fraunces) */}
      <div className="premium-quote">
        <div className="relative z-10 p-4 sm:p-5">
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

      {/* ⑤ GROW — Tinjauan Mingguan (momentum) */}
      <ScrollReveal>
        <WeeklyReview />
      </ScrollReveal>

      {/* ⑥ GROW — Sekilas Perjalananmu: jendela mungil ke tab Progres.
            Pengganti 12+ kartu analytics lama di Beranda: satu kartu dengan
            tiga benang cerita (streak, konsistensi, level) + CTA. */}
      <ScrollReveal delay={80}>
        <button
          type="button"
          onClick={() => setActiveTab('progress')}
          aria-label="Buka tab Progres untuk melihat perjalanan lengkapmu"
          className="group premium-card premium-card-hover premium-card-sheen relative w-full cursor-pointer rounded-2xl p-4 text-left sm:p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                Sekilas Perjalananmu
              </h3>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
                <span className="flex items-center gap-1.5 font-semibold text-orange-600 dark:text-orange-400">
                  <Flame className="h-4 w-4" aria-hidden="true" />
                  {displayData.currentStreak} hari
                </span>
                <span className="text-muted-foreground">
                  Konsistensi <span className="font-bold text-foreground">{displayData.completionRate}%</span>
                </span>
                <span className="text-muted-foreground">
                  Level <span className="font-bold text-foreground">{displayData.currentLevel}</span>
                </span>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-muted/60 px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
              Lihat perjalananmu
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </div>
        </button>
      </ScrollReveal>
    </div>
  );
}
