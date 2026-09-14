'use client';

// components/habit-tracker/daily-tracker-comeback-banner.tsx — Task 36
// Banner Kembali (anti-nunda).
//
// Task 38 (split god file): DIEKSTRAKSI dari daily-tracker.tsx — state
// "disembunyikan per hari" (sessionStorage 'rutina-comeback') + JSX identik.
// Parent hanya menghitung kondisi comeback (memo) dan menangani completion.

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Sprout, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Habit } from './daily-tracker-types';

export interface ComebackInfo {
  gapDays: number;
  pick: Habit;
}

export function ComebackBanner({
  comeback,
  todayStr,
  onComplete,
}: {
  comeback: ComebackInfo;
  todayStr: string;
  /** Dipanggil tombol "Tandai Selesai" — parent set confetti ref + toggle. */
  onComplete: (habit: Habit, el: HTMLElement | null) => void;
}) {
  const [comebackHidden, setComebackHidden] = useState(false);
  useEffect(() => {
    try {
      setComebackHidden(window.sessionStorage.getItem('rutina-comeback') === todayStr);
    } catch {
      /* mode privat — anggap belum disembunyikan */
    }
  }, [todayStr]);
  const hideComeback = useCallback(() => {
    setComebackHidden(true);
    try {
      window.sessionStorage.setItem('rutina-comeback', todayStr);
    } catch {
      /* mode privat — cukup sembunyikan di state */
    }
  }, [todayStr]);

  if (comebackHidden) return null;

  return (
    <section
      aria-label="Sambutan kembali"
      className="premium-card premium-card-sheen rounded-2xl p-4 relative overflow-hidden"
    >
      <div
        className="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-transparent pointer-events-none"
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={hideComeback}
        aria-label="Tutup sambutan kembali"
        className="absolute right-2.5 top-2.5 h-7 w-7 rounded-full grid place-items-center text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 z-10"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="relative flex items-start gap-3 pr-8">
        <span className="chip-soft chip-soft-teal h-10 w-10 shrink-0">
          <Sprout className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">
            Senang kamu kembali 🌱
          </p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {comeback.gapDays >= 99
              ? 'Sudah lama tidak mampir — dan tidak apa-apa. Nunda itu manusiawi; yang penting kamu kembali sekarang.'
              : `Cuma berhenti ${comeback.gapDays} hari — bukan gagal, cuma jeda. Mulai dari satu yang paling ringan dulu:`}
          </p>
          {comeback.gapDays < 99 && (
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-semibold min-w-0 max-w-full">
                <span aria-hidden="true">{comeback.pick.emoji}</span>
                <span className="truncate">{comeback.pick.name}</span>
              </span>
              <Button
                size="sm"
                className="btn-primary-gradient anim-press h-8"
                onClick={(e) => {
                  // Confetti dari tombol ini (pola BUG-5: set ref dulu).
                  onComplete(comeback.pick, e.currentTarget);
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Tandai Selesai
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
