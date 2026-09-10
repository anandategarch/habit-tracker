'use client';

// components/habit-tracker/daily-tracker-date-nav.tsx — pill navigasi tanggal.
//
// CATATAN TZ: `dateObj` HARUS dibangun dari komponen YMD (UTC-midnight lewat
// dateFromYMD / Date.UTC) — jangan parseISO lalu format lokal (bug lama:
// weekday & "Hari X/Y" meleset di browser barat UTC, navigasi loncat hari).
// Label hari/bulan Indonesia via lib/date-utils (Intl id-ID, komponen UTC).

import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { format } from '@/lib/date-utils';

interface DateNavProps {
  isToday: boolean;
  /** Date UTC-midnight dari selectedDate (konstruksi YMD). */
  dateObj: Date;
  dayOfMonth: number;
  daysInMonth: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function DateNav({
  isToday,
  dateObj,
  dayOfMonth,
  daysInMonth,
  onPrev,
  onNext,
  onToday,
}: DateNavProps) {
  const dayLabel = format(dateObj, 'EEEE');
  const dateLabel = format(dateObj, 'MMMM d');

  return (
    <nav
      className="premium-card premium-card-sheen rounded-full py-2 pl-2 pr-2 sm:pr-3 flex items-center gap-1.5 sm:gap-3"
      aria-label="Navigasi tanggal tracker"
    >
      <button
        type="button"
        onClick={onPrev}
        aria-label="Hari sebelumnya"
        title="Hari sebelumnya"
        className="h-10 w-10 shrink-0 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-accent/60 active:scale-95 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex-1 min-w-0 text-center px-1">
        <div className="flex items-center justify-center gap-2">
          {isToday && (
            <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
          )}
          <h2 className="text-base sm:text-lg font-bold tracking-tight truncate">
            {dayLabel}
          </h2>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums truncate">
          {dateLabel} · Hari {dayOfMonth}/{daysInMonth}
        </p>
      </div>

      {!isToday && (
        <button
          type="button"
          onClick={onToday}
          aria-label="Kembali ke hari ini"
          title="Kembali ke hari ini"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 h-8 text-xs font-semibold hover:bg-primary/15 active:scale-95 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          <span>Hari ini</span>
        </button>
      )}

      <button
        type="button"
        onClick={onNext}
        aria-label="Hari berikutnya"
        title="Hari berikutnya"
        className="h-10 w-10 shrink-0 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-accent/60 active:scale-95 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
