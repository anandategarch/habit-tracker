// ---------------------------------------------------------------------------
// DateNav — top header with prev/next/today buttons.
// Extracted from daily-tracker.tsx during SPLIT-PHASE3.
// ---------------------------------------------------------------------------

'use client';

import { format, id as idLocale } from '@/lib/date-utils';
// PERF-FIX (FIX-TIER3 / Fix 15): replaced `date-fns` with native Intl-based
// utility module. Output is identical for the patterns used here
// ('EEEE', 'MMM d, yyyy') — verified via test script in worklog FIX-TIER3
// entry.
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';

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
  return (
    <PageHeader
      title={isToday ? 'Hari Ini' : format(dateObj, 'EEEE', { locale: idLocale })}
      description={`${format(dateObj, 'd MMM yyyy', { locale: idLocale })} · Hari ${dayOfMonth}/${daysInMonth}`}
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrev}
            className="shrink-0 h-9 w-9 rounded-xl hover:bg-accent"
            aria-label="Hari sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            className="shrink-0 h-9 w-9 rounded-xl hover:bg-accent"
            aria-label="Hari berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToday}
              className="shrink-0 rounded-xl h-9"
            >
              <Calendar className="h-3.5 w-3.5" />
              Hari Ini
            </Button>
          )}
        </div>
      }
    />
  );
}
