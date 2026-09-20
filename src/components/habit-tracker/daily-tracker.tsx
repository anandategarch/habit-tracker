'use client';

// components/habit-tracker/daily-tracker.tsx — orkestrator tab Tracker
// (composition root).
//
// Task 38 (split god file): file ini tadinya ~1820 baris monolitik; bagian
// dengan kepribadian sendiri diekstraksi verbatim (use-habit-completions,
// use-habit-toggle, comeback-banner, notes-card, habit-grid, time-dialog).
//
// Task 71-c (split lanjutan): logika non-render yang tersisa diekstraksi
// verbatim ke hook/komponen saudara — urutan efek & deps identik:
//   • use-habit-reorder.ts          — dnd-kit reorder + override urutan
//     optimistik (memiliki `habits`/`activeHabits` = override ?? query)
//   • use-habit-analysis.ts         — dialog analisis waktu + fokus habit
//   • use-daily-log.ts              — query ['daily-logs', date] + check-in
//   • use-daily-notes.ts            — catatan (debounce + flush H2)
//   • use-scheduled-habits.ts       — memo jadwal (Task 37) + filter
//   • use-daily-stats.ts            — KPI harian (XP, streak, X/Y)
//   • use-habit-comeback.ts         — memo Banner Kembali (Task 36)
//   • use-habit-time-dialog.ts      — dialog waktu + router handleHabitCheck
//   • use-habit-graduate.ts         — wisuda habit (Task 36)
//   • daily-tracker-view-toggle.tsx — pill "Hari Ini | Riwayat"
// Yang tinggal di sini: query habits, wiring hook, dan tata letak render.

import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/store/app-store';
import { dateFromYMD } from '@/lib/timezone';
import TimeAnalysisDialog from '@/components/habit-tracker/time-analysis';
import { useHabitOptions } from '@/hooks/use-habit-options';
import { useThemeColor } from '@/hooks/use-theme-color';
import { THEME_PRESETS } from '@/lib/theme-utils';
import { getDaysInMonth, getDate } from '@/lib/date-utils';
import type { Habit } from './daily-tracker-types';
import { shiftYmdKey, readMonthLogsCache } from './daily-tracker-helpers';
// Task 60-e — "hari ini" yang ber-tick lintas tengah malam Jakarta.
import { useJakartaToday } from './use-jakarta-today';
import { DateNav } from './daily-tracker-date-nav';
import { DailySummary } from './daily-tracker-daily-summary';
import { LoadingSkeleton } from './daily-tracker-skeleton';
import { DailyCheckInCard } from './daily-check-in-card';
import { useHabitCompletions } from './use-habit-completions';
import { useHabitToggle } from './use-habit-toggle';
import { ComebackBanner } from './daily-tracker-comeback-banner';
import { DailyNotesCard } from './daily-tracker-notes-card';
import { HabitGridSection } from './daily-tracker-habit-grid';
import { TimeConfirmDialog } from './daily-tracker-time-dialog';
import { useHabitReorder } from './use-habit-reorder';
import { useHabitAnalysis } from './use-habit-analysis';
import { useDailyLog } from './use-daily-log';
import { useDailyNotes } from './use-daily-notes';
import { useScheduledHabits } from './use-scheduled-habits';
import { useDailyStats } from './use-daily-stats';
import { useHabitComeback } from './use-habit-comeback';
import { useHabitTimeDialog } from './use-habit-time-dialog';
import { useHabitGraduate } from './use-habit-graduate';
import { TrackerViewToggle } from './daily-tracker-view-toggle';

// Calendar merged into Tracker as sub-tab (nav 6 → 5)
const CalendarView = dynamic(() => import('./calendar-view'), { ssr: false });

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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

  // BUG-7 fix: "hari ini" = Jakarta (TZ-explicit), via useJakartaToday
  // (Task 60-e) supaya tab PWA yang melewati tengah malam WIB berganti hari
  // dalam ≤30 detik. Dibutuhkan guard tanggal future di hook toggle/notes.
  const todayStr = useJakartaToday();

  // ---- state ----
  const [viewFilter, setViewFilter] = useState<'all' | 'incomplete' | 'completed'>('all');
  // Calendar merge: toggle between 'today' (habit grid) and 'history' (calendar)
  // ONE-CLICK-3: viewMode lifted to the global store — survives tab switches,
  // AND lets other components (calendar day tap, dashboard jumps) switch the
  // tracker into grid mode from outside.
  const viewMode = useAppStore((s) => s.trackerViewMode);
  const setViewMode = useAppStore((s) => s.setTrackerViewMode);

  // ---- TanStack Query: habits ----
  const { data: queryHabits = [], isLoading: habitsLoading } = useQuery<Habit[]>({
    queryKey: ['habits'],
    queryFn: async () => {
      const res = await fetch('/api/habits');
      if (!res.ok) throw new Error('Gagal memuat habits');
      const json = (await res.json()) as { habits?: Habit[] };
      return json.habits ?? [];
    },
    staleTime: 30_000,
  });

  // ── Task 71-c: reorder (@dnd-kit) + daftar habit berlaku ──
  const {
    habits,
    activeHabits,
    dragMode,
    sensors,
    handleDragEnd,
    toggleDragMode,
  } = useHabitReorder(queryHabits, setViewFilter);

  // ── Task 71-c: dialog analisis waktu + konsumsi fokus habit ──
  const { analysisHabitId, setAnalysisHabitId, handleOpenAnalysis } = useHabitAnalysis({
    habits,
    habitsLoading,
    viewMode,
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

  // ── Task 71-c: query log harian + nilai check-in + fokus jurnal ──
  const { dailyLogData, checkInValue } = useDailyLog(selectedDate, loading);

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

  // ── Task 71-c: catatan harian — debounce + flush H2 (dari hook) ──
  const { notes, handleNotesChange, notesCharCount } = useDailyNotes({
    selectedDate,
    todayStr,
    dailyLogData,
    queryClient,
  });

  // ---- derived ----
  // STREAK-TZ-class fix (versi date-utils UTC): seluruh pembaca komponen di
  // bawah (format 'EEEE'/'MMMM d' DateNav, getDate, getDaysInMonth) memakai
  // komponen UTC dari lib/date-utils — maka dateObj HARUS UTC-midnight dari
  // komponen YMD (dateFromYMD). Konstruksi local-midnight (date-fns era lama)
  // akan meleset sehari di browser non-UTC; parseISO+format lokal lebih buruk.
  const dateObj = useMemo(() => dateFromYMD(selectedDate), [selectedDate]);
  const dayOfMonth = getDate(dateObj);
  const daysInMonth = getDaysInMonth(dateObj);

  // ── Task 71-c: nilai cache log bulan — dibaca lewat helper lintas-modul
  // (opaque bagi react-hooks/refs) lalu dialirkan sebagai NILAI ke hook &
  // grid; identik semantik dengan ref.current[month]. ──
  const monthLogsCache = readMonthLogsCache(monthLogsCacheRef, selectedDate.slice(0, 7));

  // ── Task 71-c: memo jadwal (Task 37) + filter tampil (dari hook) ──
  const { scheduledHabits, nextOccurrences, filteredHabits, trackableHabits } =
    useScheduledHabits({ activeHabits, selectedDate, completionMap, viewFilter });

  // ── Task 71-c: KPI harian — XP, streak, X/Y (dari hook) ──
  const { completedCount, totalCount, completionPct, todayXP, totalXp, bestStreak } =
    useDailyStats({
      habits,
      activeHabits,
      trackableHabits,
      selectedDate,
      completionMap,
      monthLogsCache,
    });

  // ── Task 71-c: Banner Kembali (Task 36, dari hook) ──
  const comeback = useHabitComeback({
    selectedDate,
    todayStr,
    habits,
    activeHabits,
    scheduledHabits,
    trackableHabits,
    completionMap,
    monthLogsCache,
  });

  // ── Task 71-c: dialog waktu + router klik habit (dari hook) ──
  const {
    timeDialogHabit,
    setTimeDialogHabit,
    manualDate,
    setManualDate,
    manualTime,
    setManualTime,
    timeSubmitting,
    handleHabitCheck,
    handleTimeDialogSubmit,
  } = useHabitTimeDialog({
    selectedDate,
    todayStr,
    toggleHabit,
    handleAmountDelta,
    handleSetConfettiEl,
    completionMapRef,
  });

  // ── Task 71-c: wisudakan habit (Task 36, dari hook) ──
  const { handleGraduate } = useHabitGraduate(queryClient, triggerRefresh);

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

  if (loading) return <LoadingSkeleton />;

  const isToday = selectedDate === todayStr;

  // ---- render ----
  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* ─────────────────── View Toggle (Hari Ini | Riwayat) ─── */}
      <TrackerViewToggle viewMode={viewMode} onChange={setViewMode} />

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
          {/* BUGHUNT-54 (3-b #6): selectedDate + todayStr diteruskan supaya
              label KPI dinamis ("XP 12 Feb" saat melihat tanggal lampau). */}
          <DailySummary
            completedCount={completedCount}
            totalCount={totalCount}
            completionPct={completionPct}
            todayXP={todayXP}
            bestStreak={bestStreak}
            totalXp={totalXp}
            selectedDate={selectedDate}
            todayStr={todayStr}
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
