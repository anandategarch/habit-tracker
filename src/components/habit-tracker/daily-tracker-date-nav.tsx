// ---------------------------------------------------------------------------
// DateNav — top header with prev/next/today buttons.
// Extracted from daily-tracker.tsx during SPLIT-PHASE3.
//
// PREMIUM REDESIGN (Rutina Aurora / Task 2-b): the plain PageHeader is
// replaced with a premium rounded-pill date bar — `.premium-card` gradient
// surface + sheen, a live "today" pulse dot, ghost circular arrow buttons,
// and a tinted "Hari ini" quick-jump chip (only when viewing another day).
// The h2 heading, description text and aria-labels are preserved.
// ---------------------------------------------------------------------------

'use client';

import { format, id as idLocale } from '@/lib/date-utils';
// PERF-FIX (FIX-TIER3 / Fix 15): replaced `date-fns` with native Intl-based
// utility module. Output is identical for the patterns used here
// ('EEEE', 'MMM d, yyyy') — verified via test script in worklog FIX-TIER3
// entry.
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DateNav({
  isToday,
  dateObj,
  dayOfMonth,
  daysInMonth,
  onPrev,
  onNext,
  onToday,
}: {
  isToday: boolean;
  dateObj: Date;
  dayOfMonth: number;
  daysInMonth: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const weekday = format(dateObj, 'EEEE', { locale: idLocale });
  const dateLabel = format(dateObj, 'd MMM yyyy', { locale: idLocale });

  return (
    <nav aria-label="Navigasi tanggal" className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={onPrev}
        className="shrink-0 h-10 w-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent"
        aria-label="Hari sebelumnya"
      >
        <ChevronLeft className="h-4.5 w-4.5" />
      </Button>

      {/* Date pill — premium segment-style bar */}
      <div className="premium-card premium-card-sheen flex-1 min-w-0 flex items-center gap-3 rounded-full px-4 py-2">
        {isToday ? (
          <span aria-hidden="true" className="relative flex h-2 w-2 shrink-0">
            <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold tracking-tight truncate leading-tight">
            {isToday ? 'Hari Ini' : weekday}
          </h2>
          <p className="text-[11px] text-muted-foreground tabular-nums truncate leading-tight mt-0.5">
            {dateLabel} · Hari {dayOfMonth}/{daysInMonth}
          </p>
        </div>
        {!isToday && (
          <button
            type="button"
            onClick={onToday}
            aria-label="Kembali ke hari ini"
            className="shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-primary/10 text-primary dark:bg-primary/15 text-[10px] font-semibold uppercase tracking-wider hover:bg-primary/20 active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Calendar className="h-3 w-3" />
            Hari ini
          </button>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onNext}
        className="shrink-0 h-10 w-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent"
        aria-label="Hari berikutnya"
      >
        <ChevronRight className="h-4.5 w-4.5" />
      </Button>
    </nav>
  );
}
