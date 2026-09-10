'use client';

// components/habit-tracker/dashboard-last-done.tsx — kartu "Terakhir
// Dilakukan": kapan tiap habit terakhir diselesaikan + streak berjalan.
// Row = tombol 1-klik → openHabitFocus(id) (dialog Analisis Waktu di tracker).

import { Flame, History } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { isValidYMD, jakartaDateString } from '@/lib/timezone';
import { ChartInfo } from './dashboard-helpers';
import type { LastDoneHabitSummary } from './dashboard-types';

/** Label relatif Indonesia dari YMD 'yyyy-MM-dd' terhadap hari ini Jakarta. */
function relativeDayLabel(lastDate: string | null | undefined): string {
  if (!lastDate || !isValidYMD(lastDate)) return 'Belum pernah';
  const [y1, m1, d1] = lastDate.split('-').map(Number);
  const [y2, m2, d2] = jakartaDateString().split('-').map(Number);
  const diff = Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86_400_000);
  if (diff <= 0) return 'Hari ini';
  if (diff === 1) return 'Kemarin';
  return `${diff} hari lalu`;
}

export function LastDoneSummaryCard({ data }: { data: LastDoneHabitSummary[] }) {
  const openHabitFocus = useAppStore((s) => s.openHabitFocus);

  return (
    <section aria-label="Habit terakhir dilakukan">
      <div className="premium-card premium-card-sheen rounded-2xl p-5">
        <h3 className="premium-label mb-4 flex items-center gap-2">
          <span className="chip-soft chip-soft-teal h-8 w-8 justify-center" aria-hidden="true">
            <History className="h-4 w-4" />
          </span>
          Terakhir Dilakukan
          <ChartInfo text="Kapan terakhir kali setiap habit diselesaikan beserta streak berjalan. Klik baris untuk membuka analisis habit di tracker." />
        </h3>
        {data.length === 0 ? (
          <div className="premium-empty">
            <div className="premium-empty-orb">
              <History className="h-8 w-8" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">Belum ada riwayat habit</p>
            <p className="text-xs text-muted-foreground">
              Selesaikan habit pertamamu untuk melihat riwayat di sini.
            </p>
          </div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {data.map((item) => (
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
                  <span className="block truncate text-sm font-medium">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    Terakhir: {relativeDayLabel(item.lastDate)}
                  </span>
                </span>
                {item.streak > 0 && (
                  <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-orange-500">
                    <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                    {item.streak}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
