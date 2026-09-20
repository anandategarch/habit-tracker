'use client';

// components/habit-tracker/calendar-month-header.tsx — header halaman
// "Kalender" + navigasi bulan (tombol prev/next + dropdown pilih bulan).
// Dipecah dari calendar-view.tsx (Task 71-j) — JSX, a11y & label identik.

import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CalendarMonthHeaderProps {
  selectedMonth: string;
  onSelectedMonthChange: (month: string) => void;
  monthOptions: { value: string; label: string }[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export function CalendarMonthHeader({
  selectedMonth,
  onSelectedMonthChange,
  monthOptions,
  onPrevMonth,
  onNextMonth,
}: CalendarMonthHeaderProps) {
  return (
    <PageHeader
      title="Kalender"
      subtitle="Visualisasikan penyelesaian habit kamu dalam heatmap bulanan."
      icon={CalendarDays}
      eyebrow="Riwayat"
    >
      <Button
        variant="outline"
        size="icon"
        onClick={onPrevMonth}
        aria-label="Bulan sebelumnya"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Select value={selectedMonth} onValueChange={onSelectedMonthChange}>
        <SelectTrigger className="w-[168px]" aria-label="Pilih bulan">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {monthOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        onClick={onNextMonth}
        aria-label="Bulan berikutnya"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </PageHeader>
  );
}
