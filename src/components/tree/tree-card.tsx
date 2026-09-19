'use client';

// components/tree/tree-card.tsx — POHON MUSIM MINGGUAN (Task 62, Opsi B):
// kartu "Pohonmu" di Beranda.
//
// PERUBAHAN MAKNA (permintaan user): tahap pohon pada kartu ini kini
// mencerminkan MUSIM MINGGUAN — XP yang dikumpulkan sejak awal minggu
// (Senin, Asia/Jakarta) — dan RESET otomatis tiap awal minggu (tiap
// Senin mulai dari Benih lagi). Level/XP seumur hidup tetap disimpan
// aman dan ditampilkan sebagai konteks kecil ("Level N seumur hidup")
// — level tidak pernah turun (komentar route: level = kenangan
// kemenangan). Lapisan ini derived-view murni: tidak ada state/DB baru.
//
// CONNECTED-APP: kartu ini bukan dekorasi —
//   • tap kartu        → tab POHON (panggung interaktif: sapa/siram/panen)
//   • chip berbunga    → Riwayat kalender (konteks streak yang menumbuhkan)
//   • chip dorman      → Habit Master (satu-satunya tempat kelola mode libur)
//   • chip daun kuning → fokus habit yang sedang melemah (analisis waktu)

import { useQuery } from '@tanstack/react-query';
import { Flame, Palmtree, Leaf, ArrowUpRight } from 'lucide-react';
import {
  getTreeGrowthState,
  TREE_BLOOM_STREAK,
  type TreeGrowthInput,
  type TreeGrowthState,
} from '@/lib/tree-growth';
import { treeSeasonNarrative, type TreeSeasonState } from '@/lib/tree-season';

interface HabitLiteForVacation {
  id: string;
  vacationMode?: boolean;
}

interface TreeCardProps {
  /** Musim mingguan (Task 62) — tahap + XP minggu ini + info reset. */
  season: TreeSeasonState;
  /** Level ASLI user seumur hidup — konteks kecil di bawah bar progres. */
  level: number;
  /** State pohon seumur hidup — dipakai HANYA untuk sinyal chips
   *  (berbunga streak ≥7 / dorman / daun-kuning); tahapnya tidak
   *  dirender lagi (tahap kartu = musim mingguan). */
  tree: TreeGrowthState;
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

export function TreeCard({
  season,
  level,
  tree,
  onOpenTree,
  onOpenBloom,
  onOpenDorman,
  onOpenCare,
}: TreeCardProps) {
  const pct = Math.round(season.seasonProgress);
  const narrative = treeSeasonNarrative(season);
  const seasonDone = season.isMax;
  const seasonCaption =
    seasonDone || season.nextStage == null
      ? 'Musim mingguan tuntas — rawat sampai akhir pekan'
      : `${season.xpToNextStage?.toLocaleString('id-ID') ?? 0} XP menuju ${season.nextStage.label}`;

  return (
    <section
      aria-label={`Pohonmu — musim minggu ini, tahap ${season.stage.label}, reset ${season.resetLabel}`}
      className="anim-stagger relative overflow-hidden rounded-2xl border border-teal-900/60 shadow-[0_18px_44px_-18px_rgba(2,20,17,0.55)]"
      style={{ background: 'linear-gradient(135deg,#071715,#05110F)' }}
    >
      {/* Area utama — tap menuju tab POHON (pengalaman interaktif) */}
      <button
        type="button"
        onClick={onOpenTree}
        aria-label={`Buka tab Pohon — musim minggu ini tahap ${season.stage.label}, reset ${season.resetLabel}`}
        className="group relative flex w-full cursor-pointer items-stretch text-left transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63E6BE]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.995]"
      >
        {/* Konteks kiri */}
        <div className="min-w-0 flex-1 px-4 py-4 sm:px-5 sm:py-5">
          {/* Task 62: label kini MUSIM MINGGUAN (reset tiap awal minggu). */}
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#63E6BE]">
            Pohonmu · Musim Minggu Ini
          </p>
          <h3 className="font-display mt-1 text-xl font-semibold leading-tight text-[#F4F9F7] sm:text-[1.45rem]">
            {season.stage.label}
          </h3>
          <p className="mt-1.5 text-[12.5px] font-medium leading-relaxed text-[#9BC1B7]">
            {narrative}
          </p>
          <span className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#63E6BE] opacity-80 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            Rawat pohonmu
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
        {/* Artwork botanical (aset pengguna — bg-nya menyatu dengan kartu) */}
        <div className="relative w-[124px] shrink-0 overflow-hidden sm:w-[160px]" aria-hidden="true">
          {}
          <img
            src={season.stage.artwork}
            alt=""
            width={160}
            height={160}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-[50%_62%]"
          />
        </div>
      </button>

      {/* Bar progres musim mingguan — XP minggu ini menuju tahap berikutnya */}
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-[#10362E]"
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
        <div className="mt-1.5 flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-[11px] font-semibold text-[#9BC1B7]">
            {season.weeklyXp.toLocaleString('id-ID')} XP minggu ini · {seasonCaption}
          </p>
          <p className="shrink-0 text-[11px] font-bold tabular-nums text-[#63E6BE]">{pct}%</p>
        </div>
        {/* Konteks dua lapis: siklus mingguan + pencapaian seumur hidup. */}
        <p className="mt-1 text-[10.5px] font-medium text-[#9BC1B7]/75">
          reset {season.resetLabel} · sisa {season.daysLeft} hari · Level {level} seumur hidup
        </p>
      </div>

      {/* State musiman — sinyal sistem, tampil hanya saat relevan
          (streak ≥7 berbunga / mode liburan / habit melemah — tetap
          dihitung dari data seumur hidup, bukan musim mingguan). */}
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
