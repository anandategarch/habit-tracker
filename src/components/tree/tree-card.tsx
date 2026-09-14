'use client';

// components/tree/tree-card.tsx — POHON RUTINA (Task 53): kartu "Pohonmu"
// di Beranda.
//
// Pohon = cermin pertumbuhan SEUMUR user (tahap via level/XP), melengkapi
// TreeProgress di TodayHero yang mencerminkan progres HARI INI. Artwork
// botanical milik pengguna (teks poster dibersihkan — angka level/XP yang
// tampil selalu data ASLI, bukan teks statis aset).
//
// CONNECTED-APP: kartu ini bukan dekorasi —
//   • tap kartu        → Progres "Jalan Pertumbuhan" (roadmap + sinyal)
//   • chip berbunga    → Riwayat kalender (konteks streak yang menumbuhkan)
//   • chip dorman      → Habit Master (satu-satunya tempat kelola mode libur)
//   • chip daun kuning → fokus habit yang sedang melemah (analisis waktu)

import { useQuery } from '@tanstack/react-query';
import { Flame, Palmtree, Leaf, ArrowUpRight } from 'lucide-react';
import {
  getTreeGrowthState,
  treeGrowthNarrative,
  TREE_BLOOM_STREAK,
  type TreeGrowthInput,
  type TreeGrowthState,
} from '@/lib/tree-growth';

interface HabitLiteForVacation {
  id: string;
  vacationMode?: boolean;
}

interface TreeCardProps {
  tree: TreeGrowthState;
  /** BUGHUNT-54 (3-c #5a): level ASLI user (kpi currentLevel) — dipakai
   *  untuk label "Pohonmu · Level N". Dulu memakai stage.levelLabel tahap
   *  → user Level 0 tampil "Level 1" (label rentang tahap, bukan level
   *  user). */
  level: number;
  onOpenTree: () => void;
  onOpenBloom: () => void;
  onOpenDorman: () => void;
  onOpenCare: (habitId: string) => void;
}

/** Hitung jumlah habit mode liburan aktif dari cache ['habits'] terbagih
 *  (query + endpoint SAMA dengan Habit Master / tracker — invalidasi
 *  mutation completion sudah menjangkau key ini). */
export function useVacationCount(): number {
  const { data } = useQuery({
    queryKey: ['habits'],
    queryFn: async () => {
      const res = await fetch('/api/habits');
      if (!res.ok) throw new Error('Gagal memuat habits');
      const json = (await res.json()) as { habits?: HabitLiteForVacation[] };
      return json.habits ?? [];
    },
    staleTime: 30_000,
  });
  return (data ?? []).filter((h) => h.vacationMode === true).length;
}

export function TreeCard({ tree, level, onOpenTree, onOpenBloom, onOpenDorman, onOpenCare }: TreeCardProps) {
  const pct = Math.round(tree.stageProgress);
  const narrative = treeGrowthNarrative(tree);
  const fruitCaption =
    tree.stage.id === 'pohon-dewasa' ? 'Tahap tertinggi — rawat dan panen' : undefined;

  return (
    <section
      aria-label={`Pohonmu — tahap ${tree.stage.label}, Level ${level}`}
      className="anim-stagger relative overflow-hidden rounded-2xl border border-teal-900/60 shadow-[0_18px_44px_-18px_rgba(2,20,17,0.55)]"
      style={{ background: 'linear-gradient(135deg,#071715,#05110F)' }}
    >
      {/* Area utama — tap menuju Jalan Pertumbuhan */}
      <button
        type="button"
        onClick={onOpenTree}
        aria-label={`Buka Jalan Pertumbuhan — pohonmu tahap ${tree.stage.label}`}
        className="group relative flex w-full cursor-pointer items-stretch text-left transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63E6BE]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.995]"
      >
        {/* Konteks kiri */}
        <div className="min-w-0 flex-1 px-4 py-4 sm:px-5 sm:py-5">
          {/* BUGHUNT-54 (3-c #5a): level ASLI user, bukan levelLabel tahap. */}
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#63E6BE]">
            Pohonmu · Level {level}
          </p>
          <h3 className="font-display mt-1 text-xl font-semibold leading-tight text-[#F4F9F7] sm:text-[1.45rem]">
            {tree.stage.label}
          </h3>
          <p className="mt-1.5 text-[12.5px] font-medium leading-relaxed text-[#9BC1B7]">
            {narrative}
          </p>
          <span className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#63E6BE] opacity-80 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            Jalan Pertumbuhan
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
        {/* Artwork botanical (aset pengguna — bg-nya menyatu dengan kartu) */}
        <div className="relative w-[124px] shrink-0 overflow-hidden sm:w-[160px]" aria-hidden="true">
          { }
          <img
            src={tree.stage.artwork}
            alt=""
            width={160}
            height={160}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-[50%_62%]"
          />
        </div>
      </button>

      {/* Bar progres pertumbuhan — XP ASLI menuju tahap berikutnya */}
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-[#10362E]"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progres menuju tahap ${tree.nextStage ? tree.nextStage.label : 'puncak'} — ${pct}%`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#9AF4CC] via-[#63E6BE] to-[#1E9B72] transition-[width] duration-700"
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-[11px] font-semibold text-[#9BC1B7]">
            {fruitCaption ??
              (tree.xpToNextStage != null && tree.nextStage
                ? `${tree.xpToNextStage.toLocaleString('id-ID')} XP menuju ${tree.nextStage.label}`
                : 'Pertumbuhan berlanjut tanpa batas')}
          </p>
          <p className="shrink-0 text-[11px] font-bold tabular-nums text-[#63E6BE]">{pct}%</p>
        </div>
      </div>

      {/* State musiman — sinyal sistem, tampil hanya saat relevan */}
      {(tree.blooming || tree.dorman || tree.care) && (
        <div className="flex flex-wrap gap-2 px-4 pb-4 sm:px-5 sm:pb-5">
          {tree.blooming && (
            <button
              type="button"
              onClick={onOpenBloom}
              aria-label={`Pohonmu sedang berbunga — streak ${TREE_BLOOM_STREAK} hari atau lebih. Buka riwayat kalender.`}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#F1A2C5]/30 bg-[#F1A2C5]/10 px-3 py-1.5 text-[11.5px] font-semibold text-[#F1C9D9] transition-colors hover:bg-[#F1A2C5]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F1A2C5]/60"
            >
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
              Sedang berbunga
            </button>
          )}
          {tree.dorman && (
            <button
              type="button"
              onClick={onOpenDorman}
              aria-label="Ada habit dalam mode liburan — kelola di Habit Master"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#9BC1B7]/25 bg-white/[0.06] px-3 py-1.5 text-[11.5px] font-semibold text-[#C6DAD3] transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9BC1B7]/50"
            >
              <Palmtree className="h-3.5 w-3.5" aria-hidden="true" />
              Sebagian sedang dorman
            </button>
          )}
          {tree.care && (
            <button
              type="button"
              onClick={() => onOpenCare(tree.care!.habitId)}
              aria-label={`Sinyal perawatan: habit ${tree.care.habitName} selesai ${tree.care.rate}% sejak awal — buka analisis`}
              className="inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-[#E7B64B]/35 bg-[#E7B64B]/10 px-3 py-1.5 text-[11.5px] font-semibold text-[#F1D9A0] transition-colors hover:bg-[#E7B64B]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E7B64B]/60"
            >
              <Leaf className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {/* BUGHUNT-54 (3-c #4): Beranda query period 'all' → label
                    jendela rate jujur "sejak awal" (dulu implisit "30 hari"). */}
                Rawat: {tree.care.habitName} ({tree.care.rate}% sejak awal)
              </span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** Rakit TreeGrowthState dari data dashboard + cache habits (vacation). */
export function buildTreeInput(
  kpi: {
    currentLevel: number;
    totalXP: number;
    levelProgress: number;
    currentStreak: number;
    graduatedCount: number;
    worstHabit?: { id?: string; name: string; rate: number } | null;
  },
  vacationCount: number,
): TreeGrowthState {
  const input: TreeGrowthInput = {
    level: kpi.currentLevel,
    totalXp: kpi.totalXP,
    levelProgress: kpi.levelProgress,
    currentStreak: kpi.currentStreak,
    graduatedCount: kpi.graduatedCount,
    worstHabit: kpi.worstHabit ?? null,
    vacationCount,
  };
  return getTreeGrowthState(input);
}
