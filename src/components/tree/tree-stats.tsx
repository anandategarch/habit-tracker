'use client';

// components/tree/tree-stats.tsx — ④ STATISTIK POHON tab Pohon.
//
// Diekstraksi dari pohon-screen.tsx saat SPLIT god-file (Task 71-g) —
// JSX/aria identik. Grid 3 kartu: tahap musim minggu ini, streak berjalan
// (berbunga ≥ TREE_BLOOM_STREAK), dan jumlah buah emas.

import { Apple, Flame, TreePine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TREE_BLOOM_STREAK } from '@/lib/tree-growth';

export interface TreeStatsProps {
  /** Label tahap musim mingguan — null saat data pohon belum termuat ('—'). */
  stageLabel: string | null;
  /** Streak ≥ TREE_BLOOM_STREAK → ikon/label mode berbunga. */
  blooming: boolean;
  currentStreak: number;
  fruitsCount: number;
}

export function TreeStats({ stageLabel, blooming, currentStreak, fruitsCount }: TreeStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
      <div className="rounded-2xl border border-teal-900/50 bg-card p-3 text-center shadow-sm sm:p-4">
        <TreePine className="mx-auto h-4.5 w-4.5 text-[#63E6BE]" aria-hidden="true" />
        <p className="mt-1.5 text-sm font-bold tabular-nums text-foreground">{stageLabel ?? '—'}</p>
        <p className="text-[10.5px] font-medium text-muted-foreground">musim minggu ini</p>
      </div>
      <div className="rounded-2xl border border-teal-900/50 bg-card p-3 text-center shadow-sm sm:p-4">
        <Flame className={cn('mx-auto h-4.5 w-4.5', blooming ? 'text-[#F1A2C5]' : 'text-[#E7B64B]')} aria-hidden="true" />
        <p className="mt-1.5 text-sm font-bold tabular-nums text-foreground">{currentStreak} hari</p>
        <p className="text-[10.5px] font-medium text-muted-foreground">
          {blooming ? `bunga mulai ${TREE_BLOOM_STREAK}🔥` : 'streak berjalan'}
        </p>
      </div>
      <div className="rounded-2xl border border-teal-900/50 bg-card p-3 text-center shadow-sm sm:p-4">
        <Apple className="mx-auto h-4.5 w-4.5 text-[#EDBC3F]" aria-hidden="true" />
        <p className="mt-1.5 text-sm font-bold tabular-nums text-foreground">{fruitsCount}</p>
        <p className="text-[10.5px] font-medium text-muted-foreground">buah emas</p>
      </div>
    </div>
  );
}
