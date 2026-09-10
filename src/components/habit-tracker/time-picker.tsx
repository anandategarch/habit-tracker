'use client';

// components/habit-tracker/time-picker.tsx — input jam manual + tombol
// "Sekarang" (waktu Jakarta via jakartaNowParts — bukan jam browser).

import { Clock3 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { jakartaNowParts } from '@/lib/timezone';
import { padTime } from './daily-tracker-helpers';

interface TimePickerProps {
  /** 'HH:mm' (jam Jakarta). */
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES_STEP = 5;
const MINUTES = Array.from({ length: 60 / MINUTES_STEP }, (_, i) => i * MINUTES_STEP);

function parseHM(v: string): { hour: number; minute: number } {
  const [h, m] = (v || '').split(':').map(Number);
  const hour = Number.isFinite(h) ? Math.max(0, Math.min(23, h)) : 0;
  const minute = Number.isFinite(m) ? Math.max(0, Math.min(59, m)) : 0;
  return { hour, minute };
}

export function TimePicker({ value, onChange, disabled }: TimePickerProps) {
  const { hour, minute } = parseHM(value);
  // Menit nilai sekarang bisa bukan kelipatan 5 (mis. dari "Sekarang" 14:32)
  // — tetap tampilkan sebagai opsi tambahan supaya tidak "melompat".
  const minuteOptions = MINUTES.includes(minute)
    ? MINUTES
    : [...MINUTES, minute].sort((a, b) => a - b);

  const setNow = () => {
    const now = jakartaNowParts();
    onChange(padTime(now.hour, now.minute));
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={String(hour)}
        onValueChange={(v) => onChange(padTime(Number(v), minute))}
        disabled={disabled}
      >
        <SelectTrigger className="w-[74px]" aria-label="Jam">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {HOURS.map((h) => (
            <SelectItem key={h} value={String(h)}>
              {String(h).padStart(2, '0')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-muted-foreground font-semibold" aria-hidden="true">
        :
      </span>

      <Select
        value={String(minute)}
        onValueChange={(v) => onChange(padTime(hour, Number(v)))}
        disabled={disabled}
      >
        <SelectTrigger className="w-[74px]" aria-label="Menit">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {minuteOptions.map((m) => (
            <SelectItem key={m} value={String(m)}>
              {String(m).padStart(2, '0')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={setNow}
        disabled={disabled}
        className="h-8 px-2.5 text-xs shrink-0"
        aria-label="Gunakan waktu sekarang (Jakarta)"
        title="Gunakan waktu sekarang"
      >
        <Clock3 className="h-3.5 w-3.5" />
        Sekarang
      </Button>
    </div>
  );
}
