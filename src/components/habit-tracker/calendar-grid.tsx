'use client';

// components/habit-tracker/calendar-grid.tsx — grid kalender bulanan
// (div premium-card, bukan Card shadcn): header weekday + sel hari.
// Dipecah dari calendar-view.tsx (Task 71-j) — layout & kelas identik.

import { CalendarDayCell } from './calendar-day-cell';
import type { DayData } from './calendar-types';

interface CalendarGridProps {
  weekdays: string[];
  days: DayData[];
  onDayClick: (dayStr: string) => void;
}

export function CalendarGrid({ weekdays, days, onDayClick }: CalendarGridProps) {
  return (
    <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 premium-fade-up">
      {/* Header weekday */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekdays.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-semibold text-muted-foreground py-2"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells — setiap hari tombol nyata → openTrackerDate */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => (
          <CalendarDayCell key={day.dayStr} day={day} onDayClick={onDayClick} />
        ))}
      </div>
    </div>
  );
}
