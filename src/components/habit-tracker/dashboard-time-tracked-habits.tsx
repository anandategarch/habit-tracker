'use client';

// components/habit-tracker/dashboard-time-tracked-habits.tsx — kartu "Waktu
// Habit": total menit tercatat per habit (habit trackTime) dalam periode.
// Row = tombol 1-klik → openHabitFocus(id) (dialog Analisis Waktu).
// Bar relatif memakai CSS var(--primary) — otomatis mengikuti tema/warna app.

import { Clock } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { ChartInfo } from './dashboard-helpers';
import type { TimeTrackedHabitSummary } from './dashboard-types';

/** 125 → '2j 5m'; 60 → '1j'; 45 → '45m'. */
function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h > 0) return rest > 0 ? `${h}j ${rest}m` : `${h}j`;
  return `${rest}m`;
}

export function TimeTrackedHabits({ data }: { data: TimeTrackedHabitSummary[] }) {
  const openHabitFocus = useAppStore((s) => s.openHabitFocus);
  const maxMinutes = data.reduce((max, d) => Math.max(max, Number(d.minutes) || 0), 0);

  return (
    <section aria-label="Waktu habit tercatat">
      <div className="premium-card premium-card-sheen rounded-2xl p-5">
        <h3 className="premium-label mb-4 flex items-center gap-2">
          <span className="chip-soft chip-soft-teal h-8 w-8 justify-center" aria-hidden="true">
            <Clock className="h-4 w-4" />
          </span>
          Waktu Habit Tercatat
          <ChartInfo text="Total waktu yang dicatat per habit dalam periode yang dipilih. Klik baris untuk membuka analisis waktunya di tracker." />
        </h3>
        {data.length === 0 ? (
          <div className="premium-empty">
            <div className="premium-empty-orb">
              <Clock className="h-8 w-8" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">Belum ada waktu tercatat</p>
            <p className="text-xs text-muted-foreground">
              Habit dengan pencatatan waktu akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {data.map((item) => {
              const minutes = Number(item.minutes) || 0;
              const barPct =
                maxMinutes > 0 && minutes > 0 ? Math.max(6, Math.round((minutes / maxMinutes) * 100)) : 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openHabitFocus(item.id)}
                  aria-label={`Lihat analisis waktu habit ${item.name}`}
                  className="premium-list-item w-full cursor-pointer p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <span
                    className="chip-soft chip-soft-teal h-9 w-9 shrink-0 justify-center text-base"
                    aria-hidden="true"
                  >
                    {item.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">{item.name}</span>
                      <span className="premium-stat shrink-0 text-sm">{formatMinutes(minutes)}</span>
                    </span>
                    <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn('premium-progress-fill block h-full rounded-full')}
                        style={{ width: `${barPct}%` }}
                      />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
