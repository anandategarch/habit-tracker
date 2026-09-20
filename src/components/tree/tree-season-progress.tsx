'use client';

// components/tree/tree-season-progress.tsx — ② PROGRES PERTUMBUHAN MUSIM
// MINGGUAN (Task 62) tab Pohon.
//
// Diekstraksi dari pohon-screen.tsx saat SPLIT god-file (Task 71-g) —
// JSX/aria identik. Bar progres + persen + narasi (treeSeasonNarrative) +
// baris XP mingguan/seumur hidup/streak + tautan "Jalan Pertumbuhan"
// (openProgressTree → tab Progres, fokus pohon).

import { LineChart } from 'lucide-react';
import type { TreeSeasonState } from '@/lib/tree-season';

export interface TreeSeasonProgressProps {
  /** Persen progres musim (0–100, dibulatkan). */
  pct: number;
  /** Narasi musim mingguan (treeSeasonNarrative) — kosong saat data belum ada. */
  narrative: string;
  season: TreeSeasonState;
  /** Baris ringkas XP minggu ini · XP seumur hidup · streak ('…' saat memuat). */
  xpSummary: string;
  onOpenProgressTree: () => void;
}

export function TreeSeasonProgress({ pct, narrative, season, xpSummary, onOpenProgressTree }: TreeSeasonProgressProps) {
  return (
    <section className="rounded-2xl border border-teal-900/50 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-foreground">Pertumbuhan Minggu Ini</h2>
        <p className="text-[11px] font-bold tabular-nums text-[#63E6BE]">{pct}%</p>
      </div>
      <div
        // Task 61-f (audit 61-a P3): track memakai token bg-muted (theme
        // aware) — dulu hex gelap #10362E (khusus kartu panggung gelap)
        // tampak berat/tak nyambung di kartu bg-card mode terang.
        className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progres musim minggu ini menuju tahap ${
          season.nextStage ? season.nextStage.label : 'puncak mingguan'
        } — ${pct}%`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#9AF4CC] via-[#63E6BE] to-[#1E9B72] transition-[width] duration-700"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <p className="mt-2 text-[12.5px] font-medium leading-relaxed text-muted-foreground">
        {narrative}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">{xpSummary}</p>
        <button
          type="button"
          onClick={onOpenProgressTree}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg text-[11.5px] font-semibold text-[#63E6BE] transition-colors hover:text-[#9AF4CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63E6BE]/60"
        >
          <LineChart className="h-3.5 w-3.5" aria-hidden="true" />
          Jalan Pertumbuhan
        </button>
      </div>
    </section>
  );
}
