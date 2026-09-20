'use client';

// components/tree/pohon-screen.tsx — POHON TAB (Task 55): rumah baru
// pohon Rutina — pengalaman interaktif yang MEMBUAT FITUR POHON MENYENANGKAN:
//
//   • Panggung interaktif — sapamu pohon: bergoyang, daun berguguran,
//     bisik-bisik pohon (rotasi pesan), easter egg di tap ke-10.
//   • Penyiraman — setiap rutinitas selesai hari ini = 1 tetes air; siram
//     pohon → animasi tetesan; semua selesai → perayaan sparkle emas.
//   • Buah Emas — panen nyata: tujuan berstatus selesai + habit lulus
//     (graduatedAt). TASK 66: buah habit tetap 1-tap ke konteksnya
//     (openHabitFocus); buah tujuan kini statis (tab Tujuan dihapus).
//   • Ambience — kunang-kunang di malam Jakarta (hydrate-aman), daun
//     ambient, badge musiman; artwork otomatis mengikuti state pohon
//     (dorman / daun-kuning / berbunga / tahap).
//   • Kebijaksanaan Pohon — kutipan pertumbuhan deterministik per hari.
//
// CONNECTED-APP #14 tetap berlaku: SEMUA angka dari data asli (dashboard
// period 'all' + cache ['habits']/['goals'] terbagih) — tidak ada state
// pohon yang disimpan; pohon selalu jujur mencerminkan ekosistem.
// Navigasi memakai primitive store: openTrackerDate, openHabitFocus,
// openProgressTree, setActiveTab, setSettingsSection.
//
// TASK 62 (Opsi B — MUSIM MINGGUAN): tahap panggung, bar "Pertumbuhan
// Minggu Ini", dan statistik tahap kini diturunkan dari XP sejak awal
// minggu (Senin Jakarta) → pohon RESET tiap awal minggu (Senin mulai
// Benih). Level/XP seumur hidup tetap utuh: tampil sebagai badge "Level
// N · seumur hidup" + baris XP lifetime; sinyal musiman (dorman/daun-
// kuning/berbunga streak) tetap dari data seumur hidup.
//
// TASK 71-g (SPLIT god-file): file ini kini AKAR KOMPOSISI — query cache
// terbagih, derivasi data, cabang loading/error, dan perakitan seksi.
// Implementasi seksi dipindah ke sibling:
//   pohon-content.ts (konten/helper murni) · use-pohon-play.ts (interaksi)
//   pohon-stage.tsx (① panggung) · tree-season-progress.tsx (② progres)
//   pohon-watering.tsx (③ siram) · tree-stats.tsx (④ statistik)
//   pohon-fruits.tsx (⑤ buah) · tree-season-signals.tsx (⑥ sinyal)
//   pohon-wisdom.tsx (⑦ kutipan).

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, TreePine } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { buildTreeInput } from '@/components/tree/tree-card';
import { getTreeSeasonState, treeSeasonNarrative, type TreeSeasonState } from '@/lib/tree-season';
import { TREE_STATE_ART, type TreeGrowthState } from '@/lib/tree-growth';
import { toDashboardData } from '@/lib/dashboard/contract';
import { useJakartaToday } from '@/components/habit-tracker/use-jakarta-today';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/habit-tracker/scroll-reveal';
import { TreeGrowSplash } from '@/components/ui/loaders';
import { PohonStage } from './pohon-stage';
import { TreeSeasonProgress } from './tree-season-progress';
import { PohonWatering } from './pohon-watering';
import { TreeStats } from './tree-stats';
import { PohonFruits } from './pohon-fruits';
import { TreeSeasonSignals } from './tree-season-signals';
import { PohonWisdom } from './pohon-wisdom';
import { usePohonPlay } from './use-pohon-play';
import {
  todayWisdom,
  type FruitItem,
  type GoalRowForPohon,
  type HabitRowForPohon,
} from './pohon-content';

export default function PohonScreen() {
  // Navigation primitives (store) — semua jalur keluar layar ini.
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const openHabitFocus = useAppStore((s) => s.openHabitFocus);
  const openProgressTree = useAppStore((s) => s.openProgressTree);
  const setSettingsSection = useAppStore((s) => s.setSettingsSection);
  const openTrackerHistory = useAppStore((s) => s.openTrackerHistory);
  const openTrackerDate = useAppStore((s) => s.openTrackerDate);
  const refreshKey = useAppStore((s) => s.refreshKey);

  // Task 60-e/61-f (audit 61-a P2): "hari ini" yang HIDUP via useJakartaToday
  // (tick 30 dtk, hanya re-render saat YMD Jakarta berganti) — paritas dengan
  // dashboard.tsx / daily-tracker.tsx / progress.tsx. Dulu jakartaDateString()
  // per render tanpa tick: tab Pohon yang dibiarkan terbuka melewati tengah
  // malam WIB menampilkan tetes penyiraman x/y + tombol Rutinitas basi.
  const todayStr = useJakartaToday();

  // ── Data (semua cache terbagih dengan tab lain) ───────────────────────
  // Key persis keluarga Beranda (['dashboard','all',refreshKey,…]) supaya
  // berpindah Beranda ↔ Pohon tidak memicu fetch ulang.
  // TASK 60-a #2b (temuan 59-b4): elemen-4 kini retryCount LOKAL (dulu
  // hardcoded 0) — struktur kunci IDENTIK dengan dashboard.tsx
  // (['dashboard','all',refreshKey,retryCount]); setelah "Coba Lagi" di
  // salah satu layar, kunci tidak lagi bercabang permanen dari cache
  // Beranda (dulu key Pohon selalu berakhiran 0 → cache terpisah + fetch
  // ganda setelah retry Beranda sukses).
  const [retryCount, setRetryCount] = useState(0);
  // TASK 60-a #2a (temuan 59-b4, paritas BUGHUNT-54 3-c #5b Beranda):
  // state error ikut dibaca — React Query v5: setelah retry gagal,
  // isLoading=false dengan dash=undefined; dulu gate render hanya
  // `isLoading && !dash` → UI pohon penuh dirender dengan artwork dorman
  // PALSU + narasi kosong. Kini cabang error di bawah menangkapnya.
  const { data: dash, isLoading, isError: fetchError, isFetching: fetching } = useQuery({
    queryKey: ['dashboard', 'all', refreshKey, retryCount],
    queryFn: async () => {
      const res = await fetch('/api/dashboard?period=all');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      return toDashboardData(json, 'all');
    },
    retry: 1,
  });

  const { data: habits = [] } = useQuery<HabitRowForPohon[]>({
    queryKey: ['habits'],
    queryFn: async () => {
      const res = await fetch('/api/habits');
      if (!res.ok) throw new Error('Gagal memuat habits');
      const json = (await res.json()) as { habits?: HabitRowForPohon[] };
      return json.habits ?? [];
    },
    staleTime: 30_000,
  });

  const { data: goals = [] } = useQuery<GoalRowForPohon[]>({
    queryKey: ['goals'],
    queryFn: async () => {
      const res = await fetch('/api/goals');
      if (!res.ok) throw new Error('Gagal memuat goals');
      const json = (await res.json()) as { goals?: GoalRowForPohon[] };
      return json.goals ?? [];
    },
    staleTime: 30_000,
  });

  // ── Derivasi pohon (data ASLI — CONNECTED-APP #14) ────────────────────
  const vacationCount = useMemo(
    () => habits.filter((h) => h.vacationMode === true).length,
    [habits],
  );

  const tree: TreeGrowthState | null = useMemo(() => {
    if (!dash) return null;
    return buildTreeInput(
      {
        currentLevel: dash.currentLevel,
        totalXP: dash.totalXP,
        levelProgress: dash.levelProgress,
        currentStreak: dash.currentStreak,
        graduatedCount: dash.graduatedCount,
        worstHabit: dash.worstHabit,
      },
      vacationCount,
    );
  }, [dash, vacationCount]);

  // Task 62 (Opsi B): MUSIM MINGGUAN — tahap panggung & progres pohon
  // kini dari XP sejak awal minggu (reset tiap Senin). tree (seumur
  // hidup) tetap dipakai untuk sinyal musiman: dorman/daun-kuning/
  // berbunga (streak) + statistik lifetime di baris bawah.
  const season: TreeSeasonState = useMemo(
    () => getTreeSeasonState(dash?.seasonWeeklyXp ?? 0, dash?.seasonStartYmd ?? null, todayStr),
    [dash?.seasonWeeklyXp, dash?.seasonStartYmd, todayStr],
  );

  // Buah emas = kemenangan nyata: tujuan selesai + habit lulus.
  const fruits: FruitItem[] = useMemo(() => {
    const goalFruits: FruitItem[] = goals
      .filter((g) => g.status === 'completed')
      .map((g) => ({
        id: g.id,
        title: g.title,
        kind: 'goal' as const,
        date: g.deadline ?? g.updatedAt ?? null,
      }));
    const habitFruits: FruitItem[] = habits
      .filter((h) => h.graduatedAt)
      .map((h) => ({
        id: h.id,
        title: h.name,
        kind: 'habit' as const,
        date: (h.graduatedAt ?? '').slice(0, 10) || null,
        emoji: h.emoji,
      }));
    return [...goalFruits, ...habitFruits].sort((a, b) =>
      (b.date ?? '').localeCompare(a.date ?? ''),
    );
  }, [goals, habits]);

  // Penyiraman: semantik avoid (suka = TIDAK kambuh) konsisten Beranda.
  const todayTotal = dash?.todayTotalCount ?? 0;
  const todayDone = useMemo(() => {
    if (!dash) return 0;
    return dash.todayHabits.filter((h) =>
      h.habitType === 'avoid' ? !h.completed : h.completed,
    ).length;
  }, [dash]);
  const allWatered = todayTotal > 0 && todayDone >= todayTotal;

  // Artwork mengikuti state pohon — prioritas: istirahat > perlu dirawat >
  // berbunga > tahap musim mingguan (Task 62: tahap dasar = XP minggu ini,
  // bukan level seumur hidup).
  const artwork = tree
    ? tree.dorman
      ? TREE_STATE_ART.dorman
      : tree.care
        ? TREE_STATE_ART['daun-kuning']
        : tree.blooming
          ? TREE_STATE_ART.berbunga
          : season.stage.artwork
    : TREE_STATE_ART.dorman; // placeholder saat loading (dicek di bawah)

  // ── Interaksi menyenangkan (state animasi + handler) ─────────────────
  const { swayKey, leaves, watering, celebrating, isNight, handleTapTree, handleWater } = usePohonPlay(
    { todayTotal, todayDone, allWatered, todayStr },
  );

  const wisdom = useMemo(() => todayWisdom(new Date()), []);
  // Task 62: narasi + persen kini MUSIM MINGGUAN (XP sejak Senin).
  const narrative = tree ? treeSeasonNarrative(season) : '';
  const pct = tree ? Math.round(season.seasonProgress) : 0;
  const xpSummary = dash
    ? `${season.weeklyXp.toLocaleString('id-ID')} XP minggu ini · ${(
        dash.totalXP ?? 0
      ).toLocaleString('id-ID')} XP seumur hidup · streak ${dash.currentStreak ?? 0} hari`
    : '…';

  // ── Loading ───────────────────────────────────────────────────────────
  if (isLoading && !dash) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        {/* TASK 59: TreeGrowSplash inline — animasi tumbuh Tunas→Berbunga
            versi kilat (sama dgn loading antar tab & splash Task 58).
            Dulu TreeMark statis (Task 56), sebelum itu TreeGrow vektor. */}
        <TreeGrowSplash size={88} variant="inline" />
      </div>
    );
  }

  // ── Error (TASK 60-a #2a) ────────────────────────────────────────────
  // React Query v5: retry habis → isLoading=false, dash=undefined. Tanpa
  // cabang ini UI pohon penuh dirender dari data kosong (artwork dorman
  // palsu + narasi kosong — persis bug yang ditutup di Beranda oleh
  // BUGHUNT-54 3-c #5b: sembunyikan konten fabricated + banner "Coba
  // Lagi"). Tombol retry menaikkan retryCount → queryKey baru → fetch
  // ulang (loading gate di atas otomatis mengambil alih saat key berganti).
  if (fetchError && !dash) {
    return (
      <div className="app-ambience space-y-5">
        <PageHeader
          eyebrow="Rutina"
          title="Pohonmu"
          subtitle="Musim mingguanmu — sapa, siram, dan panen. Level seumur hidup tetap tercatat."
          icon={TreePine}
        />
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">Gagal memuat data pohon</p>
          <Button variant="outline" size="sm" onClick={() => setRetryCount((c) => c + 1)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Coba Lagi
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-ambience space-y-5">
      <PageHeader
        eyebrow="Rutina"
        title="Pohonmu"
        subtitle="Musim mingguanmu — sapa, siram, dan panen. Level seumur hidup tetap tercatat."
        icon={TreePine}
      />

      {/* TASK 60-a #2a (paritas Beranda): refetch latar belakang gagal
          saat data lama MASIH ada → data nyata tetap dirender + banner
          ringkas (tanpa "Coba Lagi" saat fetch ulang sedang berjalan —
          kondisi !fetching, pola yang sama dengan dashboard.tsx). */}
      {fetchError && !fetching && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">Gagal memuat data terbaru</p>
          <Button variant="outline" size="sm" onClick={() => setRetryCount((c) => c + 1)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Coba Lagi
          </Button>
        </div>
      )}

      {/* ══ ① PANGGUNG INTERAKTIF ══════════════════════════════════════ */}
      <ScrollReveal>
        <PohonStage
          season={season}
          tree={tree}
          level={dash?.currentLevel}
          artwork={artwork}
          isNight={isNight}
          swayKey={swayKey}
          leaves={leaves}
          watering={watering}
          celebrating={celebrating}
          onTap={handleTapTree}
        />
      </ScrollReveal>

      {/* ══ ② PROGRES PERTUMBUHAN MUSIM MINGGUAN (Task 62) ══════ */}
      <ScrollReveal>
        <TreeSeasonProgress
          pct={pct}
          narrative={narrative}
          season={season}
          xpSummary={xpSummary}
          onOpenProgressTree={openProgressTree}
        />
      </ScrollReveal>

      {/* ══ ③ PENYIRAMAN ═══════════════════════════════════════════════ */}
      <ScrollReveal>
        <PohonWatering
          todayTotal={todayTotal}
          todayDone={todayDone}
          allWatered={allWatered}
          watering={watering}
          onWater={handleWater}
          onOpenRoutine={() => openTrackerDate(todayStr)}
        />
      </ScrollReveal>

      {/* ══ ④ STATISTIK POHON ═════════════════════════════════════════ */}
      <ScrollReveal>
        <TreeStats
          stageLabel={tree ? season.stage.label : null}
          blooming={tree?.blooming ?? false}
          currentStreak={dash?.currentStreak ?? 0}
          fruitsCount={fruits.length}
        />
      </ScrollReveal>

      {/* ══ ⑤ BUAH EMAS — PANEN NYATA ═════════════════════════════════ */}
      <ScrollReveal>
        <PohonFruits fruits={fruits} onOpenHabitFocus={openHabitFocus} />
      </ScrollReveal>

      {/* ══ ⑥ SINYAL MUSIM (kompak, ber-aksi) ══════════════════════════ */}
      <ScrollReveal>
        <TreeSeasonSignals
          tree={tree}
          vacationCount={vacationCount}
          todayStr={todayStr}
          onOpenTrackerHistory={openTrackerHistory}
          onOpenHabitFocus={openHabitFocus}
          onManageHabits={() => {
            setSettingsSection('habits');
            setActiveTab('settings');
          }}
        />
      </ScrollReveal>

      {/* ══ ⑦ KEBIJAKSAAN POHON ═══════════════════════════════════════ */}
      <ScrollReveal>
        <PohonWisdom wisdom={wisdom} />
      </ScrollReveal>
    </div>
  );
}
