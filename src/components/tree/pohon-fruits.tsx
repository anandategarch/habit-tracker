'use client';

// components/tree/pohon-fruits.tsx — ⑤ BUAH EMAS — PANEN NYATA tab Pohon.
//
// Diekstraksi dari pohon-screen.tsx saat SPLIT god-file (Task 71-g) —
// JSX/aria identik. Buah emas = kemenangan nyata: tujuan berstatus selesai
// + habit lulus (graduatedAt). TASK 66: buah habit tetap 1-tap ke
// konteksnya (openHabitFocus); buah tujuan kini statis (tab Tujuan
// dihapus) — dirender sebagai div non-interaktif.

import { Apple, ArrowUpRight } from 'lucide-react';
import { shortDateLabel, type FruitItem } from './pohon-content';

export interface PohonFruitsProps {
  fruits: FruitItem[];
  onOpenHabitFocus: (habitId: string) => void;
}

export function PohonFruits({ fruits, onOpenHabitFocus }: PohonFruitsProps) {
  return (
    <section className="rounded-2xl border border-teal-900/50 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-foreground">Buah Emas</h2>
        <p className="text-[11px] font-medium text-muted-foreground">
          {fruits.length > 0 ? `${fruits.length} kemenangan dipanen` : 'panenan pertamamu menunggu'}
        </p>
      </div>

      {fruits.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-[#E7B64B]/30 bg-[#E7B64B]/[0.06] p-4 text-center">
          <Apple className="mx-auto h-5 w-5 text-[#E7B64B]/70" aria-hidden="true" />
          <p className="mt-2 text-[12.5px] font-medium leading-relaxed text-muted-foreground">
            Luluskan sebuah <strong className="text-foreground">habit</strong> — kemenangan pertamamu akan
            menggantung di sini sebagai buah emas.
          </p>
        </div>
      ) : (
        <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1" aria-label="Daftar buah emas">
          {fruits.map((f) => {
            const label = shortDateLabel(f.date);
            // TASK 66: buah goal (tujuan selesai) kini tampilan statis —
            // tab Tujuan sudah dihapus; buah habit tetap 1-tap ke konteks.
            const isGoal = f.kind === 'goal';
            const fruitBody = (
              <>
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#FFE99A] to-[#D89A2B] text-[#241703] shadow-[0_4px_10px_-2px_rgba(216,154,43,0.5)]"
                >
                  {f.emoji ? <span className="text-base leading-none">{f.emoji}</span> : <Apple className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-foreground">{f.title}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {isGoal ? 'Tujuan tercapai' : 'Habit lulus'}
                    {label ? ` · ${label}` : ''}
                  </span>
                </span>
              </>
            );
            return (
              <li key={`${f.kind}-${f.id}`}>
                {isGoal ? (
                  <div
                    aria-label={`Buah emas ${f.title} — tujuan selesai${label ? ` sejak ${label}` : ''}.`}
                    className="flex w-full items-center gap-3 rounded-xl border border-[#E7B64B]/20 bg-[#E7B64B]/[0.05] p-3 text-left"
                  >
                    {fruitBody}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenHabitFocus(f.id)}
                    aria-label={`Buah emas ${f.title} — habit lulus${label ? ` sejak ${label}` : ''}. Buka konteksnya.`}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-[#E7B64B]/20 bg-[#E7B64B]/[0.05] p-3 text-left transition-colors hover:bg-[#E7B64B]/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E7B64B]/60"
                  >
                    {fruitBody}
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#E7B64B]" aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
