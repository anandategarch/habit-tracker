'use client';

// components/habit-tracker/today-habits.tsx — Task 44 "Today's Habits".
//
// Seksi konten Beranda (tier 2): SELURUH rutinitas terjadwal hari ini —
// yang belum selesai (aksi) DAN yang sudah (dirayakan, ceklis hijau).
// Pengganti seksi lama "Fokus Hari Ini" yang hanya menampilkan sisi
// negatif (yang belum selesai).
//
// Interaksi mengikuti pola 1-klik yang sudah teruji di seksi lama:
// - baris utama → openTrackerDate(hari ini)   → grid tracker siap diselesaikan
// - tombol ikon → openHabitFocus(id)           → dialog analisis waktu habit
// - CTA kosong  → triggerQuickAdd('habit') + tab settings (jalur FAB "Habit Baru")
//
// Data murni props (dari /api/dashboard focusToday via contract) — tidak
// ada fetch, tidak mengubah logic completion apa pun.

import { BarChart3, Check, Sunrise } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TreeProgress } from '@/components/ui/loaders';
import type { TodayHabitItem } from './dashboard-types';

interface TodayHabitsCardProps {
  habits: TodayHabitItem[];
  /** 'yyyy-MM-dd' Jakarta hari ini — target deep-link tracker. */
  todayStr: string;
  onOpenTracker: (date: string) => void;
  onOpenHabit: (habitId: string) => void;
  /** Jalur FAB: triggerQuickAdd('habit') + pindah tab settings. */
  onAddHabit: () => void;
}

const priorityVariant = (p?: string) => {
  switch ((p ?? 'medium').toLowerCase()) {
    case 'high':
    case 'tinggi':
      return 'destructive' as const;
    case 'medium':
    case 'sedang':
      return 'default' as const;
    default:
      return 'secondary' as const;
  }
};

export function TodayHabitsCard({
  habits,
  todayStr,
  onOpenTracker,
  onOpenHabit,
  onAddHabit,
}: TodayHabitsCardProps) {
  // Yang belum selesai dulu (bisa ditindak), lalu yang sudah (dirayakan).
  const pending = habits.filter((h) => !h.completed);
  const done = habits.filter((h) => h.completed);

  return (
    <section
      className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 premium-fade-up"
      aria-label="Rutinitas hari ini"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 text-sm font-semibold">
          <span className="chip-soft chip-soft-teal h-8 w-8" aria-hidden="true">
            <Sunrise className="h-4 w-4" />
          </span>
          Rutinitas Hari Ini
        </h3>
        {habits.length > 0 && (
          <Badge variant="secondary" className="shrink-0 text-xs tabular-nums">
            {done.length}/{habits.length} selesai
          </Badge>
        )}
      </div>

      {habits.length === 0 ? (
        /* Empty state — hidup & mengundang (bukan "No data"). */
        <div className="premium-empty">
          <TreeProgress size={64} growth={0} />
          <p className="text-sm font-semibold">🌱 Belum ada rutinitas</p>
          <p className="max-w-[26ch] text-center text-[13px] text-muted-foreground">
            Mulai dengan satu rutinitas kecil. Kamu tidak perlu mengubah semuanya
            sekaligus.
          </p>
          <Button size="sm" onClick={onAddHabit} className="btn-primary-gradient anim-press">
            Tambah Rutinitas Pertama
          </Button>
        </div>
      ) : pending.length === 0 ? (
        /* Semua selesai — rayakan, jangan tinggalkan kartu kosong. */
        <div className="premium-empty">
          <TreeProgress size={64} growth={1} />
          <p className="text-sm font-semibold">Semua selesai hari ini 🌳</p>
          <p className="max-w-[30ch] text-center text-[13px] text-muted-foreground">
            {done.length} rutinitas tuntas. Nikmati sisanya — kamu sudah
            menumbuhkan harimu.
          </p>
        </div>
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {pending.map((habit) => (
            <div key={habit.id} className="group/row flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenTracker(todayStr)}
                aria-label={`Buka tracker hari ini untuk menyelesaikan rutinitas ${habit.name}`}
                className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/70 p-2.5 text-left transition-colors hover:border-primary/30 hover:bg-muted/50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="chip-soft chip-soft-teal h-9 w-9 shrink-0 text-base" aria-hidden="true">
                    {habit.icon}
                  </span>
                  <span className="truncate text-sm font-medium">{habit.name}</span>
                </div>
                {habit.priority && (
                  <Badge variant={priorityVariant(habit.priority)} className="shrink-0 text-xs">
                    {habit.priority}
                  </Badge>
                )}
              </button>
              <button
                type="button"
                onClick={() => onOpenHabit(habit.id)}
                aria-label={`Lihat analisis waktu rutinitas ${habit.name}`}
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus-visible:opacity-100"
              >
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}

          {done.length > 0 && pending.length > 0 && (
            <div className="premium-label px-1 pt-2" aria-hidden="true">
              Selesai hari ini
            </div>
          )}

          {done.map((habit) => (
            <div key={habit.id} className="group/row flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenTracker(todayStr)}
                aria-label={`Rutinitas ${habit.name} sudah selesai hari ini — buka tracker`}
                className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-2.5 text-left transition-colors hover:border-primary/30 hover:bg-muted/50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="chip-soft chip-soft-teal h-9 w-9 shrink-0 text-base opacity-80" aria-hidden="true">
                    {habit.icon}
                  </span>
                  <span className="truncate text-sm font-medium text-muted-foreground">
                    {habit.name}
                  </span>
                </div>
                <span
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
                  aria-label={`${habit.name} selesai`}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                  Selesai
                </span>
              </button>
              <button
                type="button"
                onClick={() => onOpenHabit(habit.id)}
                aria-label={`Lihat analisis waktu rutinitas ${habit.name}`}
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus-visible:opacity-100"
              >
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {habits.length > 0 && pending.length > 0 && (
        <p className={cn('mt-3 text-center text-[12px] text-muted-foreground')}>
          Ketuk rutinitas untuk membuka tracker dan menyelesaikannya.
        </p>
      )}
    </section>
  );
}
