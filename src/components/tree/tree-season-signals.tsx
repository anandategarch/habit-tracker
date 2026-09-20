'use client';

// components/tree/tree-season-signals.tsx — ⑥ SINYAL MUSIM tab Pohon.
//
// Diekstraksi dari pohon-screen.tsx saat SPLIT god-file (Task 71-g) —
// JSX/aria identik. "Legenda" state musiman pohon dalam bentuk chip
// ber-aksi (kompak): berbunga (→ riwayat kalender streak), dorman (→
// kelola habit mode liburan di Settings), daun menguning (→ buka
// analisis habit terlemah); musim tenang bila tak ada sinyal.

import { Flame, Leaf, Palmtree } from 'lucide-react';
import { TREE_BLOOM_STREAK, type TreeGrowthState } from '@/lib/tree-growth';

export interface TreeSeasonSignalsProps {
  tree: TreeGrowthState | null;
  /** Jumlah habit ber-mode liburan (chip dorman). */
  vacationCount: number;
  /** YMD hari ini Jakarta — bulan riwayat = todayStr.slice(0, 7). */
  todayStr: string;
  onOpenTrackerHistory: (month?: string) => void;
  onOpenHabitFocus: (habitId: string) => void;
  /** Buka Settings → bagian habits (dipakai chip dorman). */
  onManageHabits: () => void;
}

export function TreeSeasonSignals({
  tree,
  vacationCount,
  todayStr,
  onOpenTrackerHistory,
  onOpenHabitFocus,
  onManageHabits,
}: TreeSeasonSignalsProps) {
  return (
    <section className="rounded-2xl border border-teal-900/50 bg-card p-4 shadow-sm sm:p-5">
      <h2 className="font-display text-base font-semibold text-foreground">Musim Pohonmu</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {tree?.blooming && (
          <button
            type="button"
            onClick={() => onOpenTrackerHistory(todayStr.slice(0, 7))}
            aria-label="Sedang berbunga — lihat riwayat kalender streak"
            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-[#F1A2C5]/35 bg-[#F1A2C5]/10 px-3.5 py-2 text-[12px] font-semibold text-[#F1C9D9] transition-colors hover:bg-[#F1A2C5]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F1A2C5]/60"
          >
            <Flame className="h-3.5 w-3.5" aria-hidden="true" />
            Berbunga — streak {TREE_BLOOM_STREAK}+ hari
          </button>
        )}
        {tree?.dorman && (
          <button
            type="button"
            onClick={onManageHabits}
            aria-label="Sebagian habit sedang mode liburan — kelola di Habit Master"
            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-[#9BC1B7]/30 bg-white/[0.06] px-3.5 py-2 text-[12px] font-semibold text-[#C6DAD3] transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9BC1B7]/50"
          >
            <Palmtree className="h-3.5 w-3.5" aria-hidden="true" />
            Dorman — {vacationCount} habit berlibur
          </button>
        )}
        {tree?.care && (
          <button
            type="button"
            onClick={() => onOpenHabitFocus(tree.care!.habitId)}
            aria-label={`Habit ${tree.care.habitName} selesai ${tree.care.rate}% — buka analisis untuk merawat`}
            className="inline-flex min-h-11 max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-[#E7B64B]/35 bg-[#E7B64B]/10 px-3.5 py-2 text-[12px] font-semibold text-[#F1D9A0] transition-colors hover:bg-[#E7B64B]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E7B64B]/60"
          >
            <Leaf className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Rawat: {tree.care.habitName} ({tree.care.rate}%)</span>
          </button>
        )}
        {!tree?.blooming && !tree?.dorman && !tree?.care && (
          <p className="rounded-full border border-[#63E6BE]/25 bg-[#63E6BE]/[0.07] px-3.5 py-2 text-[12px] font-medium text-[#9BC1B7]">
            Musim tenang — pertumbuhan berjalan tanpa gangguan 🌿
          </p>
        )}
      </div>
    </section>
  );
}
