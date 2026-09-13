'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import {
 DndContext,
 closestCenter,
 KeyboardSensor,
 PointerSensor,
 TouchSensor,
 useSensor,
 useSensors,
 type DragEndEvent,
} from '@dnd-kit/core';
import {
 SortableContext,
 sortableKeyboardCoordinates,
 arrayMove,
 rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useAppStore } from '@/store/app-store';
import { jakartaNowIso, jakartaNowParts, dateFromYMD } from '@/lib/timezone';
import { Button } from '@/components/ui/button';
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import TimeAnalysisDialog from '@/components/habit-tracker/time-analysis';
import { TimePicker } from '@/components/habit-tracker/time-picker';
import { useHabitOptions } from '@/hooks/use-habit-options';
import { useThemeColor } from '@/hooks/use-theme-color';
import { jakartaDateString } from '@/lib/jakarta-date';
import { xpForHabit } from '@/lib/dashboard-helpers';
import { THEME_PRESETS } from '@/lib/theme-utils';
import {
 burstFromElement,
 milestoneForStreak,
} from '@/lib/confetti';
import {
 getDaysInMonth,
 getDate,
} from '@/lib/date-utils';
// PERF-FIX (FIX-TIER3 / Fix 15): replaced `date-fns` with native Intl-based
// utility module. Output is identical for the patterns and helpers used
// here — verified via test script in worklog FIX-TIER3 entry.
import { toast } from 'sonner';
import { Clock, GripVertical, NotebookPen, ClipboardList, CheckCircle2, Flag, Plus, Sprout, X, CalendarDays } from 'lucide-react';

import type { Habit, HabitLog } from './daily-tracker-types';
import {
 toDateString,
 formatJakartaTime,
 computeStreak,
 shiftYmdKey,
 prevMonthKey,
 groupBatchLogs,
 saveDailyLog,
 htmlToPlainText,
} from './daily-tracker-helpers';
import { DateNav } from './daily-tracker-date-nav';
import { DailySummary } from './daily-tracker-daily-summary';
import { HabitCard } from './daily-tracker-habit-card';
import { SortableHabitCard } from './daily-tracker-sortable-card';
import { LoadingSkeleton } from './daily-tracker-skeleton';
import { DailyCheckInCard } from './daily-check-in-card';
// Task 37 — Jadwal Tampil: habit mingguan/bulanan hanya muncul di hari
// terjadwalnya (grid, KPI harian, streak, banner kembali mengikuti).
import {
  isScheduledOn,
  nextScheduledYmd,
  nextOccurrenceLabel,
  parseSchedule,
} from '@/lib/habit-schedule';

// Calendar merged into Tracker as sub-tab (nav 6 → 5)
const CalendarView = dynamic(() => import('./calendar-view'), { ssr: false });

// PHASE4-POLISH: TipTap rich text editor for the daily notes. Loaded with
// ssr:false because TipTap pokes at the DOM during initial render (it needs
// document.execCommand + contenteditable), and Next.js's SSR pass would
// crash without a real browser. The dynamic import also keeps the TipTap
// bundle (~80kb gzipped) out of the initial JS for users who never open
// the daily tracker tab.
const RichNotesEditor = dynamic(
 () => import('./rich-notes-editor').then((m) => m.RichNotesEditor),
 {
   ssr: false,
   loading: () => <div className="min-h-[112px] rounded-md bg-muted/30" />,
 },
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Bentuk payload GET /api/daily-logs?date= (null bila belum ada row). */
type DailyLogPayload = {
  notes: string | null;
  date?: string;
  mood?: number;
  energy?: number;
  sleep?: number;
} | null;

export default function DailyTracker() {
 const selectedDate = useAppStore((s) => s.selectedDate);
 const setSelectedDate = useAppStore((s) => s.setSelectedDate);
 const refreshKey = useAppStore((s) => s.refreshKey);
 // ONE-CLICK-5: used by the tracker empty-state CTA ("Buat Habit Pertama")
 // to open the add-habit dialog directly, same flow as the FAB.
 const setActiveTab = useAppStore((s) => s.setActiveTab);
 const triggerQuickAdd = useAppStore((s) => s.triggerQuickAdd);
 // Task 36: dipakai handler wisuda (graduation) untuk memaksa refresh
 // tracker + dashboard setelah habit resmi lulus.
 const triggerRefresh = useAppStore((s) => s.triggerRefresh);
 const queryClient = useQueryClient();
 // Opsi label habit (kategori/prioritas/difficulty) — query tunggal; peta
 // kategori diturunkan lokal (bobot XP langsung dari lib/dashboard-helpers).
 const { data: habitOptions = [] } = useHabitOptions();
 const { themeColor } = useThemeColor();
 const categoryMap = useMemo(() => {
   const map: Record<string, { label: string; color?: string | null }> = {};
   for (const opt of habitOptions) {
     if (opt.type === 'category') map[opt.label] = opt;
   }
   return map;
 }, [habitOptions]);
 // Warna primer aktif (hex preset tema) untuk kartu habit.
 const primaryColor = useMemo(
   () =>
     THEME_PRESETS.find((p) => p.id === themeColor)?.primary ??
     THEME_PRESETS[0].primary,
   [themeColor],
 );

 // ---- state ----
 const [loading, setLoading] = useState(true);
 const [completionMap, setCompletionMap] = useState<Record<string, boolean>>({});
 const [notes, setNotes] = useState('');
 const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
 const [viewFilter, setViewFilter] = useState<'all' | 'incomplete' | 'completed'>('all');
 const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(new Set());
 // Calendar merge: toggle between 'today' (habit grid) and 'history' (calendar)
 // ONE-CLICK-3: viewMode lifted to the global store — survives tab switches,
 // AND lets other components (calendar day tap, dashboard jumps) switch the
 // tracker into grid mode from outside.
 const viewMode = useAppStore((s) => s.trackerViewMode);
 const setViewMode = useAppStore((s) => s.setTrackerViewMode);

 // ---- time dialog state ----
 const [timeDialogHabit, setTimeDialogHabit] = useState<Habit | null>(null);
 const [manualDate, setManualDate] = useState('');
 const [manualTime, setManualTime] = useState('');
 const [timeSubmitting, setTimeSubmitting] = useState(false);

 // ---- completedAt display map ----
 const [completedAtMap, setCompletedAtMap] = useState<Record<string, string>>({});

 // ---- GELOMBANG 1: nilai amount per habit (habitType 'amount') ----
 const [amountValueMap, setAmountValueMap] = useState<Record<string, number>>({});

 // ---- time analysis dialog ----
 const [analysisHabitId, setAnalysisHabitId] = useState<string | null>(null);

 // ONE-CLICK-1: consume the global habit focus (set by openHabitFocus anywhere
 // in the app — dashboard rows, calendar, weekly review, …). Opens the
 // TimeAnalysisDialog for the focused habit immediately after the tracker
 // tab mounts, then clears the ephemeral focus (same consume-and-clear
 // pattern as quickAddAction; latest-ref indirection like use-finance-mutations).
 const focusHabitId = useAppStore((s) => s.focusHabitId);
 const clearHabitFocus = useAppStore((s) => s.clearHabitFocus);
 // ONE-CLICK-1: openAnalysis is a stable useCallback (empty deps), so the
 // effect can depend on it directly — no render-phase ref write needed
 // (react-hooks/refs compliant; migrated from the old latest-ref pattern
 // per worklog note when this block was touched).
 const openAnalysis = useCallback((id: string) => setAnalysisHabitId(id), []);
 useEffect(() => {
   if (focusHabitId) {
     openAnalysis(focusHabitId);
     clearHabitFocus();
   }
 }, [focusHabitId, clearHabitFocus, openAnalysis]);

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
 // M5: flag anti spam toast guard catatan tanggal future — toast standar
 // cukup sekali per kunjungan tanggal future (reset saat kembali ke tanggal
 // yang valid).
 const futureToastRef = useRef(false);

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

 // PERF-REACT-1 (pola sama): mirror amountValueMap agar handleAmountDelta
 // membaca nilai terbaru tanpa memasukkannya ke deps useCallback.
 const amountValueMapRef = useRef(amountValueMap);
 useEffect(() => {
   amountValueMapRef.current = amountValueMap;
 }, [amountValueMap]);

 // ---- TanStack Query: habits, daily-log ----
 const { data: queryHabits = [] } = useQuery<Habit[]>({
   queryKey: ['habits'],
   queryFn: async () => {
     const res = await fetch('/api/habits');
     if (!res.ok) throw new Error('Gagal memuat habits');
     const json = (await res.json()) as { habits?: Habit[] };
     return json.habits ?? [];
   },
   staleTime: 30_000,
 });

 // PHASE4-POLISH: drag-to-reorder support. When the user reorders habits via
 // the @dnd-kit drag handle, we apply the new order optimistically via a
 // local override. The override is cleared after the server confirms (PUT
 // succeeds + query refetch). While `localHabitsOverride` is set, it
 // shadows the query data so the UI reflects the new order immediately.
 const [dragMode, setDragMode] = useState(false);
 const [localHabitsOverride, setLocalHabitsOverride] = useState<Habit[] | null>(null);
 const habits = localHabitsOverride ?? queryHabits;

 const { data: dailyLogData } = useQuery<DailyLogPayload>({
   queryKey: ['daily-logs', selectedDate],
   queryFn: async () => {
     const res = await fetch(`/api/daily-logs?date=${selectedDate}`);
     if (!res.ok) return null;
     return res.json();
   },
   staleTime: 15_000,
 });

 // ── H2-fix (b): flush patch catatan tertunda ──────────────────────────
 // Saat selectedDate berubah, patch tertunda tanggal LAMA di-flush dulu
 // (fire-and-forget fetch keepalive) SEBELUM state debounce dibersihkan —
 // patch tanggal lama tidak hilang dan tidak menimpa catatan tanggal baru.
 // Tanpa ini ada race: timer lama masih aktif saat data tanggal baru tiba
 // (cache react-query bisa fresh) → guard "debounce aktif" di efek sinkron
 // notes melewatkan sinkronisasi → textarea kosong → 1 ketikan menimpa
 // catatan tersimpan (DATA-LOSS H2).
 // Cache ['daily-logs', tanggal lama] diperbarui optimistik supaya kembali
 // cepat ke tanggal itu (< staleTime 15s) tetap menampilkan draft.
 const flushPendingSave = useCallback(() => {
   if (saveTimerRef.current) {
     clearTimeout(saveTimerRef.current);
     saveTimerRef.current = null;
   }
   const pending = pendingSaveRef.current;
   if (!pending) return;
   pendingSaveRef.current = null;
   queryClient.setQueryData<DailyLogPayload>(
     ['daily-logs', pending.date],
     (old) =>
       old
         ? { ...old, date: pending.date, notes: pending.notes ?? old.notes ?? null }
         : { date: pending.date, notes: pending.notes ?? null },
   );
   void saveDailyLog(pending, { keepalive: true })
     .then((res) => {
       // Konfirmasi server → tandai stale supaya observasi berikutnya
       // refetch (kebenaran akhir tetap di server).
       if (res.ok) {
         queryClient.invalidateQueries({ queryKey: ['daily-logs', pending.date] });
       }
     })
     .catch(() => {
       /* swallow — fire-and-forget, kegagalan akan terlihat saat refetch */
     });
 }, [queryClient]);

 // Dideklarasikan SEBELUM efek sinkron notes agar pada commit ganti tanggal
 // timer lama sudah bersih ketika guard sinkron membaca saveTimerRef.
 useEffect(() => {
   flushPendingSave();
 }, [selectedDate, flushPendingSave]);

 // keepPreviousData (global QueryClient default) means that right after a
 // date switch `dailyLogData` still holds the PREVIOUS date's log until the
 // new one arrives. Applying it unconditionally showed (and let the user
 // edit + auto-save) day A's notes under day B's header. Gate on the
 // response's own date and clear while the correct day is still loading.
 // GELOMBANG 1: refetch tanggal yang sama dipicu simpanan check-in/notes
 // (invalidate ['daily-logs', date]) — jangan menimpa draft yang sedang
 // diketik (debounce aktif) dengan nilai server yang lebih lama; draft
 // tersimpan oleh debounce lalu sinkron kembali lewat refetch berikutnya.
 useEffect(() => {
   const dataDate = dailyLogData?.date?.slice(0, 10);
   if (dataDate === selectedDate && saveTimerRef.current) return;
   if (!dailyLogData || dataDate === selectedDate) {
     // GELOMBANG 1: notes lama berformat HTML (era TipTap) dibersihkan
     // jadi teks polos — editor kini textarea controlled.
     setNotes(htmlToPlainText(dailyLogData?.notes || ''));
   } else {
     setNotes('');
   }
 }, [dailyLogData, selectedDate]);

 // GELOMBANG 1: nilai check-in (mood/energi/tidur) — digate pada tanggal
 // yang cocok (anti stale keepPreviousData, pola worklog 6-c).
 const checkInValue = useMemo(() => {
   if (!dailyLogData) return null;
   const dataDate = dailyLogData.date?.slice(0, 10);
   if (dataDate && dataDate !== selectedDate) return null;
   return {
     mood: dailyLogData.mood ?? 3,
     energy: dailyLogData.energy ?? 3,
     sleep: dailyLogData.sleep ?? 7,
   };
 }, [dailyLogData, selectedDate]);

 // ---- derived ----
 // STREAK-TZ-class fix (versi date-utils UTC): seluruh pembaca komponen di
 // bawah (format 'EEEE'/'MMMM d' DateNav, getDate, getDaysInMonth) memakai
 // komponen UTC dari lib/date-utils — maka dateObj HARUS UTC-midnight dari
 // komponen YMD (dateFromYMD). Konstruksi local-midnight (date-fns era lama)
 // akan meleset sehari di browser non-UTC; parseISO+format lokal lebih buruk.
 const dateObj = useMemo(() => dateFromYMD(selectedDate), [selectedDate]);
 const dayOfMonth = getDate(dateObj);
 const daysInMonth = getDaysInMonth(dateObj);
 // BUG-7 fix: use jakartaDateString() (TZ-explicit) instead of
 // format(startOfDay(new Date()), 'yyyy-MM-dd') which reads the BROWSER's
 // local TZ. A user in UTC-8 viewing the app at 22:00 local would see
 // todayStr = "2025-01-15" while Jakarta is already 2025-01-16 — selecting
 // "Today" would jump to the wrong date.
 const todayStr = jakartaDateString();

 const activeHabits = useMemo(
   // Task 36: habit yang sudah LULUS keluar dari rotasi harian — tugasnya
   // selesai, bukan dihapus (masih terlihat di Habit Master + XP tetap).
   () => habits.filter((h) => h.isActive && !h.isArchived && !h.graduatedAt),
   [habits],
 );

 // Task 37 — Jadwal Tampil: habit hanya muncul di hari terjadwalnya.
 // `activeHabits` tetap memuat SEMUA habit aktif (semesta XP & batas
 // kandidat); grid + KPI harian (X/Y, persentase) memakai `scheduledHabits`
 // supaya "4/10" tidak dihitung dari habit yang memang tidak dijadwalkan
 // hari ini.
 const scheduledHabits = useMemo(
   () => activeHabits.filter((h) => isScheduledOn(parseSchedule(h.scheduleJson), selectedDate)),
   [activeHabits, selectedDate],
 );

 // Info "kapan habit tersembunyi muncul lagi" untuk empty-state hari tanpa
 // jadwal (dihitung dari habit aktif yang TIDAK terjadwal hari ini).
 const nextOccurrences = useMemo(() => {
   const out: { id: string; name: string; emoji: string; label: string }[] = [];
   for (const h of activeHabits) {
     const sched = parseSchedule(h.scheduleJson);
     if (sched.kind === 'daily') continue;
     if (isScheduledOn(sched, selectedDate)) continue;
     const next = nextScheduledYmd(sched, selectedDate);
     if (!next) continue;
     const lbl = nextOccurrenceLabel(sched, next);
     if (!lbl) continue;
     out.push({ id: h.id, name: h.name, emoji: h.emoji, label: lbl });
   }
   return out.slice(0, 3);
 }, [activeHabits, selectedDate]);

 const filteredHabits = useMemo(() => {
   let list = scheduledHabits;
   if (viewFilter === 'completed')
     // PHASE3-HABIT: "Selesai" filter shows habits where the user succeeded
     // today. For avoid habits, success = NOT checked (no relapse).
     list = list.filter((h) => {
       const checked = !!(completionMap[h.id] ?? false);
       const success = h.habitType === 'avoid' ? !checked : checked;
       return success;
     });
   if (viewFilter === 'incomplete')
     // PHASE1-HABIT: vacation habits don't count as "incomplete" — they're
     // paused, not missed. Exclude them so the "Belum" filter never shows
     // vacationing habits.
     // PHASE3-HABIT: "Belum" filter shows habits where the user hasn't yet
     // succeeded today. For avoid habits, "not yet succeeded" = checked
     // (relapsed today).
     list = list.filter((h) => {
       const checked = !!(completionMap[h.id] ?? false);
       const success = h.habitType === 'avoid' ? !checked : checked;
       return !success && !h.vacationMode;
     });
   return list;
 }, [scheduledHabits, completionMap, viewFilter]);

 // PHASE1-HABIT: vacation habits don't count toward today's completion stats.
 // They're excluded from both completedCount and totalCount so the daily
 // summary's X/Y and percentage reflect only the habits the user is actually
 // expected to do today. Vacation habits still appear in the grid (with a
 // 🏖️ badge) when the "Semua" filter is active.
 // Task 37: semesta trackable = habit TERJADWAL tanggal itu (habit mingguan
 // tidak dijadwalkan hari ini tidak mengecilkan/membebani X/Y harian).
 const trackableHabits = useMemo(
   () => scheduledHabits.filter((h) => !h.vacationMode),
   [scheduledHabits],
 );

 // ── PHASE4-POLISH: drag-to-reorder (@dnd-kit) ──────────────────────────
 // Sensors + handlers are declared HERE (after `activeHabits` is defined)
 // because handleDragEnd's deps array references `activeHabits` directly —
 // moving them above would hit the temporal-dead-zone on the first render.
 // Sensors: PointerSensor (mouse), TouchSensor (mobile drag — required for
 // touch devices), KeyboardSensor (a11y). Activation constraints prevent
 // accidental drags when the user is just tapping a card to toggle it.
 const sensors = useSensors(
   useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
   useSensor(TouchSensor, {
     activationConstraint: { delay: 150, tolerance: 6 },
   }),
   useSensor(KeyboardSensor, {
     coordinateGetter: sortableKeyboardCoordinates,
   }),
 );

 const handleDragEnd = useCallback(
   async (event: DragEndEvent) => {
     const { active, over } = event;
     if (!over || active.id === over.id) return;
     const oldIndex = scheduledHabits.findIndex((h) => h.id === active.id);
     const newIndex = scheduledHabits.findIndex((h) => h.id === over.id);
     if (oldIndex < 0 || newIndex < 0) return;

     const reordered = arrayMove(scheduledHabits, oldIndex, newIndex);
     // Re-assign `order` so the new array position matches the DB order
     // (0..N-1 across active habits). Collect only the diffs to PUT.
     const updates: { id: string; sortOrder: number }[] = [];
     reordered.forEach((h, idx) => {
       if (h.sortOrder !== idx) updates.push({ id: h.id, sortOrder: idx });
     });

     // Optimistic local override: reordered active habits (with new order
     // field) followed by the unchanged paused/archived habits.
     const activeIds = new Set(reordered.map((h) => h.id));
     const nonActive = habits.filter((h) => !activeIds.has(h.id));
     const reorderedAll: Habit[] = [
       ...reordered.map((h, idx) => ({ ...h, sortOrder: idx })),
       ...nonActive,
     ];
     setLocalHabitsOverride(reorderedAll);

     // Persist each changed habit's order via PUT /api/habits/[id].
     // Fire-and-forget in parallel; invalidate the query on settle so the
     // server-side truth is re-fetched (and the local override cleared).
     try {
       await Promise.all(
         updates.map((u) =>
           fetch(`/api/habits/${u.id}`, {
             method: 'PUT',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ sortOrder: u.sortOrder }),
           }),
         ),
       );
       await queryClient.invalidateQueries({ queryKey: ['habits'] });
       // Brief delay so the refetch lands before we drop the override —
       // otherwise a re-render with the stale query cache could flicker
       // back to the old order for one frame.
       setTimeout(() => setLocalHabitsOverride(null), 200);
     } catch {
       toast.error('Gagal menyimpan urutan');
       // Revert to server truth.
       await queryClient.invalidateQueries({ queryKey: ['habits'] });
       setLocalHabitsOverride(null);
     }
   },
   [scheduledHabits, habits, queryClient],
 );

 /** Toggle drag mode. When enabling, force viewFilter to "all" so every
  *  active habit is visible for reordering. When disabling, drop the
  *  optimistic override (any pending server update is left to complete —
  *  the next habits refetch will surface the truth). */
 const toggleDragMode = useCallback(() => {
   if (!dragMode) {
     setViewFilter('all');
     setDragMode(true);
   } else {
     setDragMode(false);
     setLocalHabitsOverride(null);
   }
 }, [dragMode]);
 // PHASE3-HABIT — for "avoid" habits, "success today" means NO relapse
 // (i.e. completionMap[h.id] is false). For "normal" + "amount" habits,
 // success = completionMap[h.id] is true. This derived flag drives the
 // daily summary's completedCount / completionPct / todayXP / bestStreak
 // so an avoid habit that wasn't checked today counts as a success.
 const isSuccess = useCallback(
   (h: Habit) => {
     const checked = !!(completionMap[h.id] ?? false);
     if (h.habitType === 'avoid') return !checked;
     return checked;
   },
   [completionMap],
 );
 const completedCount = trackableHabits.filter((h) => isSuccess(h)).length;
 const totalCount = trackableHabits.length;
 const completionPct =
   totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

 const todayXP = useMemo(() => {
   // M1-fix (semantik XP == dashboard): SETIAP log completed memberi XP apa
   // pun habitType-nya — termasuk habit 'avoid' yang dicatat kambuh, persis
   // seperti agregasi todayXp /api/dashboard (log completed mentah × bobot).
   // "Selesai X/Y" & persentase tetap memakai isSuccess (avoid sukses =
   // TIDAK kambuh); universe habit juga disamakan dengan dashboard (semua
   // habit aktif, tanpa filter libur) supaya angka XP tidak berbeda aturan hitung.
   return activeHabits.reduce((sum, h) => {
     if (completionMap[h.id]) return sum + xpForHabit(h);
     return sum;
   }, 0);
 }, [activeHabits, completionMap]);

 // GELOMBANG 1: XP TOTAL all-time — Level TIDAK lagi reset harian.
 // Sumber: completedLogCount per habit dari /api/habits × bobot difficulty
 // (lib) — agregat yang sama dengan kpi.totalXp /api/dashboard.
 const totalXp = useMemo(
   () => habits.reduce((sum, h) => sum + (h.completedLogCount ?? 0) * xpForHabit(h), 0),
   [habits],
 );

 // ── Task 36: Banner Kembali (anti-nunda) ─────────────────────────────
 // Tipe "sering nunda" paling rapuh justru di hari KEMBALI: rasa bersalah
 // membuat menghindari aplikasi. Banner menyambut TANPA menghukum +
 // menawarkan SATU habit paling ringan untuk dicentang sekarang (tombol
 // 1-ketuk, confetti dari tombol). Syarat: sedang melihat hari ini, belum
 // ada kemenangan hari ini, dan selesai terakhir ≥ 2 hari lalu — atau
 // tidak ketemu di jendela cache 2 bulan padahal totalnya pernah ada.
 const [comebackHidden, setComebackHidden] = useState(false);
 useEffect(() => {
   try {
     setComebackHidden(window.sessionStorage.getItem('rutina-comeback') === todayStr);
   } catch {
     /* mode privat — anggap belum disembunyikan */
   }
 }, [todayStr]);
 const hideComeback = useCallback(() => {
   setComebackHidden(true);
   try {
     window.sessionStorage.setItem('rutina-comeback', todayStr);
   } catch {
     /* mode privat — cukup sembunyikan di state */
   }
 }, [todayStr]);
 const comeback = useMemo(() => {
   if (selectedDate !== todayStr) return null;
   // Menang pasif TIDAK menutup banner: habit 'avoid' bersih hari ini tidak
   // butuh usaha apa pun — kalau tidak ada habit normal/amount yang dicentang
   // hari ini, orangnya belum MELAKUKAN apa-apa → sapaan tetap relevan.
   const hasActiveWinToday = trackableHabits.some(
     (h) => h.habitType !== 'avoid' && !!(completionMap[h.id] ?? false),
   );
   if (hasActiveWinToday) return null;
   if (activeHabits.length === 0) return null;
   const everDone = habits.some((h) => (h.completedLogCount ?? 0) > 0);
   if (!everDone) return null; // pemula — belum ada "kembali"
   // Selesai terakhir dalam jendela cache ±2 bulan (cache bulan berjalan
   // menyimpan gabungan prev+current — lihat M4-fix di fetchCompletions).
   const cache = monthLogsCacheRef.current[todayStr.slice(0, 7)];
   let last = '';
   if (cache) {
     for (const logs of Object.values(cache)) {
       for (const l of logs) {
         if (!l.completed) continue;
         const ymd = toDateString(l.date);
         if (ymd <= todayStr && ymd > last) last = ymd;
       }
     }
   }
   const gapDays = last
     ? Math.round((dateFromYMD(todayStr).getTime() - dateFromYMD(last).getTime()) / 86_400_000)
     : 99; // tidak ketemu di 2 bulan → gap panjang, tetap sambut
   if (gapDays < 2) return null;
   // Saran mulai: habit normal/amount TERJADWAL hari ini yang belum
   // selesai & tidak libur — prioritas kesulitan paling ringan (Easy/Mudah).
   // Habit 'avoid' TIDAK ditawarkan (tombolnya menandai kambuh, bukan
   // kemenangan). Task 37: kandidat hanya habit yang memang jadwalnya hari
   // ini — hari tanpa jadwal apa pun tidak menawarkan apa pun (banner
   // otomatis tidak muncul karena candidates kosong).
   const candidates = scheduledHabits.filter(
     (h) => h.habitType !== 'avoid' && !h.vacationMode && !(completionMap[h.id] ?? false),
   );
   if (candidates.length === 0) return null;
   const easy = candidates.filter((h) => h.difficulty === 'Easy' || h.difficulty === 'Mudah');
   const pick = (easy.length > 0 ? easy : candidates)[0];
   return { gapDays, pick };
 }, [selectedDate, todayStr, trackableHabits, scheduledHabits, habits, completionMap]);

 // Best current streak across all active habits
 const bestStreak = useMemo(() => {
   const month = selectedDate.slice(0, 7);
   const cache = monthLogsCacheRef.current[month];
   if (!cache) return 0;
   let best = 0;
   for (const h of activeHabits) {
     const logs = cache[h.id] || [];
     // PHASE1-HABIT: pass vacationMode so vacationing habits' streaks don't
     // break during the pause.
     // PHASE3-HABIT: pass invert + startDate for "avoid" habits so the
     // streak counts consecutive days WITHOUT a relapse.
     // Task 37: pass schedule so non-scheduled days don't break the chain.
     const s = computeStreak(logs, selectedDate, {
       onVacation: !!h.vacationMode,
       invert: h.habitType === 'avoid',
       startDate: h.startDate,
       schedule: parseSchedule(h.scheduleJson),
     });
     if (s > best) best = s;
   }
   return best;
 }, [activeHabits, selectedDate, completionMap]);

 // ---- fetch completions (month-cached) ----
 // BUGHUNT-ROUND2 RACE-1: `isCancelled` guard (passed by the loading
 // effect) prevents a SLOWER stale fetch (e.g. for the previous date/
 // month after rapid navigation) from overwriting the state of the
 // NEWER fetch that already resolved. Previously only `setLoading` was
 // guarded — the completion maps could be painted with the wrong day's
 // data.
 const fetchCompletions = async (
   habitList: Habit[],
   date: string,
   isCancelled?: () => boolean,
 ) => {
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
     const valueMap: Record<string, number> = {};
     habitList
       // Task 36: habit lulus tidak diambil/tidak masuk peta completion.
      .filter((h) => h.isActive && !h.isArchived && !h.graduatedAt)
       .forEach((h) => {
         const logs = cache[h.id] || [];
         const dayLog = logs.find((l) => toDateString(l.date) === date);
         map[h.id] = dayLog?.completed ?? false;
         valueMap[h.id] = dayLog?.value ?? 0;
         if (dayLog?.completedAt) {
           atMap[h.id] = formatJakartaTime(dayLog.completedAt);
         }
       });
     setCompletionMap(map);
     setCompletedAtMap(atMap);
     setAmountValueMap(valueMap);
     return;
   }

   // Task 36: habit lulus keluar dari batch fetch log (tidak dipakai UI).
  const active = habitList.filter((h) => h.isActive && !h.isArchived && !h.graduatedAt);
   const ids = active.map((h) => h.id);

   // M4-fix (streak & flip-card terpotong batas bulan): cache hanya bulan
   // tampil membuat streak putus di hari 1 bulan + flip 7 hari menandai log
   // bulan lalu sebagai miss. Solusi: log bulan SEBELUMNYA ikut diambil
   // (query paralel; keduanya sekali per bulan karena berbasis cache) lalu
   // cache bulan berjalan MENYIMPAN GABUNGAN prev+current — seluruh
   // konsumen (computeStreak, bestStreak, flip 7 hari) membaca cache seperti
   // biasa tanpa perubahan. Catatan batas: streak > ±2 bulan tetap terpotong
   // (hanya 2 bulan yang diambil) — kompromi yang disengaja demi hemat query.
   const prevMonth = prevMonthKey(month);
   let groupedLogs: Record<string, HabitLog[]> = {};
   let groupedPrevLogs: Record<string, HabitLog[]> = {};
   try {
     const [res, prevRes] = await Promise.all([
       fetch(`/api/habits/batch-logs?month=${month}&ids=${ids.join(',')}`),
       fetch(`/api/habits/batch-logs?month=${prevMonth}&ids=${ids.join(',')}`),
     ]);
     if (res.ok) {
       // Normalisasi bentuk payload ({ logs } flat / grouped lama) ada di
       // helper groupBatchLogs (daily-tracker-helpers).
       groupedLogs = groupBatchLogs(await res.json());
     }
     if (prevRes.ok) {
       groupedPrevLogs = groupBatchLogs(await prevRes.json());
     }
   } catch {
     // fall through to empty defaults
   }

   // RACE-1: a newer fetch may have resolved while this one was in flight.
   // Bailing here avoids: (a) painting stale completion maps over the
   // current date's state, (b) flipping cachedMonthRef back to the stale
   // month (which would only cost a redundant re-fetch later, but still).
   if (isCancelled?.()) return;

   const monthCache: Record<string, HabitLog[]> = {};
   const map: Record<string, boolean> = {};
   const atMap: Record<string, string> = {};
   const valueMap: Record<string, number> = {};

   active.forEach((habit) => {
     const logs = groupedLogs[habit.id] || [];
     // M4: gabungan prev+current — prev dulu supaya terurut kronologis.
     monthCache[habit.id] = [...(groupedPrevLogs[habit.id] ?? []), ...logs];
     const dayLog = logs.find((l) => toDateString(l.date) === date);
     map[habit.id] = dayLog?.completed ?? false;
     valueMap[habit.id] = dayLog?.value ?? 0;
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
   setAmountValueMap(valueMap);
 };

 // ---- debounced save (notes only) ----
 const debouncedSave = useCallback(
   (patch: { notes?: string }) => {
     // M5-fix (catatan tanggal future): guard SEBELUM draft menjadi patch —
     // tanpa ini mengetik di tanggal future membuat DailyLog phantom + mood
     // marker kalender muncul di hari future (server daily-logs memang tidak
     // punya guard tanggal). Toast cukup sekali per kunjungan tanggal future.
     if (selectedDate > todayStr) {
       if (!futureToastRef.current) {
         futureToastRef.current = true;
         toast.error('Tidak bisa mencatat untuk tanggal yang akan datang');
       }
       return;
     }
     futureToastRef.current = false;
     if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
     // BUG-19 fix: stash the pending patch (with the current selectedDate)
     // so the unmount handler can fire-and-forget it. Previously the timer
     // was just cancelled on unmount, losing the last <600ms of typing.
     pendingSaveRef.current = { date: selectedDate, ...patch };
     const timer = setTimeout(async () => {
       const pending = pendingSaveRef.current;
       pendingSaveRef.current = null;
       if (!pending) return;
       try {
         // Kontrak API: PUT partial-safe (fallback POST bila 405).
         const res = await saveDailyLog(pending);
         if (!res.ok) throw new Error(`HTTP ${res.status}`);
         queryClient.invalidateQueries({ queryKey: ['daily-logs', pending.date] });
       } catch {
         toast.error('Gagal menyimpan catatan');
       } finally {
         // H2-fix (a): reset saveTimerRef SETELAH timer ini selesai (termasuk
         // save in-flight) — tanpa ini nilai timer lama (truthy) menggantung
         // selamanya, guard "debounce aktif" di efek sinkron notes memblokir
         // server→state selamanya → ganti tanggal = textarea kosong & 1
         // ketikan menimpa catatan tersimpan. Dijaga dengan pembanding
         // `=== timer` supaya finally timer LAMA tidak membatalkan ref timer
         // BARU yang dijadwalkan flush tanggal / ketikan berikutnya.
         if (saveTimerRef.current === timer) saveTimerRef.current = null;
       }
     }, 600);
     saveTimerRef.current = timer;
   },
   [selectedDate, todayStr, queryClient],
 );

 const handleNotesChange = useCallback(
   (html: string) => {
     setNotes(html);
     debouncedSave({ notes: html });
   },
   [debouncedSave],
 );

 // PHASE4-POLISH: visible-text length for the "X karakter" hint. The stored
 // notes are now HTML (TipTap), so the raw string length includes <p>/<ul>
 // tags etc. — which would be misleading. Strip tags to get the user-visible
 // length. Returns 0 for empty/whitespace-only content.
 const notesCharCount = useMemo(() => {
   if (!notes) return 0;
   // Quick + dirty tag stripper — sufficient for the count display only.
   // (For rendering, the TipTap editor handles its own HTML safely.)
   return notes.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim().length;
 }, [notes]);

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
   async (habit: Habit, completedAt: string | null, dateOverride?: string) => {
     const habitId = habit.id;
     // M2-fix (tanggal manual diabaikan): dialog waktu membangun completedAt
     // dari manualDate, tapi dulu POST selalu memakai selectedDate → log masuk
     // hari salah. Tanggal manual kini diteruskan sebagai override (default:
     // selectedDate). String kosong dianggap tidak ada override.
     const logDate = dateOverride || selectedDate;
     const isViewDate = logDate === selectedDate;
     // Optimi UI hanya relevan untuk tanggal yang sedang DILIHAT — log manual
     // untuk hari lain tidak boleh mengubah checkbox hari ini. Jalur dialog
     // (satu-satunya sumber override) selalu "menyelesaikan" habit.
     const next = isViewDate
       ? !(completionMapRef.current[habitId] ?? false)
       : true;

     if (isViewDate) {
       setCompletionMap((p) => ({ ...p, [habitId]: next }));
     }
     setTogglingIds((p) => new Set(p).add(habitId));

     if (next && isViewDate) {
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
           // M2: tanggal log = tanggal manual (bila ada), bukan tanggal tampil.
           date: logDate,
           completed: next,
           completedAt: next ? completedAt : undefined,
         }),
       });
       if (!res.ok) {
         const errData = await res.json().catch(() => ({}));
         throw new Error(errData.error || `HTTP ${res.status}`);
       }
       // M3 (lanjutan): log hasil upsert dari server dipakai sebagai sumber
       // kebenaran cache/tampilan — untuk toggle SELESAI tanpa completedAt
       // eksplisit, server-lah yang mengisi completedAt (mirror create), jadi
       // UI "Selesai HH.mm" langsung akurat tanpa menunggu refetch.
       const savedLog = (await res.json().catch(() => null)) as HabitLog | null;
       const savedCompletedAt =
         next ? (savedLog?.completedAt ?? completedAt) : null;

       // update month cache — bulan & tanggal pakai logDate (M2); cache bulan
       // menyimpan gabungan prev+current (M4) sehingga update tanggal manual
       // tetap menemukan slot yang benar.
       const month = logDate.slice(0, 7);
       const cache = monthLogsCacheRef.current[month];
       if (cache) {
         const logs = cache[habitId] || [];
         const idx = logs.findIndex((l) => toDateString(l.date) === logDate);
         const entry = {
           id: savedLog?.id ?? '',
           habitId,
           // STREAK-TZ-class fix: local noon ("T12:00:00") lands on the
           // PREVIOUS Jakarta day on browsers west of UTC — the optimistic
           // cache entry was then mis-keyed by toDateString() (jakartaDateKey)
           // and the post-toggle streak/completion read one day off until a
           // refetch. UTC noon always maps to the same Jakarta day.
           date: new Date(logDate + 'T12:00:00Z').toISOString(),
           completed: next,
           value: savedLog?.value ?? 1,
           completedAt: savedCompletedAt,
         };
         if (idx >= 0) {
           logs[idx] = { ...logs[idx], ...entry };
         } else {
           logs.push(entry);
         }
       }

       if (isViewDate) {
         if (next && savedCompletedAt) {
           setCompletedAtMap((p) => ({
             ...p,
             [habitId]: formatJakartaTime(savedCompletedAt),
           }));
         } else {
           setCompletedAtMap((p) => {
             const np = { ...p };
             delete np[habitId];
             return np;
           });
         }
       }

       queryClient.invalidateQueries({ queryKey: ['habits'] });
       queryClient.invalidateQueries({ queryKey: ['dashboard'] });
       queryClient.invalidateQueries({ queryKey: ['habit-logs-batch'] });

       if (next) {
         // BUG-FIX-COMP-HIGH #1: For "avoid" habits (habitType === 'avoid'),
         // checking the box records a RELAPSE — not a success. Do NOT fire
         // the success toast, confetti burst, or milestone celebration here.
         // Show a gentle relapse message instead. Only normal/amount habits
         // get the success path below (toast.success + confetti + milestone).
         //
         // Captured as a local const before the branch so TS doesn't narrow
         // `habit.habitType` to `"normal" | "amount"` inside the else-arm
         // (which would make `habit.habitType === 'avoid'` an "unintentional
         // comparison" error TS2367).
         const isAvoid = habit.habitType === 'avoid';
         if (isAvoid) {
           toast.error('Kambuh tercatat. Jangan menyerah! 💪');
           confettiElRef.current = null;
         } else {
           toast.success('Habit selesai! 🎉');

           // ── Confetti — ONLY after successful API response ──
           // BUG-1 fix: the month cache was already mutated above (lines 619-636
           // in the original) to include today's completion, so computeStreak
           // already counts today. The previous `newStreak = currentStreak + 1`
           // double-counted today, firing milestone confetti (7/30/100/365) one
           // day early. Now `newStreak = currentStreak`.
           // BUG-18 fix: when no cache exists, return 0 (not _count.logs which
           // was the total log count — completely unrelated to a streak).
           // BUG-FIX-COMP-HIGH #2: pass the options object to computeStreak so
           // the streak is computed correctly for any habit type. For
           // normal/amount habits (the only ones reaching this branch — avoid
           // habits were short-circuited above) `invert` is false; the call
           // signature is still passed explicitly for safety and forward-
           // compatibility (so a future refactor that re-enables the success
           // path for avoid habits doesn't silently regress).
           const currentStreak = cache
             ? computeStreak(cache[habitId] || [], logDate, {
                 invert: isAvoid,
                 startDate: habit.startDate,
                 onVacation: !!habit.vacationMode,
                 schedule: parseSchedule(habit.scheduleJson),
               })
             : 0;
           const newStreak = currentStreak;
           const el = confettiElRef.current;

           const milestone = milestoneForStreak(newStreak);
           if (milestone) {
             // Milestone streak — burst rainbow besar dari elemen asal
             // (perayaan full-screen berbasis tier lama sudah tidak ada di
             // lib/confetti — burst ganda dipakai sebagai gantinya).
             burstFromElement(el, { count: 60, spread: 110, rainbow: true });
           } else {
             // Regular completion — burst from the clicked element
             burstFromElement(el, { count: 20 });
           }
           // Clear the ref so a future toggle-OFF doesn't reuse a stale element.
           confettiElRef.current = null;
         }
       }
     } catch (e) {
       // Rollback optimistik hanya untuk tanggal yang dilihat (M2) — log
       // manual hari lain tidak pernah mengubah state UI hari ini.
       if (isViewDate) {
         setCompletionMap((p) => ({ ...p, [habitId]: !next }));
       }
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

 // ── GELOMBANG 1: stepper habit amount ─────────────────────────────
 // Habit amount (habitType 'amount') dicatat sebagai value 0..target;
 // completed = value >= target. completedAt di-set saat PERTAMA mencapai
 // target (jakartaNowIso) dan di-nol-kan saat turun dari target.
 const handleAmountDelta = useCallback(
   async (
     habit: Habit,
     delta: number,
     event?: React.MouseEvent | React.KeyboardEvent,
   ) => {
     if (selectedDate > todayStr) {
       toast.error('Tidak bisa mencatat habit untuk tanggal yang akan datang');
       return;
     }
     const habitId = habit.id;
     const target = Math.max(1, habit.target || 1);
     const current = Math.round(amountValueMapRef.current[habitId] ?? 0);
     const nextValue = Math.min(target, Math.max(0, Math.round(current + delta)));
     if (nextValue === current) return; // sudah di batas clamp
     const wasCompleted = !!(completionMapRef.current[habitId] ?? false);
     const nextCompleted = nextValue >= target;

     if (event && 'currentTarget' in event) {
       confettiElRef.current = event.currentTarget as HTMLElement;
     }

     // Optimistic: nilai amount + status selesai + pop anim.
     setAmountValueMap((p) => ({ ...p, [habitId]: nextValue }));
     setCompletionMap((p) => ({ ...p, [habitId]: nextCompleted }));
     setTogglingIds((p) => new Set(p).add(habitId));
     if (nextCompleted && !wasCompleted) {
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
       const body: {
         date: string;
         completed: boolean;
         value: number;
         completedAt?: string | null;
       } = {
         date: selectedDate,
         completed: nextCompleted,
         value: nextValue,
       };
       if (nextCompleted && !wasCompleted) {
         body.completedAt = jakartaNowIso(); // pertama kali capai target
       } else if (!nextCompleted) {
         body.completedAt = null; // turun dari target → hapus
       }
       const res = await fetch(`/api/habits/${habitId}/logs`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(body),
       });
       if (!res.ok) {
         const errData = await res.json().catch(() => ({}));
         throw new Error(errData.error || `HTTP ${res.status}`);
       }

       // update month cache (sumber streak & 7-hari flip)
       const month = selectedDate.slice(0, 7);
       const cache = monthLogsCacheRef.current[month];
       if (cache) {
         const logs = cache[habitId] || [];
         const idx = logs.findIndex((l) => toDateString(l.date) === selectedDate);
         const entry: HabitLog = {
           id: '',
           habitId,
           // UTC noon — selalu jatuh di hari Jakarta yang sama (pola lama).
           date: new Date(selectedDate + 'T12:00:00Z').toISOString(),
           completed: nextCompleted,
           value: nextValue,
           completedAt:
             typeof body.completedAt === 'string' ? body.completedAt : null,
         };
         if (idx >= 0) {
           logs[idx] = { ...logs[idx], ...entry };
         } else {
           logs.push(entry);
         }
       }

       if (nextCompleted && typeof body.completedAt === 'string') {
         setCompletedAtMap((p) => ({
           ...p,
           [habitId]: formatJakartaTime(body.completedAt as string),
         }));
       } else if (!nextCompleted) {
         setCompletedAtMap((p) => {
           const np = { ...p };
           delete np[habitId];
           return np;
         });
       }

       queryClient.invalidateQueries({ queryKey: ['habits'] });
       queryClient.invalidateQueries({ queryKey: ['dashboard'] });
       queryClient.invalidateQueries({ queryKey: ['habit-logs-batch'] });

       if (nextCompleted && !wasCompleted) {
         toast.success(`Target tercapai! 🎉 (${habit.name})`);
         const currentStreak = cache
           ? computeStreak(cache[habitId] || [], selectedDate, {
               startDate: habit.startDate,
               onVacation: !!habit.vacationMode,
               schedule: parseSchedule(habit.scheduleJson),
             })
           : 0;
         const milestone = milestoneForStreak(currentStreak);
         if (milestone) {
           burstFromElement(confettiElRef.current, {
             count: 60,
             spread: 110,
             rainbow: true,
           });
         } else {
           burstFromElement(confettiElRef.current, { count: 20 });
         }
         confettiElRef.current = null;
       }
     } catch (e) {
       // Rollback optimistic.
       setAmountValueMap((p) => ({ ...p, [habitId]: current }));
       setCompletionMap((p) => ({ ...p, [habitId]: wasCompleted }));
       toast.error(e instanceof Error ? e.message : 'Gagal memperbarui progres');
       confettiElRef.current = null;
     } finally {
       setTogglingIds((p) => {
         const s = new Set(p);
         s.delete(habitId);
         return s;
       });
     }
   },
   [selectedDate, todayStr, queryClient],
 );

 const handleHabitCheck = useCallback(
   (habit: Habit, event?: React.MouseEvent | React.KeyboardEvent) => {
     // FUTURE-DATE GUARD: the tracker grid is reachable for future dates
     // (DateNav arrows + calendar day-cell 1-click via openTrackerDate).
     // Checking a habit "tomorrow" writes a future HabitLog that silently
     // inflates streaks/milestones and shows up as already-done when that
     // day arrives. The manual time dialog already blocks future dates
     // (max attr on the date input) — block the checkbox path too.
     if (selectedDate > todayStr) {
       toast.error('Tidak bisa mencatat habit untuk tanggal yang akan datang');
       return;
     }
     // GELOMBANG 1: habit amount tidak binary — klik apa pun (badan kartu
     // atau jalur lama) dialihkan ke stepper +1 (defense in depth; kartu
     // amount memang tidak merender checkbox).
     // LOW-(b) KEPUTUSAN URUTAN: cek `amount` SELALU di depan `trackTime` →
     // habit amount+trackTime tetap STEPPER (bukan dialog waktu). Alasan:
     // progres numerik amount tidak boleh tergantung dialog; completedAt
     // amount di-set server saat value mencapai target (M3). Dialog waktu
     // hanya untuk habit binary (normal/avoid) yang trackTime — konsisten
     // di kartu (tanpa checkbox) dan parent (redirect ini).
     if (habit.habitType === 'amount') {
       void handleAmountDelta(habit, 1, event);
       return;
     }
     const next = !(completionMapRef.current[habit.id] ?? false);
     if (!next) {
       toggleHabit(habit, null);
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
         `${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}`,
       );
     } else {
       toggleHabit(habit, null);
     }
   },
   [toggleHabit, handleAmountDelta, selectedDate, todayStr],
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
       // M2-fix: tanggal manual diteruskan sebagai dateOverride sehingga log
       // masuk ke hari yang dipilih user (completedAt dan date selaras).
       // Jalur "Sekarang" memakai default selectedDate (semantik lama).
       await toggleHabit(
         timeDialogHabit,
         completedAtISO,
         useNow ? undefined : manualDate,
       );
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

 // ── Task 36: wisudakan habit (Target Lulus) ─────────────────────────
 // Dipanggil kartu habit saat completedLogCount >= targetDays. Optimistik:
 // graduatedAt diisi di cache ['habits'] → kartu langsung keluar dari grid
 // (filter activeHabits) tanpa menunggu round-trip. Confetti rainbow besar —
 // momen "menyelesaikan sesuatu" adalah perayaan utama aplikasi ini.
 const handleGraduate = useCallback(
   async (habit: Habit, el: HTMLElement | null) => {
     const iso = jakartaNowIso();
     queryClient.setQueryData<Habit[]>(['habits'], (prev = []) =>
       prev.map((h) => (h.id === habit.id ? { ...h, graduatedAt: iso } : h)),
     );
     try {
       const res = await fetch(`/api/habits/${habit.id}`, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ graduatedAt: iso }),
       });
       if (!res.ok) throw new Error(`HTTP ${res.status}`);
       burstFromElement(el, { count: 80, spread: 120, rainbow: true });
       toast.success(
         `🎓 ${habit.name} resmi lulus! Target ${habit.targetDays ?? '?'} hari tuntas — kerja bagus!`,
       );
       queryClient.invalidateQueries({ queryKey: ['habits'] });
       queryClient.invalidateQueries({ queryKey: ['dashboard'] });
       queryClient.invalidateQueries({ queryKey: ['dashboard', 'all'] });
       triggerRefresh();
     } catch {
       // Rollback optimistik — pulihkan cache lalu refetch jujur.
       queryClient.setQueryData<Habit[]>(['habits'], (prev = []) =>
         prev.map((h) => (h.id === habit.id ? { ...h, graduatedAt: null } : h)),
       );
       queryClient.invalidateQueries({ queryKey: ['habits'] });
       toast.error('Gagal menyimpan kelulusan — coba lagi');
     }
   },
   [queryClient, triggerRefresh],
 );

 // ---- date navigation ----
 // UTC-safe YMD arithmetic (shiftYmdKey) — ms-based subDays/addDays on a
 // local-midnight Date would read the local TZ again when formatted (see
 // the STREAK-TZ-class note above). String arithmetic is TZ-independent.
 const goToPrevDay = useCallback(
   () => setSelectedDate(shiftYmdKey(selectedDate, -1)),
   [selectedDate, setSelectedDate],
 );
 const goToNextDay = useCallback(
   () => setSelectedDate(shiftYmdKey(selectedDate, 1)),
   [selectedDate, setSelectedDate],
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
       await fetchCompletions(habits, selectedDate, () => cancelled);
     } finally {
       if (!cancelled) setLoading(false);
     }
   };
   load();
   return () => {
     cancelled = true;
   };
 }, [habits, selectedDate, refreshKey]);

 // BUG-19 fix (kini lewat flushPendingSave — H2): on unmount, fire-and-forget
 // any pending debounced notes save using `keepalive: true` so the request
 // completes after the component is gone. Previously the save was just
 // cancelled, silently dropping the user's last edits if they navigated
 // within the 600ms debounce window. flushPendingSave juga memperbarui cache
 // ['daily-logs', tanggal] optimistik supaya remount cepat tetap menampilkan
 // draft (bukan nilai server lama yang akan ditimpa ketikan berikutnya).
 useEffect(
   () => () => {
     flushPendingSave();
   },
   [flushPendingSave],
 );

 if (loading) return <LoadingSkeleton />;

 const isToday = selectedDate === todayStr;
 const monthLogsCache = monthLogsCacheRef.current[selectedDate.slice(0, 7)];

 // ---- render ----
 return (
   <div className="space-y-5 max-w-6xl mx-auto">
     {/* ─────────────────── View Toggle (Hari Ini | Riwayat) ─── */}
     {/* PREMIUM REDESIGN (Rutina Aurora): premium segmented pill.
         Plain buttons + aria-pressed (not role=tab) so keyboard users can
         Tab between them natively without needing arrow-key handlers. */}
     <div
       className="premium-segment w-fit"
       role="group"
       aria-label="Mode tampilan tracker"
     >
       <button
         onClick={() => setViewMode('today')}
         data-active={viewMode === 'today'}
         aria-pressed={viewMode === 'today'}
         className="premium-segment-item data-[active=true]:bg-primary data-[active=true]:shadow-sm"
       >
         Hari Ini
       </button>
       <button
         onClick={() => setViewMode('history')}
         data-active={viewMode === 'history'}
         aria-pressed={viewMode === 'history'}
         className="premium-segment-item data-[active=true]:bg-primary data-[active=true]:shadow-sm"
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
       totalXp={totalXp}
     />

     {/* Task 36: Banner Kembali (anti-nunda) — hanya saat butuh: bolong
         >=2 hari + belum ada kemenangan hari ini; bisa ditutup per hari. */}
     {comeback && !comebackHidden && (
       <section
         aria-label="Sambutan kembali"
         className="premium-card premium-card-sheen rounded-2xl p-4 relative overflow-hidden"
       >
         <div
           className="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-transparent pointer-events-none"
           aria-hidden="true"
         />
         <button
           type="button"
           onClick={hideComeback}
           aria-label="Tutup sambutan kembali"
           className="absolute right-2.5 top-2.5 h-7 w-7 rounded-full grid place-items-center text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 z-10"
         >
           <X className="h-3.5 w-3.5" />
         </button>
         <div className="relative flex items-start gap-3 pr-8">
           <span className="chip-soft chip-soft-teal h-10 w-10 shrink-0">
             <Sprout className="h-5 w-5" aria-hidden="true" />
           </span>
           <div className="min-w-0 flex-1">
             <p className="text-sm font-semibold leading-snug">
               Senang kamu kembali 🌱
             </p>
             <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
               {comeback.gapDays >= 99
                 ? 'Sudah lama tidak mampir — dan tidak apa-apa. Nunda itu manusiawi; yang penting kamu kembali sekarang.'
                 : `Cuma berhenti ${comeback.gapDays} hari — bukan gagal, cuma jeda. Mulai dari satu yang paling ringan dulu:`}
             </p>
             {comeback.gapDays < 99 && (
               <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                 <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-semibold min-w-0 max-w-full">
                   <span aria-hidden="true">{comeback.pick.emoji}</span>
                   <span className="truncate">{comeback.pick.name}</span>
                 </span>
                 <Button
                   size="sm"
                   className="btn-primary-gradient anim-press h-8"
                   onClick={(e) => {
                     // Confetti dari tombol ini (pola BUG-5: set ref dulu).
                     handleSetConfettiEl(e.currentTarget);
                     handleHabitCheck(comeback.pick);
                   }}
                 >
                   <CheckCircle2 className="h-3.5 w-3.5" />
                   Tandai Selesai
                 </Button>
               </div>
             )}
           </div>
         </div>
       </section>
     )}

     {/* ───────────── Daily Check-in (GELOMBANG 1) ─────── */}
     {/* Mood / energi / tidur — di atas daftar habit; optimistic +
         promise-chain save per field (lihat daily-check-in-card).
         KEY remount: sinkronisasi nilai server saat (tanggal, kehadiran
         baris) berubah TANPA setState dalam effect — refetch biasa
         (row → row) tidak me-reset draft optimistic. */}
     <DailyCheckInCard
       key={`${selectedDate}|${checkInValue ? 'row' : 'none'}`}
       date={selectedDate}
       value={checkInValue}
     />

     {/* ─────────────────── Daily Notes (full-width) ────────── */}
     <section className="daily-notes-card">
       <div className="flex items-center gap-2 mb-2">
         <span className="chip-soft chip-soft-teal h-7 w-7">
           <NotebookPen className="h-3.5 w-3.5" />
         </span>
         <h3 className="text-sm font-semibold">Catatan Harian</h3>
         <span className="ml-auto text-[11px] text-muted-foreground/70">
           {notesCharCount > 0 ? `${notesCharCount} karakter` : 'Tersimpan otomatis'}
         </span>
       </div>
       {/* GELOMBANG 1 (rebuild): editor teks polos premium (tanpa TipTap/
           dependensi baru) — HTML lama dibersihkan saat tampil; autosave
           tetap lewat debounce parent (handleNotesChange). */}
       <RichNotesEditor
         value={notes}
         onChange={handleNotesChange}
         placeholder="Bagaimana harimu? Tulis refleksi di sini…"
         className="text-sm leading-relaxed placeholder:text-muted-foreground/50"
       />
     </section>

     {/* ─────────────────── Habit Grid ─────────────────────── */}
     <section>
       <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
         <h3 className="premium-label">Habits</h3>
         {/* FIX-AUDIT-23 (#2): div kontrol diberi flex-wrap + segmen dibuat
             w-full <sm — dulu "Atur Urutan" (114px) + segmen (239px) = 361px
             di kotak 288px → 57px terpotong di 320–375px. Sekarang di layar
             sempit segmen ambil baris sendiri (pill sama lebar, target sentuh
             lebih besar); ≥sm kembali 1 baris seperti semula. Logika filter/
             dragMode tidak berubah. */}
         <div className="flex flex-wrap items-center justify-end gap-2">
           <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
             {completedCount}/{totalCount}
           </span>
           {/* PHASE4-POLISH: drag-to-reorder toggle. When active, hides the
               filter chips and shows a "Selesai" button to exit drag mode. */}
           {activeHabits.length > 0 && (
             <Button
               type="button"
               variant={dragMode ? 'default' : 'outline'}
               size="sm"
               onClick={toggleDragMode}
               className="h-7 text-xs rounded-full px-3"
               title={dragMode ? 'Selesai mengatur urutan' : 'Atur urutan habit'}
             >
               <GripVertical className="h-3 w-3" />
               {dragMode ? 'Selesai' : 'Atur Urutan'}
             </Button>
           )}
           {!dragMode && (
             <div
               className="premium-segment w-full sm:w-auto min-w-0"
               role="group"
               aria-label="Filter habit"
             >
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
                   data-active={viewFilter === key}
                   aria-pressed={viewFilter === key}
                   className="premium-segment-item flex-1 min-w-0 data-[active=true]:bg-primary data-[active=true]:shadow-sm"
                 >
                   {label}
                 </button>
               ))}
             </div>
           )}
         </div>
       </div>

       {/* PHASE4-POLISH: drag-mode helper banner. Lets the user know that
           tapping the grip handle and dragging will reorder habits, and
           that normal tap-to-toggle is disabled while in drag mode. */}
       {dragMode && activeHabits.length > 0 && (
         <div className="premium-card mb-3 rounded-2xl px-3 py-2 flex items-center gap-2.5 text-xs text-muted-foreground">
           <span className="chip-soft chip-soft-teal h-6 w-6 shrink-0">
             <GripVertical className="h-3.5 w-3.5" />
           </span>
           <span>
             <span className="font-semibold text-foreground">Mode Atur Urutan:</span>{' '}
             Tahan tombol geser di sudut kartu untuk mengubah urutan. Perubahan tersimpan otomatis.
           </span>
         </div>
       )}

       {/* Task 37: hari tanpa habit terjadwal — bukan error, cuma jadwal.
           Tampilkan kapan habit terdekat muncul lagi supaya tidak terasa
           "kehilangan" habit (kecemasan tipe pemula-rajin). */}
       {activeHabits.length === 0 ? (
         <div className="premium-card premium-empty rounded-2xl">
           <div className="premium-empty-orb">
             <ClipboardList className="h-8 w-8 text-primary" />
           </div>
           <p className="text-sm font-medium text-muted-foreground">
             Belum ada habit aktif
           </p>
           <p className="text-xs text-muted-foreground/70 -mt-0.5">
             Buka Habit Master untuk membuatnya!
           </p>
           {/* ONE-CLICK-5: empty state is no longer a dead end — the CTA
               opens the add-habit dialog directly (same flow as the FAB
               "Habit Baru"): trigger the quick-add action + jump to the
               settings tab, where the HabitMaster auto-opens its form. */}
           <Button
             size="sm"
             className="btn-primary-gradient anim-press"
             onClick={() => { triggerQuickAdd('habit'); setActiveTab('settings'); }}
           >
             <Plus className="h-4 w-4" />
             Buat Habit Pertama
           </Button>
         </div>
       ) : scheduledHabits.length === 0 ? (
         <div className="premium-card premium-empty rounded-2xl">
           <div className="premium-empty-orb">
             <CalendarDays className="h-8 w-8 text-primary" />
           </div>
           <p className="text-sm font-medium text-muted-foreground">
             Tidak ada habit terjadwal hari ini
           </p>
           <p className="text-xs text-muted-foreground/70 -mt-0.5 max-w-xs text-center leading-relaxed">
             Beberapa habit hanya tampil di hari tertentu — hari tanpa jadwal
             tidak menghitung bolong, jadi santai saja.
             {nextOccurrences.length > 0 && (
               <span className="block mt-1.5">
                 Berikutnya:{' '}
                 {nextOccurrences
                   .map((o) => `${o.emoji} ${o.name} (${o.label})`)
                   .join(' · ')}
               </span>
             )}
           </p>
         </div>
       ) : !dragMode && filteredHabits.length === 0 ? (
         <div className="premium-card premium-empty rounded-2xl">
           <div className="premium-empty-orb">
             {viewFilter === 'completed' ? (
               <Flag className="h-8 w-8 text-primary" />
             ) : (
               <CheckCircle2 className="h-8 w-8 text-primary" />
             )}
           </div>
           <p className="text-sm text-muted-foreground">
             {viewFilter === 'completed'
               ? 'Belum ada habit yang selesai.'
               : viewFilter === 'incomplete'
                 ? 'Semua habit selesai — kerja bagus!'
                 : 'Tidak ada habit yang cocok dengan filter ini.'}
           </p>
         </div>
       ) : dragMode ? (
         // ── Drag mode: wrap the grid in DndContext + SortableContext ──
         // Drag mode ignores the viewFilter (always shows ALL active habits
         // so every reorderable item is visible). SortableHabitCard adds
         // the grip handle + DnD listeners; outside drag mode it would be a
         // transparent wrapper, but we only render it inside this branch.
         <DndContext
           sensors={sensors}
           collisionDetection={closestCenter}
           onDragEnd={handleDragEnd}
         >
           <SortableContext
             items={scheduledHabits.map((h) => h.id)}
             strategy={rectSortingStrategy}
           >
             <div className="habit-grid">
               {scheduledHabits.map((habit, idx) => {
                 const isDone = !!(completionMap[habit.id] ?? false);
                 const isToggling = togglingIds.has(habit.id);
                 const justCompleted = recentlyCompleted.has(habit.id);
                 const doneTime = isDone ? completedAtMap[habit.id] : null;

                 return (
                   <SortableHabitCard
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
                     amountValue={amountValueMap[habit.id] ?? 0}
                     onToggleHabit={handleHabitCheck}
                     onAmountDelta={handleAmountDelta}
                     onSetConfettiEl={handleSetConfettiEl}
                     onOpenAnalysis={handleOpenAnalysis}
                     onGraduate={handleGraduate}
                     dragMode={dragMode}
                   />
                 );
               })}
             </div>
           </SortableContext>
         </DndContext>
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
                 amountValue={amountValueMap[habit.id] ?? 0}
                 onToggleHabit={handleHabitCheck}
                 onAmountDelta={handleAmountDelta}
                 onSetConfettiEl={handleSetConfettiEl}
                 onOpenAnalysis={handleOpenAnalysis}
                 onGraduate={handleGraduate}
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
             <span>{timeDialogHabit?.emoji}</span>
             {timeDialogHabit?.name}
           </DialogTitle>
           {/* LOW-(a): DialogDescription supaya dialog punya deskripsi
               ter-taut (aria-describedby) — radix tidak lagi memperingatkan
               "Description missing" di konsol. */}
           <DialogDescription>
             Catat kapan habit ini dilakukan
           </DialogDescription>
         </DialogHeader>
         <div className="space-y-4 pt-2">

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
                   timeZone: 'Asia/Jakarta',
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
               disabled={timeSubmitting || !manualTime || !manualDate}
               className="w-full"
             >
               {timeSubmitting ? 'Menyimpan...' : 'Simpan Waktu'}
             </Button>
           </div>

           {timeDialogHabit?.reminder && (
             <p className="text-xs text-center text-muted-foreground">
               Pengingat: {timeDialogHabit.reminder}
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

