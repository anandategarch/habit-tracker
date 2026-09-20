'use client';

// components/habit-tracker/daily-tracker-habit-card-history.tsx — wajah
// BELAKANG kartu (flip): riwayat 7 hari terakhir + streak + legenda.
// FIX-HABIT-GRID-GAP: back face HANYA absolute saat tidak dibalik (premium-
// card yang tak berlayer mengalahkan utilitas Tailwind) — overlay tersembunyi
// saat normal, in-flow saat dibalik.
// Dipecah dari daily-tracker-habit-card.tsx (Task 71-j) — JSX/aria identik.

import { Check, Minus, Shield, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DayCell } from './daily-tracker-habit-card-helpers';

interface HabitCardHistoryProps {
  days: DayCell[];
  isAvoid: boolean;
  streak: number;
  isScheduledDaily: boolean;
  /** YMD hari kosong yang diampuni hari aman (dari streakInfo.shieldedDays). */
  shieldedDays: string[];
  flipped: boolean;
  onClose: () => void;
}

export function HabitCardHistory({
  days,
  isAvoid,
  streak,
  isScheduledDaily,
  shieldedDays,
  flipped,
  onClose,
}: HabitCardHistoryProps) {
  // ── Task 36: lookup hari aman untuk sel riwayat 7 hari ──
  const shieldedSet = new Set(shieldedDays);

  return (
    <div
      className={cn(
        'rounded-2xl premium-card premium-card-sheen [backface-visibility:hidden] [transform:rotateY(180deg)]',
        // FIX-HABIT-GRID-GAP: back face HANYA absolute saat tidak dibalik.
        // (Sebelumnya selalu `absolute inset-0`, tapi .premium-card yang tak
        // berlayer mengalahkan utilitas Tailwind — posisinya jadi relative
        // dan menambah ±150px tinggi tiap kartu = celah palsu antar baris
        // grid. Kini: normal → overlay tersembunyi; dibalik → in-flow, jadi
        // container membesar pas dengan konten riwayat.)
        flipped ? 'pointer-events-auto' : 'habit-flip-overlay pointer-events-none',
      )}
      aria-hidden={!flipped}
    >
      <div className="relative p-3.5 sm:p-4 h-full flex flex-col">
        <div className="flex items-center justify-between mb-2.5 gap-2">
          <p className="premium-label">7 Hari Terakhir</p>
          <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
            {isAvoid ? `Bersih ${streak} hari` : `Streak ${streak} hari`}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Tutup riwayat 7 hari"
            className="h-9 w-9 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 flex-1">
          {days.map((day) => {
            // Task 36: hari 'miss' yang diampuni hari aman → tampak 🛡
            // (streak tetap nyambung lewat hari itu).
            const isShielded = !isAvoid && day.state === 'miss' && shieldedSet.has(day.ymd);
            return (
            <div
              key={day.ymd}
              title={`${day.ymd}${
                day.state === 'off'
                  ? ' — di luar jadwal'
                  : day.state === 'prestart'
                    ? ' — sebelum tanggal mulai'
                    : isShielded
                    ? ' — hari aman (streak tetap jalan)'
                    : day.state === 'relapse'
                      ? ' — kambuh'
                      : day.state === 'done'
                        ? ' — selesai'
                        : ''
              }`}
              className={cn(
                'rounded-lg flex flex-col items-center justify-center gap-0.5 py-1.5 min-h-[52px]',
                day.isSelected && 'ring-1 ring-primary/60',
                day.state === 'done' && 'bg-teal-500/20 dark:bg-teal-500/25',
                day.state === 'clean' && 'bg-emerald-500/15 dark:bg-emerald-500/20',
                day.state === 'relapse' && 'bg-rose-500/20 dark:bg-rose-500/25',
                isShielded && 'bg-teal-500/15 dark:bg-teal-400/15',
                (day.state === 'off' || day.state === 'prestart') &&
                  'opacity-45 bg-muted/30',
                !isShielded &&
                  (day.state === 'miss' || day.state === 'future') &&
                  'bg-muted/60',
              )}
            >
              <span className="text-[9px] font-semibold text-muted-foreground uppercase">
                {day.label}
              </span>
              <span className="text-[11px] font-bold text-foreground tabular-nums">
                {day.dayNum}
              </span>
              <span className="text-[10px] leading-none" aria-hidden="true">
                {day.state === 'done' && (
                  <Check className="h-3 w-3 text-teal-600 dark:text-teal-400" />
                )}
                {day.state === 'clean' && (
                  <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                )}
                {day.state === 'relapse' && (
                  <X className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                )}
                {isShielded && (
                  <Shield className="h-3 w-3 text-teal-600 dark:text-teal-300" />
                )}
                {day.state === 'miss' && !isShielded && (
                  <span className="block h-3 w-[3px] rounded-full bg-muted-foreground/40" />
                )}
                {(day.state === 'off' || day.state === 'prestart') && (
                  <Minus className="h-3 w-3 text-muted-foreground/50" aria-hidden="true" />
                )}
                {day.state === 'future' && (
                  <span className="block h-1 w-1 rounded-full bg-muted-foreground/30" />
                )}
              </span>
            </div>
            );
          })}
        </div>

        <p className="text-[10px] text-muted-foreground/80 mt-2">
          {isAvoid
            ? 'Hijau = hari bersih tanpa kambuh · merah = kambuh'
            : 'Teal = selesai · 🛡 = hari aman · abu = terlewat'}
          {!isAvoid && !isScheduledDaily && ' · ─ = di luar jadwal'}
        </p>
      </div>
    </div>
  );
}
