'use client';

// components/habit-tracker/finance-detail-upcoming.tsx — sektor 5 detail
// Ringkasan: Tagihan Mendatang (diekstrak verbatim dari
// finance-detail-sections.tsx, Task 71-i).
//
// Tagihan/pemasukan berulang ≤30 hari + telat; label waktu (Terlambat/Mulai/
// Hari ini/Besok/N hari lagi) + badge tone.

import { CalendarClock, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { compactRupiahSafe } from './finance-types';
import { formatDateShort, tintFromColor } from '@/lib/finance-helpers';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';
import type { DashboardData } from './finance-types';
import { daysFromToday, frequencyLabel, weekdayShort, type Stagger } from './finance-detail-utils';

export function UpcomingRecurringList({
  upcoming,
  stagger,
}: Stagger & { upcoming: NonNullable<DashboardData['upcomingRecurring']> }) {
  const openFinanceSubTab = useAppStore(s => s.openFinanceSubTab);
  if (upcoming.length === 0) return null;
  const items = upcoming.slice(0, 6);

  return (
    <section
      className="premium-card premium-card-sheen rounded-2xl anim-stagger"
      style={{ '--stagger': stagger } as CSSProperties}
      aria-label="Tagihan dan pemasukan berulang mendatang"
    >
      <div className="flex items-center justify-between gap-2 p-4 pb-2 sm:p-5 sm:pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="chip-icon chip-violet h-8 w-8 shrink-0" aria-hidden="true">
            <CalendarClock className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold">Tagihan Mendatang</h3>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
          onClick={() => openFinanceSubTab('recurring')}
          aria-label="Kelola transaksi berulang"
        >
          Kelola
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      <div className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-1">
        {items.map(item => {
          const days = daysFromToday(item.nextDate);
          const whenLabel = item.overdue
            ? 'Terlambat'
            : item.notStarted
              ? 'Mulai'
              : days === 0
                ? 'Hari ini'
                : days === 1
                  ? 'Besok'
                  : `${days} hari lagi`;
          const whenTone = item.overdue
            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
            : item.notStarted
              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
              : days <= 3
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'bg-muted text-muted-foreground';
          return (
            <button
              key={item.id}
              type="button"
              className="w-full px-2 py-2 rounded-xl text-left cursor-pointer transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.99]"
              onClick={() => openFinanceSubTab('recurring')}
              aria-label={`Kelola ${item.name} — ${weekdayShort(item.nextDate)} ${formatDateShort(item.nextDate)}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="h-9 w-9 rounded-xl grid place-items-center text-base shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                  style={{ backgroundColor: tintFromColor('#8b5cf6') }}
                  aria-hidden="true"
                >
                  {item.emoji}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{item.name}</span>
                    <span
                      className={cn(
                        'text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
                        whenTone
                      )}
                    >
                      {whenLabel}
                    </span>
                  </span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    {frequencyLabel(item.frequency)} · {weekdayShort(item.nextDate)},{' '}
                    {formatDateShort(item.nextDate)}
                    {item.sourceName ? ` · ${item.sourceName}` : ''}
                  </span>
                </span>
                <span
                  className={cn(
                    'text-sm font-semibold tabular-nums shrink-0',
                    item.type === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  )}
                >
                  {item.type === 'income' ? '+' : '−'}{compactRupiahSafe(item.amount)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
