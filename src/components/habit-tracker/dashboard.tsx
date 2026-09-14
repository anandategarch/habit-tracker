'use client';

// components/habit-tracker/dashboard.tsx — TASK 45 "TODAY" + CONNECTED-APP
// (Task 47).
//
// Beranda = siklus hari ini — FEEL → DO → REWARD → REFLECT → GROW — dan
// kini setiap elemen pentingnya TERHUBUNG ke konteks lanjutannya:
//   ① FEEL    TodayHero — progres → Tracker hari ini; streak → Riwayat;
//              level → Progres
//   ② DO      Rutinitas Hari Ini — completion 1-TAP langsung dari Beranda
//              (habit biner normal; amount/trackTime/avoid → tracker) +
//              strip "Tugas Hari Ini" (jendela ke Meja Kerja)
//   ③ REFLECT Check-in Harian — tautan riwayat mood (kalender) + jurnal
//   ④ REFLECT Quote
//   ⑤ GROW    Tinjauan Mingguan — CTA "Buka Progres"
//   ⑥ GROW    strip "Keuangan bulan ini" (jendela ke tab Keuangan) +
//              kartu "Sekilas Perjalananmu"
//
// Logika data (query /api/dashboard, kontrak, check-in FIFO) TIDAK berubah;
// mutation completion memakai endpoint yang sama dengan tracker
// (POST /api/habits/{id}/logs) + invalidasi ekosistem penuh.

import { useRef, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowRight, Flame, RefreshCw, Wallet, ClipboardList } from 'lucide-react';
import { ScrollReveal } from '@/components/habit-tracker/scroll-reveal';
import { WeeklyReview } from '@/components/habit-tracker/weekly-review';
import { toDashboardData } from '@/lib/dashboard/contract';
import { jakartaDateString } from '@/lib/jakarta-date';
import { jakartaNowIso } from '@/lib/timezone';
import { xpForHabit } from '@/lib/dashboard-helpers';
import { burstFromElement } from '@/lib/confetti';
import { type MotivationalQuote } from './dashboard-types';
import { DEFAULT_DATA } from './dashboard-default-data';
import { QuoteDisplay } from './dashboard-helpers';
import { TodayHero } from './today-hero';
import { TodayHabitsCard } from './today-habits';
import { DailyCheckInCard } from './daily-check-in-card';

/** Payload ringan GET /api/daily-logs?date= untuk kartu check-in Beranda. */
type DailyLogPayloadLite = { date?: string; mood?: number; energy?: number; sleep?: number } | null;

/** Payload ringan GET /api/work?date= untuk strip tugas hari ini.
 *  Key SAMA dengan useWorkData (['work', date]) → cache terbagih. */
type WorkPayloadLite = {
  tasks?: { id: string; title: string; completedAt?: string | null }[] | null;
} | null;

/** Rp ringkas untuk strip keuangan (tanpa dependency formatRupiah berat). */
const rpLite = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} jt`
    : n >= 1_000
      ? `${Math.round(n / 1_000)} rb`
      : String(n);

export default function Dashboard() {
  const refreshKey = useAppStore(s => s.refreshKey);
  const queryClient = useQueryClient();
  // Deep-link 1-klik (pola lama teruji): baris habit → tracker / analisis.
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const openHabitFocus = useAppStore((s) => s.openHabitFocus);
  const openTrackerDate = useAppStore((s) => s.openTrackerDate);
  const openTrackerHistory = useAppStore((s) => s.openTrackerHistory);
  const openFinanceSubTab = useAppStore((s) => s.openFinanceSubTab);
  // Jalur CTA empty-state — sama dengan FAB "Habit Baru" (kembali ke
  // Beranda setelah simpan via quickAddReturnTab).
  const triggerQuickAdd = useAppStore((s) => s.triggerQuickAdd);
  const todayStr = jakartaDateString();
  const [retryCount, setRetryCount] = useState(0);
  // Tick kutipan — queryKey berganti tiap klik "Ganti kutipan" sehingga
  // fetch baru membawa ?refresh=1&exclude=<teks sekarang> (non-repeat).
  const [quoteTick, setQuoteTick] = useState(0);
  const currentQuoteTextRef = useRef<string | null>(null);

  // ── CONNECTED-APP: completion 1-tap dari Beranda ────────────────────────
  // Overlay optimistik lokal (hidup selama tab Beranda terpasang — tab
  // switch me-remount, jadi tidak pernah bentrok dengan data segar).
  const [doneOverlay, setDoneOverlay] = useState<Record<string, boolean>>({});
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

  const handleCompleteFromHome = async (
    habit: { id: string; name: string; difficulty?: string },
    el: HTMLElement | null,
  ) => {
    if (completingIds.has(habit.id)) return;
    setCompletingIds((p) => new Set(p).add(habit.id));
    setDoneOverlay((p) => ({ ...p, [habit.id]: true }));
    // Haptic ringan (guard — paritas dengan kartu tracker).
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(12);
    }
    try {
      const res = await fetch(`/api/habits/${habit.id}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: todayStr,
          completed: true,
          completedAt: jakartaNowIso(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
      }
      // Ekosistem ikut tahu — kumpulan invalidasi yang sama dengan
      // use-habit-toggle (dashboard, kalender, analisis, insight, heatmap).
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['habit-logs-batch'] });
      queryClient.invalidateQueries({ queryKey: ['daily-logs-month'] });
      queryClient.invalidateQueries({ queryKey: ['time-analysis'] });
      queryClient.invalidateQueries({ queryKey: ['habit-meta'] });
      queryClient.invalidateQueries({ queryKey: ['ai-insights'] });
      queryClient.invalidateQueries({ queryKey: ['hourly-consistency'] });
      const xp = xpForHabit({ difficulty: habit.difficulty ?? 'Medium' });
      toast.success(`Habit selesai! +${xp} XP 🎉`);
      burstFromElement(el, { count: 20 });
    } catch (e) {
      // Rollback overlay optimistik.
      setDoneOverlay((p) => {
        const np = { ...p };
        delete np[habit.id];
        return np;
      });
      toast.error(e instanceof Error ? e.message : 'Gagal menandai habit');
    } finally {
      setCompletingIds((p) => {
        const s = new Set(p);
        s.delete(habit.id);
        return s;
      });
    }
  };

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

  // ── CONNECTED-APP: tugas hari ini (Meja Kerja) — key sama dengan
  // useWorkData supaya cache terbagih; Beranda jadi jendela ke Work.
  const { data: workData } = useQuery<WorkPayloadLite>({
    queryKey: ['work', todayStr],
    queryFn: async () => {
      const res = await fetch(`/api/work?date=${todayStr}`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 30_000,
  });
  const openTasks = useMemo(
    () => (workData?.tasks ?? []).filter((t) => !t.completedAt),
    [workData],
  );

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
  // BUGHUNT-47 (47-e #3): hari yang hanya punya CATATAN (jurnal) tanpa nilai
  // check-in tidak lagi dianggap "sudah check-in" (dulu null → 3/3/7 → kartu
  // penuh + chip "Tersimpan otomatis" padahal belum diisi).
  const checkInValue = useMemo(() => {
    if (!dailyLogData) return null;
    const dataDate = dailyLogData.date?.slice(0, 10);
    if (dataDate && dataDate !== todayStr) return null;
    const hasCheckIn =
      dailyLogData.mood != null || dailyLogData.energy != null || dailyLogData.sleep != null;
    if (!hasCheckIn) return null;
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

  // Merge overlay optimistik → daftar & hitungan hari ini.
  const todayHabits = displayData.todayHabits.map((h) =>
    doneOverlay[h.id] ? { ...h, completed: true } : h,
  );
  const newlyDone = todayHabits.filter(
    (h) => doneOverlay[h.id] && !displayData.todayHabits.find((o) => o.id === h.id)?.completed,
  ).length;
  const todayCompleted = displayData.todayCompletedCount + newlyDone;

  // Strip keuangan — hanya bila ada aktivitas bulan ini (jangan menagih
  // user yang belum memakai fitur keuangan).
  const fin = displayData.financeOverview;
  const showFinanceStrip = fin.monthExpense > 0 || fin.budgetTotal > 0;
  const budgetPct =
    fin.budgetTotal > 0 ? Math.min(999, Math.round((fin.budgetSpent / fin.budgetTotal) * 100)) : 0;
  const budgetOver = fin.budgetTotal > 0 && fin.budgetSpent > fin.budgetTotal;

  return (
    <div className="app-ambience relative space-y-6">
      {/* ① FEEL — Today Hero (sapaan personal + pohon + progres + streak) */}
      <TodayHero
        userName={displayData.userName}
        completed={todayCompleted}
        total={displayData.todayTotalCount}
        currentStreak={displayData.currentStreak}
        level={displayData.currentLevel}
        levelProgress={displayData.levelProgress}
        onOpenToday={() => openTrackerDate(todayStr)}
        onOpenHistory={() => openTrackerHistory(todayStr.slice(0, 7))}
        onOpenProgress={() => setActiveTab('progress')}
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

      {/* ② DO — Rutinitas Hari Ini (completion 1-tap + yang selesai dirayakan) */}
      <TodayHabitsCard
        habits={todayHabits}
        todayStr={todayStr}
        onOpenTracker={openTrackerDate}
        onOpenHabit={openHabitFocus}
        onAddHabit={() => {
          // CONNECTED-APP: bawa asal — setelah habit baru tersimpan, user
          // otomatis kembali ke Beranda (bukan terdampar di Pengaturan).
          triggerQuickAdd('habit', 'dashboard');
          setActiveTab('settings');
        }}
        onCompleteHabit={handleCompleteFromHome}
        completingIds={completingIds}
      />

      {/* ②.5 DO — Tugas Hari Ini (jendela kecil ke Meja Kerja; hanya bila
            ada tugas terbuka — tidak membuat "kartu nol" artifisial). */}
      {openTasks.length > 0 && (
        <ScrollReveal>
          <button
            type="button"
            onClick={() => setActiveTab('work')}
            aria-label={`Buka Meja Kerja — ${openTasks.length} tugas terbuka hari ini`}
            className="group premium-card-quiet relative w-full cursor-pointer rounded-2xl p-4 text-left transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <div className="flex items-center gap-3">
              <span className="chip-soft chip-soft-violet h-9 w-9 shrink-0" aria-hidden="true">
                <ClipboardList className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">Tugas Hari Ini</h3>
                <p className="mt-1 truncate text-[13px] text-muted-foreground">
                  {openTasks.length} tugas terbuka
                  {openTasks[0] ? ` — ${openTasks[0].title}` : ''}
                  {openTasks.length > 1 ? ` +${openTasks.length - 1} lagi` : ''}
                </p>
              </div>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </div>
          </button>
        </ScrollReveal>
      )}

      {/* ③ REFLECT — Check-in Harian (percakapan + jendela riwayat & jurnal) */}
      <DailyCheckInCard
        key={`${todayStr}|${checkInValue ? 'row' : 'none'}`}
        date={todayStr}
        value={checkInValue}
        onOpenJournal={() => openTrackerDate(todayStr)}
        onOpenHistory={() => openTrackerHistory(todayStr.slice(0, 7))}
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

      {/* ⑤ GROW — Tinjauan Mingguan (momentum + CTA ke Progres) */}
      <ScrollReveal>
        <WeeklyReview onOpenProgress={() => setActiveTab('progress')} />
      </ScrollReveal>

      {/* ⑤.5 GROW — Keuangan bulan ini: jendela kecil ke tab Keuangan
            (budget jadi tombol menuju sub-tab Anggaran saat terlampaui). */}
      {showFinanceStrip && (
        <ScrollReveal delay={40}>
          <button
            type="button"
            onClick={() => openFinanceSubTab('overview')}
            aria-label="Buka tab Keuangan"
            className="group premium-card-quiet relative w-full cursor-pointer rounded-2xl p-4 text-left transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <div className="flex items-center gap-3">
              <span className="chip-soft chip-soft-teal h-9 w-9 shrink-0" aria-hidden="true">
                <Wallet className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">Keuangan Bulan Ini</h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                  <span className="text-muted-foreground">
                    Pengeluaran{' '}
                    <span className={cnNum('font-bold', budgetOver ? 'text-rose-600 dark:text-rose-400' : 'text-foreground')}>
                      Rp {rpLite(fin.monthExpense)}
                    </span>
                  </span>
                  {fin.budgetTotal > 0 && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        openFinanceSubTab('budgets');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          openFinanceSubTab('budgets');
                        }
                      }}
                      aria-label={`Buka anggaran — terpakai ${budgetPct}%`}
                      className="cursor-pointer text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-primary"
                    >
                      Anggaran <span className="font-bold">{budgetPct}%</span>
                    </span>
                  )}
                </div>
                {fin.budgetTotal > 0 && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div
                      className={
                        'h-full rounded-full transition-[width] duration-700 ' +
                        (budgetOver ? 'bg-rose-500' : budgetPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500')
                      }
                      style={{ width: `${Math.min(100, budgetPct)}%` }}
                    />
                  </div>
                )}
              </div>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </div>
          </button>
        </ScrollReveal>
      )}

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

/** cn-lite lokal (hindari import cn hanya untuk 2 kelas kondisional). */
function cnNum(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}
