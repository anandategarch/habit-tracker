'use client';

// components/habit-tracker/calendar-day-cell.tsx — satu sel hari kalender
// heatmap: tombol nyata (klik → openTrackerDate), marker mood, persentase +
// bar mini, dan styling threshold Aurora.
// Dipecah dari calendar-view.tsx (Task 71-j) — className/aria/anim identik.

import { isBefore, startOfDay } from '@/lib/date-utils';
import { MOOD_EMOJIS } from '@/lib/mood';
import {
  buildDayAriaLabel,
  getDayNumTextColor,
  getHeatmapColor,
  getHeatmapHover,
  getHeatmapTextColor,
} from './calendar-helpers';
import type { DayData } from './calendar-types';

interface CalendarDayCellProps {
  day: DayData;
  onDayClick: (dayStr: string) => void;
}

export function CalendarDayCell({ day, onDayClick }: CalendarDayCellProps) {
  return (
    <button
      type="button"
      onClick={() => onDayClick(day.dayStr)}
      aria-label={buildDayAriaLabel(day)}
      className={`
        relative min-h-[72px] sm:min-h-[88px] md:min-h-[100px] rounded-lg p-1.5 sm:p-2 text-left
        transition-all duration-150 cursor-pointer active:scale-95
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60
        ${getHeatmapColor(day.completionRate)}
        ${getHeatmapHover(day.completionRate)}
        ${!day.isCurrentMonth ? 'opacity-35' : ''}
        ${day.isToday ? 'ring-2 ring-primary ring-offset-2 ring-offset-background anim-glow-breathe' : ''}
      `}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-xs sm:text-sm font-medium ${getDayNumTextColor(day)}`}
        >
          {day.dayNum}
        </span>
        {/* Mood marker dari daily-logs */}
        {day.isCurrentMonth && day.mood !== null && (
          <span className="text-[10px] leading-none" aria-hidden="true">
            {MOOD_EMOJIS[Math.round(day.mood)] ?? '🙂'}
          </span>
        )}
      </div>

      {day.isCurrentMonth && day.completionRate !== null && (
        <div className="mt-1 flex flex-col items-center gap-0.5">
          <span
            className={`text-xs font-bold ${getHeatmapTextColor(day.completionRate)}`}
          >
            {day.completionRate}%
          </span>
          <div className="w-full bg-foreground/10 rounded-full h-1 overflow-hidden">
            <div
              className="h-full rounded-full bg-foreground/60 transition-all duration-300"
              style={{
                width: `${Math.max(day.completionRate, 0)}%`,
              }}
            />
          </div>
        </div>
      )}

      {day.isCurrentMonth &&
        day.completionRate === null &&
        !isBefore(new Date(), startOfDay(day.date)) && (
          <div className="mt-1 text-center">
            <span className="text-xs text-muted-foreground">—</span>
          </div>
        )}
    </button>
  );
}
