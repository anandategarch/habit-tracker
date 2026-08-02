'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/app-store';
import { jakartaDateKey } from '@/lib/timezone';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Calendar,
  Flame,
  Star,
  Clock,
  Zap,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import TimeAnalysisDialog from '@/components/habit-tracker/time-analysis';
import { cn } from '@/lib/utils';
import { useHabitOptions } from '@/hooks/use-habit-options';
import { getBadgeClass } from '@/lib/label-colors';
import { CountUpNumber } from '@/components/habit-tracker/count-up';
import { FlashNumber } from '@/components/habit-tracker/flash-number';
import { useThemeColor } from '@/hooks/use-theme-color';
import { jakartaDateString } from '@/lib/jakarta-date';
import {
  format,
  addDays,
  subDays,
  startOfDay,
  parseISO,
  getDaysInMonth,
  getDate,
  differenceInCalendarDays,
} from 'date-fns';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Habit {
  id: string;
  name: string;
  icon: string;
  category: string;
  priority: string;
  difficulty: string;
  target: number;
  targetType: string;
  color: string;
  reminder: string | null;
  startDate: string;
  endDate: string | null;
  status: string;
  notes: string | null;
  order: number;
  trackTime: boolean;
  targetTime: string | null;
  groupId: string | null;
  _count: { logs: number };
}

interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  completed: boolean;
  value: number;
  completedAt: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateString(isoLike: string): string {
  return jakartaDateKey(new Date(isoLike));
}

function timeDiffMinutes(time: string, target: string): number {
  const [th, tm] = target.split(':').map(Number);
  const [ah, am] = time.split(':').map(Number);
  return (ah * 60 + am) - (th * 60 + tm);
}

/** Convert a Date to ISO string WITH timezone offset (preserves local time) */
function toLocalISO(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const oh = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const om = String(absOffset % 60).padStart(2, '0');
  const y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${M}-${d}T${h}:${m}:${s}${sign}${oh}:${om}`;
}

/**
 * Compute the current streak (consecutive completed days ending at `date`)
 * for a single habit, using its month-cached logs.
 */
function computeStreak(logs: HabitLog[], dateStr: string): number {
  if (!logs || logs.length === 0) return 0;
  const completedDays = new Set(
    logs.filter((l) => l.completed).map((l) => toDateString(l.date)),
  );
  if (completedDays.size === 0) return 0;

  let streak = 0;
  const cursor = parseISO(dateStr);
  // If today isn't completed yet, streak can still count up to yesterday.
  if (!completedDays.has(dateStr)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  // Walk backwards counting consecutive completed days (cap at 365 for safety).
  for (let i = 0; i < 365; i++) {
    const key = format(cursor, 'yyyy-MM-dd');
    if (completedDays.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Category colour system — premium pastel tints per category
// ---------------------------------------------------------------------------

const CATEGORY_STYLES: Record<
  string,
  { tint: string; ring: string; glow: string; text: string; hex: string }
> = {
  Productivity: { tint: 'cat-emerald', ring: '#10b981', glow: 'rgba(16,185,129,0.25)', text: 'text-emerald-600 dark:text-emerald-400', hex: '#10b981' },
  Learning: { tint: 'cat-indigo', ring: '#6366f1', glow: 'rgba(99,102,241,0.25)', text: 'text-indigo-600 dark:text-indigo-400', hex: '#6366f1' },
  Fitness: { tint: 'cat-orange', ring: '#f97316', glow: 'rgba(249,115,22,0.25)', text: 'text-orange-600 dark:text-orange-400', hex: '#f97316' },
  Health: { tint: 'cat-teal', ring: '#14b8a6', glow: 'rgba(20,184,166,0.25)', text: 'text-teal-600 dark:text-teal-400', hex: '#14b8a6' },
  Reading: { tint: 'cat-sky', ring: '#0ea5e9', glow: 'rgba(14,165,233,0.25)', text: 'text-sky-600 dark:text-sky-400', hex: '#0ea5e9' },
  Personal: { tint: 'cat-rose', ring: '#ec4899', glow: 'rgba(236,72,153,0.25)', text: 'text-rose-600 dark:text-rose-400', hex: '#ec4899' },
  Creative: { tint: 'cat-fuchsia', ring: '#d946ef', glow: 'rgba(217,70,239,0.25)', text: 'text-fuchsia-600 dark:text-fuchsia-400', hex: '#d946ef' },
  Mindfulness: { tint: 'cat-violet', ring: '#8b5cf6', glow: 'rgba(139,92,246,0.25)', text: 'text-violet-600 dark:text-violet-400', hex: '#8b5cf6' },
  Social: { tint: 'cat-red', ring: '#ef4444', glow: 'rgba(239,68,68,0.25)', text: 'text-red-600 dark:text-red-400', hex: '#ef4444' },
  General: { tint: 'cat-slate', ring: '#64748b', glow: 'rgba(100,116,139,0.25)', text: 'text-slate-600 dark:text-slate-400', hex: '#64748b' },
};

function getCategoryStyle(category: string) {
  return CATEGORY_STYLES[category] || CATEGORY_STYLES.General;
}

// ---------------------------------------------------------------------------
// Circular progress ring — animated SVG
// ---------------------------------------------------------------------------

function ProgressRing({
  progress,
  color,
  done,
  size = 52,
  primaryColor,
}: {
  progress: number;
  color: string;
  done: boolean;
  size?: number;
  primaryColor: string;
}) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, progress));
  const offset = c * (1 - pct / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="oklch(0.91 0.004 120)"
          strokeWidth={stroke}
          className="dark:stroke-white/10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={done ? primaryColor : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
          style={{
            filter: done ? 'drop-shadow(0 0 4px rgba(34,197,94,0.5))' : 'none',
          }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        {done ? (
          <Check className="h-5 w-5 text-primary animate-[ringPop_0.4s_ease]" strokeWidth={3} />
        ) : (
          <span className="text-[11px] font-bold tabular-nums text-muted-foreground">
            {Math.round(pct)}%
          </span>
        )}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  staggerIndex = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  accent: 'green' | 'orange' | 'rose' | 'amber';
  staggerIndex?: number;
}) {
  const accents: Record<string, string> = {
    green: 'kpi-card-green',
    orange: 'kpi-card-orange',
    rose: 'kpi-card-rose',
    amber: 'kpi-card-amber',
  };
  const iconColors: Record<string, string> = {
    green: 'text-emerald-500',
    orange: 'text-orange-500',
    rose: 'text-rose-500',
    amber: 'text-amber-500',
  };
  return (
    <div
      className={cn('kpi-card group anim-stagger', accents[accent])}
      style={{ animationDelay: `${staggerIndex * 60}ms` }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={cn('h-3.5 w-3.5', iconColors[accent])} />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="text-[11px] mt-0.5 text-muted-foreground">{sub}</p>
    </div>
  );
}

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
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');

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

    if (cachedMonthRef.current === month && monthLogsCacheRef.current[month]) {
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
            const d = new Date(dayLog.completedAt);
            atMap[h.id] = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
        const d = new Date(dayLog.completedAt);
        atMap[habit.id] = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
    });

    monthLogsCacheRef.current[month] = monthCache;
    cachedMonthRef.current = month;
    setCompletionMap(map);
    setCompletedAtMap(atMap);
  };

  // ---- debounced save (notes only) ----
  const debouncedSave = useCallback(
    (patch: { notes?: string }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await fetch('/api/daily-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: selectedDate, ...patch }),
          });
          queryClient.invalidateQueries({ queryKey: ['daily-logs', selectedDate] });
        } catch {
          toast.error('Gagal menyimpan catatan');
        }
      }, 600);
    },
    [selectedDate, queryClient],
  );

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
    debouncedSave({ notes: e.target.value });
  };

  // ---- handlers ----
  const handleHabitCheck = (habit: Habit) => {
    const next = !(completionMap[habit.id] ?? false);
    if (!next) {
      toggleHabit(habit.id, null);
      return;
    }
    if (habit.trackTime) {
      const now = new Date();
      setTimeDialogHabit(habit);
      setManualDate(selectedDate);
      setManualTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      );
    } else {
      toggleHabit(habit.id, null);
    }
  };

  const handleTimeDialogSubmit = async (useNow: boolean) => {
    if (!timeDialogHabit) return;
    setTimeSubmitting(true);
    try {
      let completedAtISO: string | null = null;
      if (useNow) {
        completedAtISO = toLocalISO(new Date());
      } else if (manualTime) {
        completedAtISO = toLocalISO(new Date(`${manualDate}T${manualTime}:00`));
      }
      await toggleHabit(timeDialogHabit.id, completedAtISO);
      setTimeDialogHabit(null);
    } catch {
      toast.error('Failed to save time');
    } finally {
      setTimeSubmitting(false);
    }
  };

  const toggleHabit = async (habitId: string, completedAt: string | null) => {
    const next = !(completionMap[habitId] ?? false);

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
        const d = new Date(completedAt);
        setCompletedAtMap((p) => ({
          ...p,
          [habitId]: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
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

      if (next) toast.success('Habit completed! 🎉');
    } catch (e) {
      setCompletionMap((p) => ({ ...p, [habitId]: !next }));
      toast.error(e instanceof Error ? e.message : 'Failed to update habit');
    } finally {
      setTogglingIds((p) => {
        const s = new Set(p);
        s.delete(habitId);
        return s;
      });
    }
  };

  // ---- date navigation ----
  const goToPrevDay = () =>
    setSelectedDate(format(subDays(dateObj, 1), 'yyyy-MM-dd'));
  const goToNextDay = () =>
    setSelectedDate(format(addDays(dateObj, 1), 'yyyy-MM-dd'));
  const goToToday = () => setSelectedDate(todayStr);

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

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    [],
  );

  if (loading) return <LoadingSkeleton />;

  const isToday = selectedDate === todayStr;

  // ---- render ----
  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* ─────────────────── Date Navigation ─────────────────── */}
      <section className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevDay}
            className="shrink-0 h-9 w-9 rounded-xl hover:bg-accent"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-0 px-1">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight truncate">
              {isToday ? 'Today' : format(dateObj, 'EEEE')}
            </h2>
            <p className="text-xs text-muted-foreground tabular-nums">
              {format(dateObj, 'MMM d, yyyy')} · Day {dayOfMonth}/{daysInMonth}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextDay}
            className="shrink-0 h-9 w-9 rounded-xl hover:bg-accent"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {!isToday && (
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="shrink-0 gap-1.5 rounded-xl h-9"
          >
            <Calendar className="h-3.5 w-3.5" />
            Today
          </Button>
        )}
      </section>

      {/* ─────────────────── Daily Summary (4 KPI cards) ─────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Check}
          label="Completed"
          accent="green"
          staggerIndex={0}
          value={
            <span>
              <FlashNumber value={completedCount} />
              <span className="text-sm font-medium text-muted-foreground">
                /{totalCount}
              </span>
            </span>
          }
          sub={
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1 flex-1 rounded-full bg-muted overflow-hidden">
                <span
                  className="block h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${completionPct}%` }}
                />
              </span>
              <span className="text-primary font-medium">
                {completionPct}%
              </span>
            </span>
          }
        />
        <KpiCard
          icon={Zap}
          label="XP Today"
          accent="orange"
          staggerIndex={1}
          value={
            <span>
              <CountUpNumber value={todayXP} />
              <span className="text-sm font-medium text-muted-foreground"> XP</span>
            </span>
          }
          sub={<span className="text-orange-600 dark:text-orange-400">earn more to level up</span>}
        />
        <KpiCard
          icon={Flame}
          label="Streak"
          accent="rose"
          staggerIndex={2}
          value={
            <span>
              <CountUpNumber value={bestStreak} />
              <span className="text-sm font-medium text-muted-foreground ml-1">
                {bestStreak === 1 ? 'day' : 'days'}
              </span>
            </span>
          }
          sub={
            <span className="text-rose-600 dark:text-rose-400">
              {bestStreak >= 7 ? 'On fire! 🔥' : bestStreak > 0 ? 'Keep going!' : 'Start today'}
            </span>
          }
        />
        <KpiCard
          icon={Star}
          label="XP"
          accent="amber"
          staggerIndex={3}
          value={
            <span>
              <FlashNumber value={todayXP} />
              <span className="text-sm font-medium text-muted-foreground ml-1">XP</span>
            </span>
          }
          sub={<span className="text-amber-600 dark:text-amber-400">Lv {Math.floor(todayXP / 100) + 1} · {todayXP % 100}/100</span>}
        />
      </section>

      {/* ─────────────────── Daily Notes (full-width) ────────── */}
      <section className="daily-notes-card">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">📝</span>
          <h3 className="text-sm font-semibold">Daily Notes</h3>
          <span className="ml-auto text-[11px] text-muted-foreground/70">
            {notes.length > 0 ? `${notes.length} chars` : 'Auto-saved'}
          </span>
        </div>
        <Textarea
          id="daily-notes"
          value={notes}
          onChange={handleNotesChange}
          placeholder="How was your day? Write your reflection here…"
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
                  ['all', 'All'],
                  ['incomplete', 'Todo'],
                  ['completed', 'Done'],
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
              No active habits yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Go to Habit Master to create some!
            </p>
          </div>
        ) : filteredHabits.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-border">
            <div className="text-4xl mb-3">
              {viewFilter === 'completed' ? '🏁' : '✅'}
            </div>
            <p className="text-sm text-muted-foreground">
              {viewFilter === 'completed'
                ? 'No completed habits yet.'
                : viewFilter === 'incomplete'
                  ? 'All habits completed — great job!'
                  : 'No habits match this filter.'}
            </p>
          </div>
        ) : (
          <div className="habit-grid">
            {filteredHabits.map((habit, idx) => {
              const isDone = !!(completionMap[habit.id] ?? false);
              const isToggling = togglingIds.has(habit.id);
              const justCompleted = recentlyCompleted.has(habit.id);
              const doneTime = isDone ? completedAtMap[habit.id] : null;
              const catStyle = getCategoryStyle(habit.category);
              const pct = isDone ? 100 : 0;
              const streak = (() => {
                const month = selectedDate.slice(0, 7);
                const cache = monthLogsCacheRef.current[month];
                if (!cache) return habit._count?.logs || 0;
                return computeStreak(cache[habit.id] || [], selectedDate);
              })();
              const isLate =
                doneTime && habit.targetTime && doneTime > habit.targetTime;

              return (
                <div
                  key={habit.id}
                  className={cn(
                    'habit-card group cursor-pointer select-none anim-stagger',
                    !justCompleted && 'anim-lift',
                    isDone && 'habit-card-completed',
                    justCompleted && 'habit-card-pop anim-check-pop',
                  )}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  onClick={() => handleHabitCheck(habit)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleHabitCheck(habit);
                    }
                  }}
                >
                  {/* Checkbox top-right */}
                  <div className="absolute top-4 right-4 z-10">
                    <Checkbox
                      checked={isDone}
                      onCheckedChange={() => handleHabitCheck(habit)}
                      disabled={isToggling}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'h-5 w-5 rounded-md transition-all duration-200',
                        isDone &&
                          'data-[state=checked]:bg-primary data-[state=checked]:border-primary',
                        justCompleted && 'animate-[ringPop_0.4s_ease]',
                      )}
                    />
                  </div>

                  {/* Icon + Category tint */}
                  <div
                    className={cn(
                      'w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-3 transition-transform duration-300 group-hover:scale-110',
                      catStyle.tint,
                    )}
                  >
                    {habit.icon}
                  </div>

                  {/* Title */}
                  <h4
                    className={cn(
                      'text-sm font-bold truncate pr-8 transition-all duration-200',
                      isDone && 'line-through text-muted-foreground',
                    )}
                  >
                    {habit.name}
                  </h4>

                  {/* Time + Category badge */}
                  <div className="flex items-center gap-1.5 mt-1.5 mb-4 flex-wrap">
                    {habit.targetTime && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground tabular-nums">
                        <Clock className="h-3 w-3" />
                        {habit.targetTime}
                      </span>
                    )}
                    {doneTime && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAnalysisHabitId(habit.id);
                        }}
                        className={cn(
                          'inline-flex items-center gap-0.5 text-[11px] tabular-nums rounded px-1 py-0.5 hover:bg-accent transition-colors',
                          isLate
                            ? 'text-red-500 dark:text-red-400'
                            : 'text-primary',
                        )}
                        title={
                          habit.targetTime
                            ? `Target: ${habit.targetTime}`
                            : 'Click for time analysis'
                        }
                      >
                        <Check className="h-3 w-3" />
                        {doneTime}
                        {isLate &&
                          ` +${timeDiffMinutes(doneTime, habit.targetTime!)}m`}
                      </button>
                    )}
                    <span
                      className={cn(
                        'inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                        getBadgeClass(
                          categoryMap[habit.category]?.color || 'slate',
                        ),
                      )}
                    >
                      {habit.category}
                    </span>
                  </div>

                  {/* Circular Progress + Streak */}
                  <div className="flex items-center justify-between">
                    <ProgressRing
                      progress={pct}
                      color={catStyle.hex}
                      done={isDone}
                      primaryColor={primaryColor}
                    />
                    <div className="text-right">
                      {isDone ? (
                        <span className="text-[11px] font-semibold text-primary flex items-center gap-1 justify-end">
                          <Check className="h-3 w-3" /> Done
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Not started
                        </span>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-0.5 justify-end tabular-nums">
                        <Flame
                          className={cn(
                            'h-3 w-3',
                            streak > 0 ? 'text-orange-500' : 'text-muted-foreground/40',
                            streak >= 7 && 'anim-flame-pulse',
                          )}
                        />
                        {streak} {streak === 1 ? 'day' : 'days'}
                      </p>
                    </div>
                  </div>
                </div>
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
                  <Input
                    type="time"
                    value={manualTime}
                    onChange={(e) => setManualTime(e.target.value)}
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-24 bg-muted rounded animate-pulse" />
            <div className="h-3 w-32 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="kpi-card">
            <div className="h-3 w-16 bg-muted rounded animate-pulse mb-2" />
            <div className="h-7 w-20 bg-muted rounded animate-pulse mb-1" />
            <div className="h-2 w-full bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>

      <div className="daily-notes-card">
        <div className="h-4 w-24 bg-muted rounded animate-pulse mb-3" />
        <div className="h-16 w-full bg-muted rounded animate-pulse" />
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-20 bg-muted rounded animate-pulse" />
        <div className="h-8 w-28 bg-muted rounded-xl animate-pulse" />
      </div>

      <div className="habit-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="habit-card">
            <div className="h-12 w-12 rounded-2xl bg-muted animate-pulse mb-3" />
            <div className="h-4 w-28 bg-muted rounded animate-pulse mb-2" />
            <div className="h-3 w-20 bg-muted rounded animate-pulse mb-4" />
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
              <div className="space-y-1.5">
                <div className="h-3 w-14 bg-muted rounded animate-pulse ml-auto" />
                <div className="h-3 w-10 bg-muted rounded animate-pulse ml-auto" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
