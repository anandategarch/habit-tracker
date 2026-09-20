'use client';

// ---------------------------------------------------------------------------
// src/components/gym/program-week-strip.tsx — strip 7 hari program aktif
// (Task 75 F4, diekstrak supaya program-today-card.tsx tetap ramping).
//
// Satu sel per hari (urut awal minggu pengaturan — payload sudah mengurut):
//   * istirahat (bukan hari latihan) → mute dengan "–"
//   * selesai (semua zona ✓)         → emerald + centang
//   * terlewat (sudah lewat, belum)  → rose
//   * hari ini (belum tuntas)        → aksen primary + ring
//   * terjadwal depan                → netral
// Tooltip title membawa rincian lengkap (judul hari + progres zona).
// ---------------------------------------------------------------------------

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dowLabelFull, dowLabelShort, type GymProgramWeekEntry } from '@/lib/muscle-map';

function entryTitle(e: GymProgramWeekEntry): string {
  if (e.zones.length === 0) return `${dowLabelFull(e.dow)} — istirahat`;
  const progress = `${e.doneCount}/${e.zones.length} zona`;
  const state = e.beforeStart
    ? 'sebelum program dimulai'
    : e.done
      ? 'selesai ✓'
      : e.isPast
        ? 'terlewat'
        : e.isToday
          ? 'hari ini'
          : 'menunggu';
  return `${dowLabelFull(e.dow)} — ${e.title} (${progress}, ${state})`;
}

function cellClass(e: GymProgramWeekEntry): string {
  if (e.beforeStart) {
    // Sebelum aktivasi program — netral redup (bukan "terlewat").
    return 'border-dashed border-border/50 bg-muted/20 text-muted-foreground/70';
  }
  if (e.zones.length === 0) {
    return 'border-transparent bg-muted/30 text-muted-foreground/60';
  }
  if (e.done) return 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  if (e.isPast) return 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400';
  if (e.isToday) return 'border-primary/60 bg-primary/10 text-primary font-bold ring-1 ring-primary/30';
  return 'border-border/70 bg-card/40 text-foreground/80';
}

export function ProgramWeekStrip({ week, className }: { week: GymProgramWeekEntry[]; className?: string }) {
  return (
    <div
      className={cn('grid grid-cols-7 gap-1', className)}
      role="img"
      aria-label={week
        .map((e) =>
          `${dowLabelShort(e.dow)}: ${
            e.zones.length === 0
              ? 'istirahat'
              : e.beforeStart
                ? 'belum mulai'
                : e.done
                  ? 'selesai'
                  : e.isPast
                    ? 'terlewat'
                    : e.isToday
                      ? 'hari ini'
                      : 'latihan'
          }`,
        )
        .join(', ')}
    >
      {week.map((e) => (
        <div
          key={e.ymd}
          title={entryTitle(e)}
          className={cn(
            'flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-lg border px-0.5 py-1.5',
            cellClass(e),
          )}
          aria-hidden="true"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide">{dowLabelShort(e.dow)}</span>
          {e.zones.length === 0 ? (
            <span className="text-xs leading-none opacity-60">–</span>
          ) : e.done ? (
            <Check className="h-3.5 w-3.5 leading-none" />
          ) : (
            <span className="text-[10px] font-semibold tabular-nums leading-none">
              {e.doneCount}/{e.zones.length}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
