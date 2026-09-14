'use client';

// components/habit-tracker/daily-tracker.tsx — orkestrator tab Tracker.
//
// Task 38 (split god file): file ini tadinya ~1820 baris monolitik. Bagian
// dengan kepribadian sendiri diekstraksi verbatim jadi modul terpisah:
//   • use-habit-completions.ts  — state peta completion + fetch log bulanan
//   • use-habit-toggle.ts       — toggle/stepper optimistik + confetti
//   • daily-tracker-comeback-banner.tsx — Banner Kembali (Task 36)
//   • daily-tracker-notes-card.tsx      — kartu catatan harian
//   • daily-tracker-habit-grid.tsx      — seksi grid habit (filter/drag/empty)
//   • daily-tracker-time-dialog.tsx     — dialog konfirmasi waktu
// Yang tinggal di sini: queries, memo turunan, notes autosave (debounce +
// flush H2), jadwal Task 37, drag-reorder, dialog waktu/analytics, wisuda
// (Task 36), dan tata letak render.

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import {
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useAppStore } from '@/store/app-store';
import { jakartaNowIso, jakartaNowParts, dateFromYMD } from '@/lib/timezone';
import TimeAnalysisDialog from '@/components/habit-tracker/time-analysis';
import { useHabitOptions } from '@/hooks/use-habit-options';
import { useThemeColor } from '@/hooks/use-theme-color';
import { jakartaDateString } from '@/lib/jakarta-date';
import { xpForHabit } from '@/lib/dashboard-helpers';
import { burstFromElement } from '@/lib/confetti';
import { THEME_PRESETS } from '@/lib/theme-utils';
import { getDaysInMonth, getDate } from '@/lib/date-utils';
import { toast } from 'sonner';

import type { Habit } from './daily-tracker-types';
import {
  toDateString,
  computeStreak,
  jakartaYmdOf,
  shiftYmdKey,
  saveDailyLog,
  htmlToPlainText,
} from './daily-tracker-helpers';
import { DateNav } from './daily-tracker-date-nav';
import { DailySummary } from './daily-tracker-daily-summary';
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
// Task 38 — hasil pemecahan god file (lihat header comment file ini).
import { useHabitCompletions } from './use-habit-completions';
import { useHabitToggle } from './use-habit-toggle';
import { ComebackBanner } from './daily-tracker-comeback-banner';
import { DailyNotesCard } from './daily-tracker-notes-card';
import { HabitGridSection } from './daily-tracker-habit-grid';
import { TimeConfirmDialog } from './daily-tracker-time-dialog';

// Calendar merged into Tracker as sub-tab (nav 6 → 5)
const CalendarView = dynamic(() => import('./calendar-view'), { ssr: false });

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
  // CONNECTED-APP (Task 49): judul tujuan untuk chip "Tujuan" pada kartu
  // habit (key ['goals'] — cache terbagih dengan tab Tujuan & form habit).
  const { data: goalsList = [] } = useQuery<{ id: string; title: string }[]>({
    queryKey: ['goals'],
    queryFn: async () => {
      const res = await fetch('/api/goals');
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : (json.goals ?? []);
    },
    staleTime: 60_000,
  });
  const goalTitleById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const g of goalsList) map[g.id] = g.title;
    return map;
  }, [goalsList]);
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

  // BUG-7 fix: use jakartaDateString() (TZ-explicit) instead of
  // format(startOfDay(new Date()), 'yyyy-MM-dd') which reads the BROWSER's
  // local TZ. A user in UTC-8 viewing the app at 22:00 local would see
  // todayStr = "2025-01-15" while Jakarta is already 2025-01-16 — selecting
  // "Today" would jump to the wrong date. Dideklarasikan di awal karena
  // dibutuhkan useHabitToggle (guard tanggal future) sebelum memo turunan.
  const todayStr = jakartaDateString();

  // ---- state ----
  const [notes, setNotes] = useState('');
  const [viewFilter, setViewFilter] = useState<'all' | 'incomplete' | 'completed'>('all');
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
    if (!focusHabitId) return;
    // CONNECTED-APP: fokus habit dibuka SESUAI KAPABILITAS — habit trackTime
    // → dialog Analisis Waktu; habit lain → gulir ke kartunya di grid
    // (dialog analisis cuma buntu "tidak mencatat waktu" untuk mereka;
    // kartu grid memuat riwayat 7-hari + stepper + tombol analisis).
    const focused = habits.find((h) => h.id === focusHabitId);
    if (focused?.trackTime) {
      openAnalysis(focusHabitId);
    } else {
      requestAnimationFrame(() => {
        document
          .getElementById(focusHabitId)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
    clearHabitFocus();
    // `habits` sengaja tidak masuk deps: fokus adalah peristiwa sekali-jalan
    // (consume-and-clear) — cukup dibaca saat fokus datang.
  }, [focusHabitId, clearHabitFocus, openAnalysis]);
  // CONNECTED-APP: ganti mode tampilan (Hari Ini ↔ Riwayat) menutup dialog
  // analisis yang masih terbuka — dulu analysisHabitId bertahan sehingga
  // kembali ke "Hari Ini" memunculkan ulang dialog secara tak terduga.
  useEffect(() => {
    setAnalysisHabitId(null);
  }, [viewMode]);

  // ---- refs (notes autosave) ----
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

  // ── Task 38: state completion + fetch log bulanan (dari hook) ──
  // Setter + mirror ref (PERF-REACT-1) turunan hook dipakai bersama oleh
  // useHabitToggle — identitas state TETAP SATU (tidak ada duplikasi).
  const {
    loading,
    completionMap,
    setCompletionMap,
    completedAtMap,
    setCompletedAtMap,
    amountValueMap,
    setAmountValueMap,
    monthLogsCacheRef,
    completionMapRef,
    amountValueMapRef,
  } = useHabitCompletions(habits, selectedDate, refreshKey);

  // ── Task 38: toggle/stepper optimistik + confetti (dari hook) ──
  const {
    togglingIds,
    recentlyCompleted,
    handleSetConfettiEl,
    toggleHabit,
    handleAmountDelta,
  } = useHabitToggle({
    selectedDate,
    todayStr,
    queryClient,
    monthLogsCacheRef,
    completionMapRef,
    amountValueMapRef,
    setCompletionMap,
    setCompletedAtMap,
    setAmountValueMap,
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

      const reorderedSubset = arrayMove(scheduledHabits, oldIndex, newIndex);

      // Task 39 (#2): sisipkan hasil reorder kembali ke daftar habit aktif
      // PENUH sebelum menomori ulang. Dulu sortOrder di-assign dari index
      // SUBSET terjadwal — habit mingguan/bulanan yang tersembunyi hari itu
      // mempertahankan nomor lama → dua habit bisa ber-sortOrder sama →
      // urutan global kacau permanen setelah refresh (tie-break createdAt).
      const subsetIds = new Set(reorderedSubset.map((h) => h.id));
      const reorderedActive: Habit[] = [];
      let k = 0;
      for (const h of activeHabits) {
        if (subsetIds.has(h.id) && k < reorderedSubset.length) {
          reorderedActive.push(reorderedSubset[k]);
          k += 1;
        } else {
          reorderedActive.push(h);
        }
      }

      // Re-assign `sortOrder` so the new array position matches the DB order
      // (0..N-1 across ALL active habits — scheduled or not). Collect only
      // the diffs to PUT.
      const updates: { id: string; sortOrder: number }[] = [];
      reorderedActive.forEach((h, idx) => {
        if (h.sortOrder !== idx) updates.push({ id: h.id, sortOrder: idx });
      });

      // Optimistic local override: reordered active habits (with new order
      // field) followed by the unchanged paused/archived habits.
      const activeIds = new Set(reorderedActive.map((h) => h.id));
      const nonActive = habits.filter((h) => !activeIds.has(h.id));
      const reorderedAll: Habit[] = [
        ...reorderedActive.map((h, idx) => ({ ...h, sortOrder: idx })),
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
    [scheduledHabits, activeHabits, habits, queryClient],
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
  // (State "disembunyikan per hari" ada di modul ComebackBanner.)
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
    // menyimpan gabungan prev+current — lihat M4-fix di use-habit-completions).
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
    // Task 39 (#7): tanggal WISUDA = tanggal kemenangan terakhir habit lulus.
    // Cache log bulanan hanya berisi habit yang BELUM lulus, jadi tanpa ini
    // pengguna yang kemarin menyelesaikan habit terakhirnya lalu hari ini
    // membuka app disambut "sudah lama tidak mampir" (gap 99 palsu).
    for (const h of habits) {
      if (!h.graduatedAt) continue;
      const gy = jakartaYmdOf(h.graduatedAt);
      if (gy <= todayStr && gy > last) last = gy;
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
  // handleHabitCheck: gate tanggal future + rute amount→stepper, normal
  // trackTime→dialog waktu, sisanya langsung toggle.
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
      // PERF-REACT-1: baca lewat mirror ref (bukan completionMap langsung)
      // supaya identitas handleHabitCheck stabil lintas toggle — itulah yang
      // membuat React.memo di HabitCard benar-benar melewatkan kartu lain.
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
        handleSetConfettiEl(event.currentTarget as HTMLElement);
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
    [toggleHabit, handleAmountDelta, handleSetConfettiEl, completionMapRef, selectedDate, todayStr],
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

  // Banner Kembali → tombol "Tandai Selesai": set posisi confetti lalu lewati
  // jalur centang biasa (pola BUG-5 — ref di-set sebelum toggle).
  const handleComebackComplete = useCallback(
    (habit: Habit, el: HTMLElement | null) => {
      handleSetConfettiEl(el);
      handleHabitCheck(habit);
    },
    [handleSetConfettiEl, handleHabitCheck],
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
          className="premium-segment-item"
        >
          Hari Ini
        </button>
        <button
          onClick={() => setViewMode('history')}
          data-active={viewMode === 'history'}
          aria-pressed={viewMode === 'history'}
          className="premium-segment-item"
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
          {comeback && (
            <ComebackBanner
              comeback={comeback}
              todayStr={todayStr}
              onComplete={handleComebackComplete}
            />
          )}

          {/* TASK 45 — REORDER "DO FIRST": Habit Grid kini SEBELUM check-in
              & catatan. Audit: dulu 6 kartu bertumpuk (toggle → tanggal → KPI →
              comeback → check-in → notes) mengubur aksi utama di bawah layar
              pertama mobile. Refleksi (check-in/notes) turun ke bawah — urutan
              DO → REWARD → REFLECT. */}

          {/* ─────────────────── Habit Grid ─────────────────────── */}
          <HabitGridSection
            activeHabits={activeHabits}
            goalTitleById={goalTitleById}
            scheduledHabits={scheduledHabits}
            filteredHabits={filteredHabits}
            nextOccurrences={nextOccurrences}
            dragMode={dragMode}
            viewFilter={viewFilter}
            setViewFilter={setViewFilter}
            toggleDragMode={toggleDragMode}
            sensors={sensors}
            handleDragEnd={handleDragEnd}
            completionMap={completionMap}
            togglingIds={togglingIds}
            recentlyCompleted={recentlyCompleted}
            completedAtMap={completedAtMap}
            monthLogsCache={monthLogsCache}
            selectedDate={selectedDate}
            todayStr={todayStr}
            categoryMap={categoryMap}
            primaryColor={primaryColor}
            amountValueMap={amountValueMap}
            completedCount={completedCount}
            totalCount={totalCount}
            onToggleHabit={handleHabitCheck}
            onAmountDelta={handleAmountDelta}
            onSetConfettiEl={handleSetConfettiEl}
            onOpenAnalysis={handleOpenAnalysis}
            onGraduate={handleGraduate}
            onQuickAddHabit={() => {
              triggerQuickAdd('habit', 'tracker'); // CONNECTED-APP: kembali ke Tracker setelah simpan
              setActiveTab('settings');
            }}
          />

          {/* ───────────── Daily Check-in (GELOMBANG 1) ─────── */}
          {/* Mood / energi / tidur — kini SETELAH grid (refleksi); optimistic +
              promise-chain save per field (lihat daily-check-in-card).
              KEY remount: sinkronisasi nilai server saat (tanggal, kehadiran
              baris) berubah TANPA setState dalam effect — refetch biasa
              (row → row) tidak me-reset draft optimistic. */}
          <DailyCheckInCard
            key={`${selectedDate}|${checkInValue ? 'row' : 'none'}`}
            date={selectedDate}
            value={checkInValue}
            // CONNECTED-APP: check-in ↔ jurnal — dua bagian refleksi satu
            // tanggal; tautan menggulir ke kartu catatan (anchor #notes).
            onOpenJournal={() => {
              document
                .getElementById('daily-notes-card')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />

          {/* ─────────────────── Daily Notes (full-width) ────────── */}
          <div id="daily-notes-card" className="scroll-mt-20">
            <DailyNotesCard
              notes={notes}
              onChange={handleNotesChange}
              charCount={notesCharCount}
            />
          </div>

          {/* ── Time Confirmation Dialog ── */}
          <TimeConfirmDialog
            habit={timeDialogHabit}
            open={!!timeDialogHabit}
            onOpenChange={(open) => !open && setTimeDialogHabit(null)}
            manualDate={manualDate}
            onManualDateChange={setManualDate}
            manualTime={manualTime}
            onManualTimeChange={setManualTime}
            submitting={timeSubmitting}
            onNow={() => handleTimeDialogSubmit(true)}
            onManual={() => handleTimeDialogSubmit(false)}
          />

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
