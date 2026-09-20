'use client';

// components/habit-tracker/calendar-month-summary.tsx — "Ringkasan {bulan}":
// kartu Rata-rata, Hari Dilacak, dan tombol Hari Terbaik/Terburuk
// (CONNECTED-APP: membuka tracker pada tanggal itu).
// Dipecah dari calendar-view.tsx (Task 71-j) — JSX/aria/label identik.

import { CalendarCheck, Droplets, Flame, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { mmmDdIdFormatter } from '@/lib/date-utils';
import type { MonthSummary } from './calendar-types';

interface CalendarMonthSummaryProps {
  monthLabel: string;
  monthSummary: MonthSummary;
  onOpenDate: (dayStr: string) => void;
}

export function CalendarMonthSummary({
  monthLabel,
  monthSummary,
  onOpenDate,
}: CalendarMonthSummaryProps) {
  return (
    <section className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="chip-soft chip-soft-amber h-8 w-8">
          <Flame className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-semibold text-foreground">
          Ringkasan {monthLabel}
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="premium-card p-3.5 sm:p-4">
          <div className="flex items-center gap-2">
            <span className="chip-soft chip-soft-teal h-8 w-8 shrink-0">
              <TrendingUp className="h-4 w-4" />
            </span>
            <span className="premium-label truncate">Rata-rata</span>
          </div>
          <p className="premium-stat text-2xl mt-3 text-foreground">
            {monthSummary.avg.toFixed(1)}%
          </p>
          <p className="text-[11px] mt-1 text-muted-foreground">
            Penyelesaian per hari aktif
          </p>
        </div>

        <div className="premium-card p-3.5 sm:p-4">
          <div className="flex items-center gap-2">
            <span className="chip-soft chip-soft-violet h-8 w-8 shrink-0">
              <CalendarCheck className="h-4 w-4" />
            </span>
            <span className="premium-label truncate">Hari Dilacak</span>
          </div>
          <p className="premium-stat text-2xl mt-3 text-foreground">
            {monthSummary.entries}
          </p>
          <p className="text-[11px] mt-1 text-muted-foreground">
            Hari dengan data bulan ini
          </p>
        </div>

        {/* CONNECTED-APP: kartu Hari Terbaik/Terburuk membuka tracker
            pada tanggal itu — angka baru punya konteks aslinya. */}
        {monthSummary.best && (
          <button
            type="button"
            onClick={() => onOpenDate(monthSummary.best!.dayStr)}
            aria-label={`Buka hari terbaik ${mmmDdIdFormatter(monthSummary.best.date)} — ${monthSummary.best.completionRate}% selesai`}
            className="premium-card w-full cursor-pointer p-3.5 text-left transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:p-4"
          >
            <div className="flex items-center gap-2">
              <span className="chip-soft chip-soft-amber h-8 w-8 shrink-0">
                <Flame className="h-4 w-4" />
              </span>
              <span className="premium-label truncate">Hari Terbaik</span>
            </div>
            <p className="premium-stat text-2xl mt-3 text-foreground">
              {mmmDdIdFormatter(monthSummary.best.date)}
            </p>
            <p className="mt-1.5">
              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary hover:bg-primary/10 text-[10px]"
              >
                {monthSummary.best.completionRate}% selesai
              </Badge>
            </p>
          </button>
        )}

        {monthSummary.worst && (
          <button
            type="button"
            onClick={() => onOpenDate(monthSummary.worst!.dayStr)}
            aria-label={`Buka hari terburuk ${mmmDdIdFormatter(monthSummary.worst.date)} — ${monthSummary.worst.completionRate}% selesai`}
            className="premium-card w-full cursor-pointer p-3.5 text-left transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:p-4"
          >
            <div className="flex items-center gap-2">
              <span className="chip-soft chip-soft-rose h-8 w-8 shrink-0">
                <Droplets className="h-4 w-4" />
              </span>
              <span className="premium-label truncate">Hari Terburuk</span>
            </div>
            <p className="premium-stat text-2xl mt-3 text-foreground">
              {mmmDdIdFormatter(monthSummary.worst.date)}
            </p>
            <p className="mt-1.5">
              <Badge
                variant="secondary"
                className="bg-destructive/10 text-destructive hover:bg-destructive/10 text-[10px]"
              >
                {monthSummary.worst.completionRate}% selesai
              </Badge>
            </p>
          </button>
        )}
      </div>

      {monthSummary.entries === 0 && (
        <div className="mt-4 text-center text-sm text-muted-foreground py-4">
          Belum ada hari yang dilacak bulan ini. Mulai selesaikan habit!
        </div>
      )}
    </section>
  );
}
