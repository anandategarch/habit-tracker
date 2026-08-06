'use client';

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { jakartaNowParts } from '@/lib/timezone';

// ── Constants ────────────────────────────────────────────────────────────

// Quick preset chips — common times users pick
const QUICK_PRESETS = [
  { label: 'Sekarang', value: '__now__' },
  { label: '07:00', value: '07:00' },
  { label: '12:00', value: '12:00' },
  { label: '18:00', value: '18:00' },
  { label: '22:00', value: '22:00' },
];

// Hour options: 00-23
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

// Minute options: step 5 (00, 05, 10, ..., 55)
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

// ── Component ────────────────────────────────────────────────────────────

interface TimePickerProps {
  value: string; // "HH:mm" format, e.g. "07:30"
  onChange: (value: string) => void;
  className?: string;
}

/**
 * TimePicker — custom time picker replacing native <input type="time">.
 *
 * Features:
 * - Quick chips: "Sekarang" (auto-fill current Jakarta time) + common times
 * - Two Select dropdowns: Jam (00-23) + Menit (step 5: 00, 05, 10, ...)
 * - Uses shadcn/ui Select components (consistent with app design)
 * - 24-hour format (consistent across all devices, no AM/PM confusion)
 *
 * Why not native <input type="time">:
 * - Different appearance per browser/OS
 * - Mobile opens OS wheel picker (clunky, doesn't match app design)
 * - Desktop has tiny spinner (hard to click, outdated look)
 * - 12h/24h depends on browser locale (inconsistent)
 */
export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [hours, minutes] = value.split(':');
  const currentHours = hours || '00';
  const currentMinutes = minutes || '00';

  const handlePreset = (preset: string) => {
    if (preset === '__now__') {
      const p = jakartaNowParts();
      const h = String(p.hours).padStart(2, '0');
      const m = String(Math.floor(p.minutes / 5) * 5).padStart(2, '0'); // round to nearest 5
      onChange(`${h}:${m}`);
    } else {
      onChange(preset);
    }
  };

  const handleHourChange = (h: string) => {
    onChange(`${h}:${currentMinutes}`);
  };

  const handleMinuteChange = (m: string) => {
    onChange(`${currentHours}:${m}`);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Quick chips */}
      <div className="flex flex-wrap gap-1">
        {QUICK_PRESETS.map((preset) => {
          const isActive = preset.value !== '__now__' && preset.value === value;
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => handlePreset(preset.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-[11px] font-medium border transition-colors min-h-[40px] flex items-center',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background/60 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Hour : Minute dropdowns */}
      <div className="flex items-center gap-1">
        <Select value={currentHours} onValueChange={handleHourChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {HOURS.map((h) => (
              <SelectItem key={h} value={h}>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-lg font-bold text-muted-foreground shrink-0">:</span>

        <Select value={currentMinutes} onValueChange={handleMinuteChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {MINUTES.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
