'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/store/app-store';
import { jakartaNowIso, jakartaNowParts } from '@/lib/timezone';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import TimeAnalysisDialog from '@/components/habit-tracker/time-analysis';
import { TimePicker } from '@/components/habit-tracker/time-picker';
import { cn } from '@/lib/utils';
import { useHabitOptions } from '@/hooks/use-habit-options';
import { useThemeColor } from '@/hooks/use-theme-color';
import { jakartaDateString } from '@/lib/jakarta-date';
import {
  burstFromElement,
  milestoneForStreak,
} from '@/lib/confetti';
import {
  format,
  subDays,
  addDays,
  parseISO,
  getDaysInMonth,
  getDate,
} from '@/lib/date-utils';
// PERF-FIX (FIX-TIER3 / Fix 15): replaced `date-fns` with native Intl-based
// utility module. Output is identical for the patterns and helpers used
// here — verified via test script in worklog FIX-TIER3 entry.
import { toast } from 'sonner';
import { Clock } from 'lucide-react';

import type { Habit, HabitLog } from './daily-tracker-types';
import {
  toDateString,
  formatJakartaTime,
  computeStreak,
} from './daily-tracker-helpers';
import { DateNav } from './daily-tracker-date-nav';
import { DailySummary } from './daily-tracker-daily-summary';
import { HabitCard } from './daily-tracker-habit-card';
import { LoadingSkeleton } from './daily-tracker-skeleton';

// Calendar merged into Tracker as sub-tab (nav 6 → 5)
const CalendarView = dynamic(() => import('./calendar-view'), { ssr: false });

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DailyTracker() {
  const selectedDate = useAppStore((s) => s.selectedDate);
  const setSelectedDate = useAppStore((s) => s.setSelectedDate);
  const refreshKey = useAppStore((s) => s.refreshKey);
  const queryClient = useQueryClient();
  const { xpMap, categoryMap } = useHabitOptions();
  const primaryColor = useThemeColor('primary');

  // ---- state ----
  const [loading, setLoading] = useState(true);
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [viewFilter, setViewFilter] = useState<'all' | 'incomplete' | 'completed'>('all');
  const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(new Set());
  // Calendar merge: toggle between 'today' (habit grid) and 'history' (calendar)
  const [viewMode, setViewMode] = useState<'today' | 'history'>('today');

  // ---- time dialog state ----
  const [timeDialogHabit, setTimeDialogHabit] = useState<Habit | null>(null);
  const [manualDate, setManualDate] = useState('');
  const [manualTime, setManualTime] = useState('');
  const [timeSubmitting, setTimeSubmitting] = useState(false);

  // ---- completedAt display map ----
  const [completedAtMap, setCompletedAtMap] = useState<Record<string, string>>({});

  // ---- time analysis dialog ----
  const [analysisHabitId, setAnalysisHabitId] = useState<string | null>(null);

  // ---- refs ----
  const monthLogsCacheRef = useRef<Record<string, Record<string, HabitLog[]>>>({});
  const cachedMonthRef = useRef('');
  // BUG-16 fix: track the refreshKey that was used to populate the cache.
  // When refreshKey changes (e.g. user hit "refresh" or created a new habit),
  // the cache short-circuit must be bypassed so the new data is fetched.
  const cachedRefreshKeyRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // BUG-19 fix: store the latest pending notes-save so we can fire-and-forget
  // it on unmount (using keepalive) instead of cancelling it. Previously the
  // debounced save was cancelled on unmount, so typing-then-navigating within
  // 600ms lost the user's notes silently.
  const pendingSaveRef = useRef<{ date: string; notes?: string } | null>(null);

  // PERF-REACT-1 fix: mirror `completionMap` into a ref so toggleHabit and
  // handleHabitCheck can read the latest value WITHOUT having `completionMap`
  // in their useCallback deps. Without this, every toggle (which updates
  // completionMap) would create new handler identities, which would defeat
  // React.memo on HabitCard and re-render every card in the grid — even
  // untouched ones. With the ref, handlers stay stable across toggles, so
  // only the actually-toggled card re-renders.
  const completionMapRef = useRef(completionMap);
  useEffect(() => {
    completionMapRef.current = completionMap;
  }, [completionMap]);

  // ---- TanStack Query: habits, daily-log ----
  const { data: habits = [] } = useQuery<Habit[]>({
    queryKey: ['habits'],
    queryFn: async () => {
      const res = await fetch('/api/habits');
      if (!res.ok) throw new Error('Failed to load habits');
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data: dailyLogData } = useQuery<{ notes: string | null } | null>({
    queryKey: ['daily-logs', selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/daily-logs?date=${selectedDate}`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 15_000,
  });

  useEffect(() => {
    setNotes(dailyLogData?.notes || '');
  }, [dailyLogData]);

  // ---- derived ----
  const dateObj = useMemo(() => parseISO(selectedDate), [selectedDate]);
  const dayOfMonth = getDate(dateObj);
  const daysInMonth = getDaysInMonth(dateObj);
  // BUG-7 fix: use jakartaDateString() (TZ-explicit) instead of
  // format(startOfDay(new Date()), 'yyyy-MM-dd') which reads the BROWSER's
  // local TZ. A user in UTC-8 viewing the app at 22:00 local would see
  // todayStr = "2025-01-15" while Jakarta is already 2025-01-16 — selecting
  // "Today" would jump to the wrong date.
  const todayStr = jakartaDateString();

  const activeHabits = useMemo(
    () => habits.filter((h) => h.status === 'active'),
    [habits],
  );

  const filteredHabits = useMemo(() => {
    let list = activeHabits;
    if (viewFilter === 'completed')
      list = list.filter((h) => completionMap[h.id] ?? false);
    if (viewFilter === 'incomplete')
      list = list.filter((h) => !(completionMap[h.id] ?? false));
    return list;
  }, [activeHabits, completionMap, viewFilter]);

  const completedCount = Object.values(completionMap).filter(Boolean).length;
  const totalCount = activeHabits.length;
  const completionPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const todayXP = useMemo(() => {
    return activeHabits.reduce((sum, h) => {
      if (completionMap[h.id] ?? false) return sum + (xpMap[h.difficulty] || 20);
      return sum;
    }, 0);
  }, [activeHabits, completionMap, xpMap]);

  // Best current streak across all active habits
  const bestStreak = useMemo(() => {
    const month = selectedDate.slice(0, 7);
    const cache = monthLogsCacheRef.current[month];
    if (!cache) return 0;
    let best = 0;
    for (const h of activeHabits) {
      const logs = cache[h.id] || [];
      const s = computeStreak(logs, selectedDate);
      if (s > best) best = s;
    }
    return best;
  }, [activeHabits, selectedDate, completionMap]);

  // ---- fetch completions (month-cached) ----
  const fetchCompletions = async (habitList: Habit[], date: string) => {
    const month = date.slice(0, 7);

    // BUG-16 fix: include refreshKey in the cache hit check. Without this,
    // changing refreshKey (e.g. after creating a habit) would still hit the
    // stale cache and never re-fetch.
    if (
      cachedMonthRef.current === month &&
      monthLogsCacheRef.current[month] &&
      cachedRefreshKeyRef.current === refreshKey
    ) {
      const cache = monthLogsCacheRef.current[month];
      const map: Record<string, boolean> = {};
      const atMap: Record<string, string> = {};
      habitList
        .filter((h) => h.status === 'active')
        .forEach((h) => {
          const logs = cache[h.id] || [];
          const dayLog = logs.find((l) => toDateString(l.date) === date);
          map[h.id] = dayLog?.completed ?? false;
          if (dayLog?.completedAt) {
            atMap[h.id] = formatJakartaTime(dayLog.completedAt);
          }
        });
      setCompletionMap(map);
      setCompletedAtMap(atMap);
      return;
    }

    const active = habitList.filter((h) => h.status === 'active');
    const ids = active.map((h) => h.id);

    let groupedLogs: Record<string, HabitLog[]> = {};
    try {
      const res = await fetch(
        `/api/habits/batch-logs?month=${month}&habitIds=${ids.join(',')}`,
      );
      if (res.ok) {
        groupedLogs = await res.json();
      }
    } catch {
      // fall through to empty defaults
    }

    const monthCache: Record<string, HabitLog[]> = {};
    const map: Record<string, boolean> = {};
    const atMap: Record<string, string> = {};

    active.forEach((habit) => {
      const logs = groupedLogs[habit.id] || [];
      monthCache[habit.id] = logs;
      const dayLog = logs.find((l) => toDateString(l.date) === date);
      map[habit.id] = dayLog?.completed ?? false;
      if (dayLog?.completedAt) {
        atMap[habit.id] = formatJakartaTime(dayLog.completedAt);
      }
    });

    monthLogsCacheRef.current[month] = monthCache;
    cachedMonthRef.current = month;
    // BUG-16 fix: record the refreshKey that populated this cache so a future
    // refreshKey change invalidates the cache.
    cachedRefreshKeyRef.current = refreshKey;
    setCompletionMap(map);
    setCompletedAtMap(atMap);
  };

  // ---- debounced save (notes only) ----
  const debouncedSave = useCallback(
    (patch: { notes?: string }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      // BUG-19 fix: stash the pending patch (with the current selectedDate)
      // so the unmount handler can fire-and-forget it. Previously the timer
      // was just cancelled on unmount, losing the last <600ms of typing.
      pendingSaveRef.current = { date: selectedDate, ...patch };
      saveTimerRef.current = setTimeout(async () => {
        const pending = pendingSaveRef.current;
        pendingSaveRef.current = null;
        if (!pending) return;
        try {
          await fetch('/api/daily-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pending),
          });
          queryClient.invalidateQueries({ queryKey: ['daily-logs', pending.date] });
        } catch {
          toast.error('Gagal menyimpan catatan');
        }
      }, 600);
    },
    [selectedDate, queryClient],
  );

  const handleNotesChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setNotes(e.target.value);
      debouncedSave({ notes: e.target.value });
    },
    [debouncedSave],
  );

  // ---- handlers ----
  // Ref to track the element that triggered a habit completion (for confetti position).
  // Set in handleHabitCheck, read in toggleHabit after successful API response.
  const confettiElRef = useRef<HTMLElement | null>(null);

  // PERF-REACT-1 fix: toggleHabit is declared BEFORE handleHabitCheck and
  // handleTimeDialogSubmit (which call it) so the useCallback deps arrays
  // can reference it without temporal-dead-zone errors. Reads
  // `completionMap` via `completionMapRef.current` (not directly) so the
  // callback identity stays stable across toggles — this is what lets
  // React.memo on HabitCard actually skip re-renders for untouched cards.
  const toggleHabit = useCallback(
    async (habitId: string, completedAt: string | null) => {
      const next = !(completionMapRef.current[habitId] ?? false);

      setCompletionMap((p) => ({ ...p, [habitId]: next }));
      setTogglingIds((p) => new Set(p).add(habitId));

      if (next) {
        setRecentlyCompleted((p) => new Set(p).add(habitId));
        setTimeout(() => {
          setRecentlyCompleted((p) => {
            const s = new Set(p);
            s.delete(habitId);
            return s;
          });
        }, 700);
      }

      try {
        const res = await fetch(`/api/habits/${habitId}/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: selectedDate,
            completed: next,
            completedAt: next ? completedAt : undefined,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        // update month cache
        const month = selectedDate.slice(0, 7);
        const cache = monthLogsCacheRef.current[month];
        if (cache) {
          const logs = cache[habitId] || [];
          const idx = logs.findIndex((l) => toDateString(l.date) === selectedDate);
          const entry = {
            id: '',
            habitId,
            date: new Date(selectedDate + 'T12:00:00').toISOString(),
            completed: next,
            value: 1,
            completedAt: next && completedAt ? completedAt : null,
          };
          if (idx >= 0) {
            logs[idx] = { ...logs[idx], ...entry };
          } else {
            logs.push(entry);
          }
        }

        if (next && completedAt) {
          setCompletedAtMap((p) => ({
            ...p,
            [habitId]: formatJakartaTime(completedAt),
          }));
        } else {
          setCompletedAtMap((p) => {
            const np = { ...p };
            delete np[habitId];
            return np;
          });
        }

        queryClient.invalidateQueries({ queryKey: ['habits'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });

        if (next) {
          toast.success('Habit selesai! 🎉');

          // ── Confetti — ONLY after successful API response ──
          // BUG-1 fix: the month cache was already mutated above (lines 619-636
          // in the original) to include today's completion, so computeStreak
          // already counts today. The previous `newStreak = currentStreak + 1`
          // double-counted today, firing milestone confetti (7/30/100/365) one
          // day early. Now `newStreak = currentStreak`.
          // BUG-18 fix: when no cache exists, return 0 (not _count.logs which
          // was the total log count — completely unrelated to a streak).
          const currentStreak = cache ? computeStreak(cache[habitId] || [], selectedDate) : 0;
          const newStreak = currentStreak;
          const el = confettiElRef.current;

          if ([7, 30, 100, 365].includes(newStreak)) {
            // Big milestone — dispatch to the correct tier-based
            // full-screen celebration (🌱 → ⚡🔥 → 💯🔥 → 🏆⭐🔥).
            milestoneForStreak(newStreak);
          } else {
            // Regular completion — burst from the clicked element
            burstFromElement(el, { count: 20 });
          }
          // Clear the ref so a future toggle-OFF doesn't reuse a stale element.
          confettiElRef.current = null;
        }
      } catch (e) {
        setCompletionMap((p) => ({ ...p, [habitId]: !next }));
        toast.error(e instanceof Error ? e.message : 'Gagal memperbarui habit');
        confettiElRef.current = null;
      } finally {
        setTogglingIds((p) => {
          const s = new Set(p);
          s.delete(habitId);
          return s;
        });
      }
    },
    [selectedDate, queryClient],
  );

  const handleHabitCheck = useCallback(
    (habit: Habit, event?: React.MouseEvent | React.KeyboardEvent) => {
      const next = !(completionMapRef.current[habit.id] ?? false);
      if (!next) {
        toggleHabit(habit.id, null);
        return;
      }
      // Store the triggering element for confetti positioning (used in toggleHabit
      // after successful API response — ensures confetti only fires on actual completion).
      // For checkbox clicks, event.currentTarget is the checkbox; for card clicks,
      // it's the card div. Both are valid origins for the confetti burst.
      //
      // BUG-5 fix: only OVERWRITE the ref when an event is provided. The checkbox's
      // onClick handler sets confettiElRef to the checkbox button right before
      // onCheckedChange fires (which calls handleHabitCheck with no event). The
      // previous code did `confettiElRef.current = event ? ... : null`, which
      // overwrote the checkbox ref with null — defeating the FIX-BUGS-1 fix.
      if (event && 'currentTarget' in event) {
        confettiElRef.current = event.currentTarget as HTMLElement;
      }

      if (habit.trackTime) {
        // BUG-17 fix: use jakartaNowParts() (TZ-explicit) instead of
        // new Date().getHours()/getMinutes() (browser-local TZ). On a non-Jakarta
        // browser the local hours would be displayed but stored as Jakarta ISO,
        // causing the time picker to show the wrong initial value.
        const now = jakartaNowParts();
        setTimeDialogHabit(habit);
        setManualDate(selectedDate);
        setManualTime(
          `${String(now.hours).padStart(2, '0')}:${String(now.minutes).padStart(2, '0')}`,
        );
      } else {
        toggleHabit(habit.id, null);
      }
    },
    [toggleHabit, selectedDate],
  );

  const handleTimeDialogSubmit = useCallback(
    async (useNow: boolean) => {
      if (!timeDialogHabit) return;
      setTimeSubmitting(true);
      try {
        let completedAtISO: string | null = null;
        if (useNow) {
          // BUG-17 fix: use jakartaNowIso() (returns ISO with +07:00 offset,
          // independent of browser TZ) instead of toLocalISO(new Date()) which
          // uses the browser's local offset.
          completedAtISO = jakartaNowIso();
        } else if (manualTime) {
          // BUG-17 fix: construct the ISO with +07:00 offset directly. The user
          // enters manualTime in Jakarta wall-clock (the rest of the app uses
          // Jakarta), so we just append the offset. Previously toLocalISO() was
          // used, which interpreted the input as browser-local TZ and produced
          // a different ISO on non-Jakarta browsers.
          completedAtISO = `${manualDate}T${manualTime}:00+07:00`;
        }
        await toggleHabit(timeDialogHabit.id, completedAtISO);
        setTimeDialogHabit(null);
      } catch {
        toast.error('Gagal menyimpan waktu');
      } finally {
        setTimeSubmitting(false);
      }
    },
    [timeDialogHabit, toggleHabit, manualDate, manualTime],
  );

  // PERF-REACT-1 fix: stable callback wrappers for the inline arrow functions
  // previously passed to HabitCard (onSetConfettiEl, onOpenAnalysis). Without
  // useCallback, those arrows created new function identities every render,
  // defeating React.memo on HabitCard. Both wrappers have empty deps because
  // they only call ref mutation / setState setter (both stable for the
  // lifetime of the component).
  const handleSetConfettiEl = useCallback((el: HTMLElement | null) => {
    confettiElRef.current = el;
  }, []);

  const handleOpenAnalysis = useCallback((habitId: string) => {
    setAnalysisHabitId(habitId);
  }, []);

  // ---- date navigation ----
  const goToPrevDay = useCallback(
    () => setSelectedDate(format(subDays(dateObj, 1), 'yyyy-MM-dd')),
    [dateObj, setSelectedDate],
  );
  const goToNextDay = useCallback(
    () => setSelectedDate(format(addDays(dateObj, 1), 'yyyy-MM-dd')),
    [dateObj, setSelectedDate],
  );
  const goToToday = useCallback(
    () => setSelectedDate(todayStr),
    [todayStr, setSelectedDate],
  );

  // ---- effects ----
  useEffect(() => {
    if (habits.length === 0) {
      setLoading(false); // prevent stuck skeleton for users with no habits
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        await fetchCompletions(habits, selectedDate);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [habits, selectedDate, refreshKey]);

  // BUG-19 fix: on unmount, fire-and-forget any pending debounced notes save
  // using `keepalive: true` so the request completes after the component is
  // gone. Previously the save was just cancelled, silently dropping the user's
  // last edits if they navigated within the 600ms debounce window.
  useEffect(
    () => () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      const pending = pendingSaveRef.current;
      if (pending) {
        pendingSaveRef.current = null;
        try {
          // Fire-and-forget: don't await, don't invalidate queries (component
          // is gone, queryClient may be torn down). keepalive lets the browser
          // finish the request even after the page unmounts.
          void fetch('/api/daily-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pending),
            keepalive: true,
          }).catch(() => {
            /* swallow — there's no UI left to surface the error to */
          });
        } catch {
          /* ignore */
        }
      }
    },
    [],
  );

  if (loading) return <LoadingSkeleton />;

  const isToday = selectedDate === todayStr;
  const monthLogsCache = monthLogsCacheRef.current[selectedDate.slice(0, 7)];

  // ---- render ----
  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* ─────────────────── View Toggle (Hari Ini | Riwayat) ─── */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 w-fit">
        <button
          onClick={() => setViewMode('today')}
          className={cn(
            'px-4 py-1.5 text-sm font-medium rounded-md transition-all',
            viewMode === 'today' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Hari Ini
        </button>
        <button
          onClick={() => setViewMode('history')}
          className={cn(
            'px-4 py-1.5 text-sm font-medium rounded-md transition-all',
            viewMode === 'history' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Riwayat
        </button>
      </div>

      {/* ─────────────────── Calendar (History View) ─────────── */}
      {viewMode === 'history' ? (
        <CalendarView />
      ) : (
        <>
      {/* ─────────────────── Date Navigation ─────────────────── */}
      <DateNav
        isToday={isToday}
        dateObj={dateObj}
        dayOfMonth={dayOfMonth}
        daysInMonth={daysInMonth}
        onPrev={goToPrevDay}
        onNext={goToNextDay}
        onToday={goToToday}
      />

      {/* ─────────────────── Daily Summary (4 KPI cards) ─────── */}
      <DailySummary
        completedCount={completedCount}
        totalCount={totalCount}
        completionPct={completionPct}
        todayXP={todayXP}
        bestStreak={bestStreak}
      />

      {/* ─────────────────── Daily Notes (full-width) ────────── */}
      <section className="daily-notes-card">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">📝</span>
          <h3 className="text-sm font-semibold">Catatan Harian</h3>
          <span className="ml-auto text-[11px] text-muted-foreground/70">
            {notes.length > 0 ? `${notes.length} karakter` : 'Tersimpan otomatis'}
          </span>
        </div>
        <Textarea
          id="daily-notes"
          value={notes}
          onChange={handleNotesChange}
          placeholder="Bagaimana harimu? Tulis refleksi di sini…"
          className="min-h-[80px] resize-none border-0 bg-transparent p-0 focus-visible:ring-0 text-sm leading-relaxed placeholder:text-muted-foreground/50"
        />
      </section>

      {/* ─────────────────── Habit Grid ─────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Habits
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
              {completedCount}/{totalCount}
            </span>
            <div className="flex items-center rounded-xl border border-border overflow-hidden bg-card">
              {(
                [
                  ['all', 'Semua'],
                  ['incomplete', 'Belum'],
                  ['completed', 'Selesai'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setViewFilter(key)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-colors',
                    viewFilter === key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activeHabits.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-border">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm font-medium text-muted-foreground">
              Belum ada habit aktif
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Buka Habit Master untuk membuatnya!
            </p>
          </div>
        ) : filteredHabits.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-border">
            <div className="text-4xl mb-3">
              {viewFilter === 'completed' ? '🏁' : '✅'}
            </div>
            <p className="text-sm text-muted-foreground">
              {viewFilter === 'completed'
                ? 'Belum ada habit yang selesai.'
                : viewFilter === 'incomplete'
                  ? 'Semua habit selesai — kerja bagus!'
                  : 'Tidak ada habit yang cocok dengan filter ini.'}
            </p>
          </div>
        ) : (
          <div className="habit-grid">
            {filteredHabits.map((habit, idx) => {
              const isDone = !!(completionMap[habit.id] ?? false);
              const isToggling = togglingIds.has(habit.id);
              const justCompleted = recentlyCompleted.has(habit.id);
              const doneTime = isDone ? completedAtMap[habit.id] : null;

              return (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  idx={idx}
                  isDone={isDone}
                  isToggling={isToggling}
                  justCompleted={justCompleted}
                  doneTime={doneTime ?? null}
                  monthLogs={monthLogsCache?.[habit.id]}
                  selectedDate={selectedDate}
                  todayStr={todayStr}
                  categoryColor={categoryMap[habit.category]?.color || 'slate'}
                  primaryColor={primaryColor}
                  onToggleHabit={handleHabitCheck}
                  onSetConfettiEl={handleSetConfettiEl}
                  onOpenAnalysis={handleOpenAnalysis}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ── Time Confirmation Dialog ── */}
      <Dialog
        open={!!timeDialogHabit}
        onOpenChange={(open) => !open && setTimeDialogHabit(null)}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{timeDialogHabit?.icon}</span>
              {timeDialogHabit?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Kapan kamu melakukannya?
            </p>

            <button
              type="button"
              onClick={() => handleTimeDialogSubmit(true)}
              disabled={timeSubmitting}
              className="w-full flex items-center gap-3 rounded-xl border-2 border-primary/30 bg-primary/5 p-3 text-left hover:border-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              <Clock className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Sekarang</p>
                <p className="text-xs text-muted-foreground">
                  {new Date().toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </button>

            <div className="relative flex items-center justify-center">
              <span className="text-xs text-muted-foreground bg-background px-2 z-10">
                atau isi manual
              </span>
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Tanggal
                  </label>
                  <Input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    max={jakartaDateString()}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Jam
                  </label>
                  <TimePicker
                    value={manualTime}
                    onChange={(v) => setManualTime(v)}
                  />
                </div>
              </div>
              <Button
                onClick={() => handleTimeDialogSubmit(false)}
                disabled={timeSubmitting || !manualTime}
                className="w-full"
              >
                {timeSubmitting ? 'Menyimpan...' : 'Simpan Waktu'}
              </Button>
            </div>

            {timeDialogHabit?.targetTime && (
              <p className="text-xs text-center text-muted-foreground">
                Target: {timeDialogHabit.targetTime}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Time Analysis Dialog ── */}
      <TimeAnalysisDialog
        habitId={analysisHabitId}
        open={!!analysisHabitId}
        onOpenChange={(open) => !open && setAnalysisHabitId(null)}
      />
        </>
      )}
    </div>
  );
}
