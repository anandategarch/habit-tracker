'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Moon,
  Zap,
  BedDouble,
  Calendar,
  Flame,
  Star,
  Clock,
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
import { getBadgeClass, getDotClass } from '@/lib/label-colors';
import {
  format,
  addDays,
  subDays,
  startOfDay,
  isToday,
  parseISO,
  getDaysInMonth,
  getDate,
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
// Constants
// ---------------------------------------------------------------------------

const MOOD_LABELS = [
  '😫 Terrible',
  '😕 Bad',
  '😐 Okay',
  '🙂 Good',
  '🤩 Amazing',
];

const ENERGY_LABELS = ['Exhausted', 'Low', 'Medium', 'High', 'Supercharged'];



// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSleepColorClass(hours: number): string {
  if (hours < 6) return 'text-red-500';
  if (hours < 7) return 'text-amber-500';
  return 'text-emerald-500';
}

function sleepLabel(hours: number): string {
  if (hours < 6) return 'Needs improvement';
  if (hours < 7) return 'Fair';
  if (hours < 9) return 'Well rested';
  return 'Excellent';
}

function toDateString(isoLike: string): string {
  return new Date(isoLike).toISOString().split('T')[0];
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DailyTracker() {
  const { selectedDate, setSelectedDate, refreshKey } = useAppStore();
  const { xpMap, priorityMap, categoryMap } = useHabitOptions();

  // ---- state ----
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>({});
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [sleepHours, setSleepHours] = useState(7);
  const [notes, setNotes] = useState('');
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [viewFilter, setViewFilter] = useState<'all' | 'incomplete' | 'completed'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

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

  // ---- derived ----
  const dateObj = useMemo(() => parseISO(selectedDate), [selectedDate]);
  const dayOfMonth = getDate(dateObj);
  const daysInMonth = getDaysInMonth(dateObj);
  const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');

  const activeHabits = useMemo(() => habits.filter((h) => h.status === 'active'), [habits]);

  const categories = useMemo(() => {
    const set = new Set(activeHabits.map((h) => h.category));
    return Array.from(set).sort();
  }, [activeHabits]);

  const filteredHabits = useMemo(() => {
    let list = activeHabits;
    if (viewFilter === 'completed') list = list.filter((h) => completionMap[h.id]);
    if (viewFilter === 'incomplete') list = list.filter((h) => !completionMap[h.id]);
    if (categoryFilter !== 'all') list = list.filter((h) => h.category === categoryFilter);
    return list;
  }, [activeHabits, completionMap, viewFilter, categoryFilter]);

  const completedCount = Object.values(completionMap).filter(Boolean).length;
  const totalCount = activeHabits.length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const todayXP = useMemo(() => {
    return activeHabits.reduce((sum, h) => {
      if (completionMap[h.id]) return sum + (xpMap[h.difficulty] || 20);
      return sum;
    }, 0);
  }, [activeHabits, completionMap]);

  const level = Math.floor(todayXP / 100) + 1;
  const levelProgress = todayXP % 100;

  // ---- data fetching ----

  const fetchHabits = useCallback(async () => {
    try {
      const res = await fetch('/api/habits');
      if (!res.ok) throw new Error();
      const data: Habit[] = await res.json();
      setHabits(data);
      return data;
    } catch {
      toast.error('Failed to load habits');
      return [];
    }
  }, []);

  const fetchDailyLog = useCallback(async (date: string) => {
    try {
      const res = await fetch(`/api/daily-logs?date=${date}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data) {
        setMood(data.mood ?? 3);
        setEnergy(data.energy ?? 3);
        setSleepHours(data.sleep ?? 7);
        setNotes(data.notes || '');
      } else {
        setMood(3);
        setEnergy(3);
        setSleepHours(7);
        setNotes('');
      }
    } catch {
      toast.error('Gagal memuat data');
      setMood(3);
      setEnergy(3);
      setSleepHours(7);
      setNotes('');
    }
  }, []);

  const fetchCompletions = useCallback(
    async (habitList: Habit[], date: string) => {
      const month = date.slice(0, 7);

      // Re-use cache when month hasn't changed
      if (cachedMonthRef.current === month && monthLogsCacheRef.current[month]) {
        const cache = monthLogsCacheRef.current[month];
        const map: Record<string, boolean> = {};
        const atMap: Record<string, string> = {};
        habitList.filter((h) => h.status === 'active').forEach((h) => {
          const logs = cache[h.id] || [];
          const dayLog = logs.find((l) => toDateString(l.date) === date);
          map[h.id] = dayLog?.completed ?? false;
          if (dayLog?.completedAt) {
            const d = new Date(dayLog.completedAt);
            atMap[h.id] = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
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
          atMap[habit.id] = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        }
      });

      monthLogsCacheRef.current[month] = monthCache;
      cachedMonthRef.current = month;
      setCompletionMap(map);
      setCompletedAtMap(atMap);
    },
    [],
  );

  // ---- debounced save ----

  const debouncedSave = useCallback(
    (patch: { mood?: number; energy?: number; sleep?: number; notes?: string }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await fetch('/api/daily-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: selectedDate, ...patch }),
          });
        } catch {
          toast.error('Gagal menyimpan data');
        }
      }, 500);
    },
    [selectedDate],
  );

  // ---- handlers ----

  const handleMoodChange = (v: number[]) => {
    setMood(v[0]);
    debouncedSave({ mood: v[0] });
  };
  const handleEnergyChange = (v: number[]) => {
    setEnergy(v[0]);
    debouncedSave({ energy: v[0] });
  };
  const handleSleepChange = (v: number[]) => {
    setSleepHours(v[0]);
    debouncedSave({ sleep: v[0] });
  };
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
    debouncedSave({ notes: e.target.value });
  };

  const handleHabitCheck = (habit: Habit) => {
    const next = !completionMap[habit.id];
    // If unchecking, just toggle directly
    if (!next) {
      toggleHabit(habit.id, null);
      return;
    }
    // If time-tracked habit, show dialog
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
    const next = !completionMap[habitId];

    // optimistic
    setCompletionMap((p) => ({ ...p, [habitId]: next }));
    setTogglingIds((p) => new Set(p).add(habitId));

    try {
      const res = await fetch(`/api/habits/${habitId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, completed: next, completedAt: next ? completedAt : undefined }),
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

      // Update completedAt display
      if (next && completedAt) {
        const d = new Date(completedAt);
        setCompletedAtMap((p) => ({
          ...p,
          [habitId]: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
        }));
      } else {
        setCompletedAtMap((p) => {
          const np = { ...p };
          delete np[habitId];
          return np;
        });
      }

      // bump _count locally
      setHabits((prev) =>
        prev.map((h) =>
          h.id === habitId
            ? { ...h, _count: { logs: h._count.logs + (next ? 1 : -1) } }
            : h,
        ),
      );

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

  // Consolidated data loading: handles both initial load, date changes, and refresh
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchHabits();
        if (cancelled) return;
        await Promise.all([
          fetchDailyLog(selectedDate),
          fetchCompletions(data, selectedDate),
        ]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, refreshKey]);

  // cleanup
  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  // ---- render: loading skeleton ----
  if (loading) return <LoadingSkeleton />;

  // ---- render ----
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ────────────────────────── Date Navigation ────────────────────────── */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPrevDay}
            className="shrink-0"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="text-center sm:text-left min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
              {format(dateObj, 'EEEE, MMMM d, yyyy')}
            </h2>
            <p className="text-sm text-muted-foreground">
              Day {dayOfMonth} of {daysInMonth}
            </p>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={goToNextDay}
            className="shrink-0"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {selectedDate !== todayStr && (
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="shrink-0 gap-1.5"
          >
            <Calendar className="h-3.5 w-3.5" />
            Today
          </Button>
        )}
      </section>

      {/* ────────────────────────── Daily Metrics ────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Mood */}
        <Card className="py-4 gap-3">
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Moon className="h-4 w-4 text-muted-foreground" />
                Mood
              </span>
              <span className="text-xs text-muted-foreground font-medium tabular-nums">
                {mood}/5
              </span>
            </div>
            <Slider
              value={[mood]}
              onValueChange={handleMoodChange}
              min={1}
              max={5}
              step={1}
            />
            <p className="text-sm font-semibold text-center">{MOOD_LABELS[mood - 1]}</p>
          </CardContent>
        </Card>

        {/* Energy */}
        <Card className="py-4 gap-3">
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Zap className="h-4 w-4 text-muted-foreground" />
                Energy
              </span>
              <span className="text-xs text-muted-foreground font-medium tabular-nums">
                {energy}/5
              </span>
            </div>
            <Slider
              value={[energy]}
              onValueChange={handleEnergyChange}
              min={1}
              max={5}
              step={1}
            />
            <p className="text-sm font-semibold text-center">
              {ENERGY_LABELS[energy - 1]}
            </p>
          </CardContent>
        </Card>

        {/* Sleep */}
        <Card className="py-4 gap-3">
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium">
                <BedDouble className="h-4 w-4 text-muted-foreground" />
                Sleep
              </span>
              <span
                className={cn(
                  'text-xs font-bold tabular-nums',
                  getSleepColorClass(sleepHours),
                )}
              >
                {sleepHours}h
              </span>
            </div>
            <Slider
              value={[sleepHours]}
              onValueChange={handleSleepChange}
              min={0}
              max={12}
              step={0.5}
            />
            <p
              className={cn(
                'text-sm font-semibold text-center',
                getSleepColorClass(sleepHours),
              )}
            >
              {sleepLabel(sleepHours)}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Notes */}
      <Card className="py-4 gap-3">
        <CardContent className="space-y-2">
          <label
            htmlFor="daily-notes"
            className="text-sm font-medium text-muted-foreground"
          >
            Daily Notes
          </label>
          <Textarea
            id="daily-notes"
            value={notes}
            onChange={handleNotesChange}
            placeholder="How was your day? Any reflections..."
            className="min-h-[80px] resize-none"
          />
        </CardContent>
      </Card>

      <Separator />

      {/* ────────────────────────── Habit Checklist ────────────────────────── */}
      <section>
        {/* Header + filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Habit Checklist
          </h3>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground mr-1">
              {completedCount}/{totalCount}
            </span>

            <Select value={viewFilter} onValueChange={(v) => setViewFilter(v as typeof viewFilter)}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Habits</SelectItem>
                <SelectItem value="incomplete">Incomplete</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            {categories.length > 1 && (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* List */}
        {activeHabits.length === 0 ? (
          <Card className="py-10">
            <CardContent className="flex flex-col items-center gap-2">
              <span className="text-3xl">📋</span>
              <p className="text-sm text-muted-foreground">
                No active habits yet. Go to Habit Master to create some!
              </p>
            </CardContent>
          </Card>
        ) : filteredHabits.length === 0 ? (
          <Card className="py-10">
            <CardContent className="flex flex-col items-center gap-2">
              <span className="text-3xl">
                {viewFilter === 'completed' ? '🏁' : '✅'}
              </span>
              <p className="text-sm text-muted-foreground">
                {viewFilter === 'completed'
                  ? 'No completed habits yet.'
                  : viewFilter === 'incomplete'
                    ? 'All habits completed — great job!'
                    : 'No habits match this filter.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="max-h-[480px] overflow-y-auto custom-scrollbar">
              {filteredHabits.map((habit, idx) => {
                const done = !!completionMap[habit.id];
                const isToggling = togglingIds.has(habit.id);
                const doneTime = done ? completedAtMap[habit.id] : null;
                const isLate = doneTime && habit.targetTime && doneTime > habit.targetTime;
                const isOnTarget = doneTime && habit.targetTime && doneTime <= habit.targetTime;
                return (
                  <div
                    key={habit.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-accent/50',
                      idx < filteredHabits.length - 1 && 'border-b border-border/50',
                    )}
                  >
                    {/* Checkbox */}
                    <Checkbox
                      checked={done}
                      onCheckedChange={() => handleHabitCheck(habit)}
                      disabled={isToggling}
                      className={cn(
                        'shrink-0 transition-colors duration-200',
                        done &&
                          'data-[state=checked]:bg-primary data-[state=checked]:border-primary',
                      )}
                    />

                    {/* Icon */}
                    <span className="text-lg shrink-0 w-7 text-center leading-none">
                      {habit.icon}
                    </span>

                    {/* Name */}
                    <span
                      className={cn(
                        'flex-1 text-sm font-medium min-w-0 truncate transition-all duration-200',
                        done && 'line-through text-muted-foreground',
                      )}
                    >
                      {habit.name}
                    </span>

                    {/* Time display */}
                    {doneTime ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setAnalysisHabitId(habit.id); }}
                        className={cn(
                          'shrink-0 text-xs font-medium tabular-nums flex items-center gap-0.5 rounded-md px-1.5 py-0.5 hover:bg-accent transition-colors',
                          isOnTarget && 'text-emerald-600 dark:text-emerald-400',
                          isLate && 'text-red-500 dark:text-red-400',
                          !habit.targetTime && 'text-muted-foreground',
                        )}
                        title={habit.targetTime ? `Target: ${habit.targetTime}. Klik untuk lihat analisis.` : 'Klik untuk lihat analisis.'}
                      >
                        <Clock className="h-3 w-3" />
                        {doneTime}
                        {isOnTarget && ' ⭐'}
                        {isLate && ` +${timeDiffMinutes(doneTime, habit.targetTime!)}m`}
                      </button>
                    ) : null}

                    {/* Track time indicator (not done) */}
                    {!done && habit.trackTime && (
                      <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                    )}

                    {/* Category badge (hidden on small screens) */}
                    <Badge
                      variant="secondary"
                      className={cn(
                        'hidden sm:inline-flex text-[10px] px-1.5 py-0 h-5',
                        getBadgeClass(categoryMap[habit.category]?.color || 'gray'),
                      )}
                    >
                      {habit.category}
                    </Badge>

                    {/* Priority dot */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full',
                          getDotClass(priorityMap[habit.priority]?.color || 'gray'),
                        )}
                        title={habit.priority}
                      />
                      <span className="text-[10px] text-muted-foreground hidden lg:inline">
                        {habit.priority}
                      </span>
                    </div>

                    {/* Streak / total completions */}
                    <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
                      <Flame className="h-3.5 w-3.5 text-orange-400" />
                      <span className="text-xs font-medium tabular-nums">
                        {habit._count.logs}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </section>

      {/* ────────────────────────── Summary Footer ────────────────────────── */}
      {totalCount > 0 && (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/5 border-primary/20 py-4">
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Completion */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  <Check className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums text-primary">
                    {completionPct}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {completedCount} of {totalCount} habits
                  </p>
                </div>
              </div>

              {/* XP */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40">
                  <Star className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
                    +{todayXP} XP
                  </p>
                  <p className="text-xs text-muted-foreground">Earned today</p>
                </div>
              </div>

              {/* Level */}
              <div className="flex-1 min-w-[140px]">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-semibold">Lv. {level}</span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {levelProgress}/100 XP
                  </span>
                </div>
                <Progress value={levelProgress} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Time Confirmation Dialog ── */}
      <Dialog open={!!timeDialogHabit} onOpenChange={(open) => !open && setTimeDialogHabit(null)}>
        <DialogContent className="sm:max-w-md">
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

            {/* Option 1: Now */}
            <button
              type="button"
              onClick={() => handleTimeDialogSubmit(true)}
              disabled={timeSubmitting}
              className="w-full flex items-center gap-3 rounded-lg border-2 border-primary/30 bg-primary/5 p-3 text-left hover:border-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              <Clock className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Sekarang</p>
                <p className="text-xs text-muted-foreground">
                  {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center">
              <span className="text-xs text-muted-foreground bg-background px-2 z-10">atau isi manual</span>
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
            </div>

            {/* Manual input */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Tanggal</label>
                  <Input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Jam</label>
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
                className="w-full bg-primary hover:bg-primary text-white"
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

function LoadingSkeleton() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Date nav */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-md" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="py-4 gap-3">
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
              <Skeleton className="h-4 w-24 mx-auto" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Notes */}
      <Card className="py-4 gap-3">
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-16 w-full rounded-md" />
        </CardContent>
      </Card>

      {/* Habit list header */}
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-[120px] rounded-md" />
          <Skeleton className="h-8 w-[130px] rounded-md" />
        </div>
      </div>

      {/* Habit rows */}
      <Card className="overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0"
          >
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-5 w-16 rounded-full ml-auto" />
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-3 w-6" />
          </div>
        ))}
      </Card>

      {/* Summary */}
      <Card className="py-4">
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="flex-1 space-y-2 ml-auto">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}