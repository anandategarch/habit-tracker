'use client';

// components/habit-tracker/calendar-skeleton.tsx — placeholder memuat kalender
// (dipecah dari calendar-view.tsx — Task 71-j; pola baris weekday + 35 sel
// dengan stagger animationDelay identik).

import { Skeleton } from '@/components/ui/skeleton';

interface CalendarSkeletonProps {
  weekdays: string[];
}

export function CalendarSkeleton({ weekdays }: CalendarSkeletonProps) {
  return (
    <div
      className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5"
      aria-busy="true"
      aria-label="Memuat kalender"
    >
      <div className="grid grid-cols-7 gap-1.5 mb-3">
        {weekdays.map((d) => (
          <Skeleton key={d} className="h-4 rounded-md" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 max-h-[420px] overflow-hidden">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-[60px] sm:h-[68px] rounded-lg"
            style={{ animationDelay: `${(i % 7) * 70}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
