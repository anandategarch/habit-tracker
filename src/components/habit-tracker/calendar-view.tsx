'use client';

// components/habit-tracker/calendar-view.tsx — kalender heatmap (sub-tab
// "Riwayat" pada Tracker). ROOT KOMPOSISI (Task 71-j): data + derivasi di
// use-calendar-month-data; header/navigasi bulan, grid, sel hari, legenda,
// dan ringkasan bulan di sibling calendar-*.
//
// FIX REBUILD (dipertahankan dari versi monolitik):
//  - batch-logs mengikuti kontrak API: ?month=…&ids=… → { logs: HabitLog[] }
//    (flat); grouping dilakukan client-side, dengan toleransi bentuk lama.
//  - TZ: lib/date-utils memakai komponen UTC — SEMUA tanggal grid dibangun
//    Date.UTC (monthDate, opsi bulan) supaya startOfMonth/format tidak
//    meleset sebulan/hari di browser non-UTC.
//  - Day cell klik → openTrackerDate(dayStr) (navigasi 1-klik).
//  - Label bulan Indonesia "MMMM yyyy" via format id.

import { useCallback } from 'react';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app-store';
import { useCalendarMonthData } from './use-calendar-month-data';
import { CalendarMonthHeader } from './calendar-month-header';
import { CalendarSkeleton } from './calendar-skeleton';
import { CalendarGrid } from './calendar-grid';
import { CalendarLegend } from './calendar-legend';
import { CalendarMonthSummary } from './calendar-month-summary';

export default function CalendarView() {
  // Day-cell tap → tracker grid dengan tanggal terpilih (1-klik).
  const openTrackerDate = useAppStore((s) => s.openTrackerDate);

  const {
    selectedMonth,
    setSelectedMonth,
    monthOptions,
    monthLabel,
    weekdays,
    loading,
    fetchError,
    calendarDays,
    monthSummary,
    goToPrevMonth,
    goToNextMonth,
    retryFetch,
  } = useCalendarMonthData();

  const handleDayClick = useCallback(
    (dayStr: string) => openTrackerDate(dayStr),
    [openTrackerDate],
  );

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header + navigasi bulan ── */}
      <CalendarMonthHeader
        selectedMonth={selectedMonth}
        onSelectedMonthChange={setSelectedMonth}
        monthOptions={monthOptions}
        onPrevMonth={goToPrevMonth}
        onNextMonth={goToNextMonth}
      />

      {fetchError && (
        <div className="premium-card premium-empty rounded-2xl">
          <div className="premium-empty-orb" aria-hidden="true">
            <CalendarDays className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">
            Gagal memuat data kalender
          </p>
          <p className="text-xs text-muted-foreground/70 -mt-0.5">
            Coba muat ulang habit dan log kamu.
          </p>
          <Button
            size="sm"
            className="btn-primary-gradient anim-press"
            onClick={retryFetch}
          >
            <RefreshCw className="h-4 w-4" />
            Coba Lagi
          </Button>
        </div>
      )}

      {!fetchError &&
        (loading ? (
          <CalendarSkeleton weekdays={weekdays} />
        ) : (
          <>
            {/* ── Grid kalender (div premium-card, bukan Card shadcn) ── */}
            <CalendarGrid
              weekdays={weekdays}
              days={calendarDays}
              onDayClick={handleDayClick}
            />

            {/* ── Legenda + ringkasan bulan ── */}
            <div className="grid gap-6 md:grid-cols-2">
              <CalendarLegend />
              <CalendarMonthSummary
                monthLabel={monthLabel}
                monthSummary={monthSummary}
                onOpenDate={openTrackerDate}
              />
            </div>
          </>
        ))}
    </div>
  );
}
