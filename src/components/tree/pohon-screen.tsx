'use client';

// components/tree/pohon-screen.tsx — POHON TAB (Task 55): rumah baru
// pohon Rutina — pengalaman interaktif yang MEMBUAT FITUR POHON MENYENANGKAN:
//
//   • Panggung interaktif — sapamu pohon: bergoyang, daun berguguran,
//     bisik-bisik pohon (rotasi pesan), easter egg di tap ke-10.
//   • Penyiraman — setiap rutinitas selesai hari ini = 1 tetes air; siram
//     pohon → animasi tetesan; semua selesai → perayaan sparkle emas.
//   • Buah Emas — panen nyata: tujuan berstatus selesai + habit lulus
//     (graduatedAt), tap buah → konteksnya (openGoalFocus/openHabitFocus).
//   • Ambience — kunang-kunang di malam Jakarta (hydrate-aman), daun
//     ambient, badge musiman; artwork otomatis mengikuti state pohon
//     (dorman / daun-kuning / berbunga / tahap).
//   • Kebijaksanaan Pohon — kutipan pertumbuhan deterministik per hari.
//
// CONNECTED-APP #14 tetap berlaku: SEMUA angka dari data asli (dashboard
// period 'all' + cache ['habits']/['goals'] terbagih) — tidak ada state
// pohon yang disimpan; pohon selalu jujur mencerminkan ekosistem.
// Navigasi memakai primitive store: openTrackerDate, openHabitFocus,
// openGoalFocus, openProgressTree, setActiveTab, setSettingsSection.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Apple,
  ArrowUpRight,
  Droplet,
  Droplets,
  Flame,
  Leaf,
  LineChart,
  Palmtree,
  Quote,
  Sparkles,
  TreePine,
} from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { buildTreeInput } from '@/components/tree/tree-card';
import {
  TREE_BLOOM_STREAK,
  TREE_STATE_ART,
  treeGrowthNarrative,
  type TreeGrowthState,
} from '@/lib/tree-growth';
import { toDashboardData } from '@/lib/dashboard/contract';
import { jakartaDateString } from '@/lib/timezone';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollReveal } from '@/components/habit-tracker/scroll-reveal';
import { TreeMark } from '@/components/ui/loaders';
import { cn } from '@/lib/utils';

// ── Data types (bentuk field minimal yang dipakai layar ini) ────────────
interface HabitRowForPohon {
  id: string;
  name: string;
  emoji?: string;
  vacationMode?: boolean;
  graduatedAt?: string | null;
}

interface GoalRowForPohon {
  id: string;
  title: string;
  status: string;
  deadline?: string | null;
  updatedAt?: string;
}

interface FruitItem {
  id: string;
  title: string;
  kind: 'goal' | 'habit';
  /** ISO/YMD terakhir relevan — untuk urutan & label. */
  date: string | null;
  emoji?: string;
}

// ── Konten menyenangkan (fun copy) ──────────────────────────────────────

/** Bisik-bisik pohon saat disapa — rotasi (bukan tiap tap, anti-spam). */
const TREE_WHISPERS: readonly string[] = [
  'Pohonmu bergoyang senang 🌿',
  'Daun-daunnya berbisik: terima kasih sudah konsisten',
  'Rantingnya melambai ke arahmu',
  'Akarnya makin dalam setiap hari',
  'Kunang-kunang ikut menonton dari jauh',
  'Pohon ini tumbuh dari XP-mu, bukan dari kebetulan',
  'Satu hari baik tetap dihitung, sekecil apa pun',
  'Pohonmu tidak buru-buru — dan tidak pernah berhenti',
];

/** Kebijaksanaan Pohon — kutipan pertumbuhan, deterministik per hari. */
const TREE_WISDOM: readonly string[] = [
  'Pohon apa pun yang pernah meneduhkanmu, dulunya cuma sebutir biji yang tekun.',
  'Akar yang dalam tidak takut badai. Konsistensimu adalah akar itu.',
  'Tumbuh itu lambat, lalu tiba-tiba — seperti musim.',
  'Kamu tidak perlu mengejar siapa pun. Pohon tidak berlari, tapi sampai ke langit.',
  'Hari yang kamu mulai setengah hati pun tetap menyiram sesuatu.',
  'Buah paling manis adalah yang paling lama dijaga di dahan.',
  'Ranting yang patah bukan akhir cerita — pohon tumbuh dua tunas baru.',
  'Musim dingin bukan diabaikan pohon; ia dipakai untuk berakar.',
  'Sebesar apa pun pohonnya, ia tetap minum setetes demi setetes.',
  'Kebiasaan kecil hari ini adalah bayangan pohon besar di masa depan.',
  'Pohon tidak membandingkan tingginya dengan tetangganya.',
  'Yang kamu rawat, itu yang tumbuh. Pilih dengan bijak apa yang kamu siram.',
  'Istirahat itu bagian dari tumbuh — dedaunan pun gugur untuk pulih.',
  'Level boleh naik perlahan; kuncinya jangan pernah nol hari dua kali.',
  'Setiap sunrise adalah tap persediaan air baru untuk pohonmu.',
  'Pohon dewasa bukan yang tumbuh paling cepat, tapi yang paling jarang berhenti.',
];

/** Partikel daun gugur saat pohon disapa. */
interface LeafParticle {
  id: number;
  leftPct: number;
  dx: number;
  durMs: number;
  delayMs: number;
  amber: boolean;
}

const MAX_DROPLETS = 10;

// ── Helpers murni ───────────────────────────────────────────────────────

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - start) / 86_400_000);
}

function todayWisdom(now: Date): string {
  return TREE_WISDOM[dayOfYear(now) % TREE_WISDOM.length];
}

function shortDateLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ymd = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${d} ${bulan[m - 1]} ${y}`;
}

// ── Layar ───────────────────────────────────────────────────────────────

export default function PohonScreen() {
  // Navigation primitives (store) — semua jalur keluar layar ini.
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const openTrackerDate = useAppStore((s) => s.openTrackerDate);
  const openHabitFocus = useAppStore((s) => s.openHabitFocus);
  const openGoalFocus = useAppStore((s) => s.openGoalFocus);
  const openProgressTree = useAppStore((s) => s.openProgressTree);
  const setSettingsSection = useAppStore((s) => s.setSettingsSection);
  const openTrackerHistory = useAppStore((s) => s.openTrackerHistory);
  const refreshKey = useAppStore((s) => s.refreshKey);

  const todayStr = jakartaDateString();

  // ── Data (semua cache terbagih dengan tab lain) ───────────────────────
  // Key persis keluarga Beranda (['dashboard','all',refreshKey,…]) supaya
  // berpindah Beranda ↔ Pohon tidak memicu fetch ulang.
  const { data: dash, isLoading } = useQuery({
    queryKey: ['dashboard', 'all', refreshKey, 0],
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
  // berbunga > tahap normal.
  const artwork = tree
    ? tree.dorman
      ? TREE_STATE_ART.dorman
      : tree.care
        ? TREE_STATE_ART['daun-kuning']
        : tree.blooming
          ? TREE_STATE_ART.berbunga
          : tree.stage.artwork
    : TREE_STATE_ART.dorman; // placeholder saat loading (dicek di bawah)

  // ── Interaksi menyenangkan ────────────────────────────────────────────
  const [swayKey, setSwayKey] = useState(0);
  const [leaves, setLeaves] = useState<LeafParticle[]>([]);
  const [watering, setWatering] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const tapCountRef = useRef(0);
  const leafIdRef = useRef(0);
  const whisperIdxRef = useRef(0);

  // Ambience malam (hydrate-aman: default siang, dihitung setelah mount).
  const [isNight, setIsNight] = useState(false);
  useEffect(() => {
    const update = () => {
      const hour = Number(
        new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Jakarta' }).format(new Date()),
      );
      setIsNight(hour >= 18 || hour < 6);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  const handleTapTree = useCallback(() => {
    setSwayKey((k) => k + 1);
    tapCountRef.current += 1;

    // Daun gugur — 2-3 lembar tiap sapaan.
    const spawn: LeafParticle[] = Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => ({
      id: ++leafIdRef.current,
      leftPct: 34 + Math.random() * 32,
      dx: Math.round(-60 + Math.random() * 120),
      durMs: 1900 + Math.round(Math.random() * 900),
      delayMs: Math.round(Math.random() * 120),
      amber: Math.random() < 0.3,
    }));
    setLeaves((prev) => [...prev.slice(-8), ...spawn]);
    const maxDur = Math.max(...spawn.map((l) => l.durMs + l.delayMs));
    window.setTimeout(() => {
      setLeaves((prev) => prev.filter((l) => !spawn.some((s) => s.id === l.id)));
    }, maxDur + 150);

    // Easter egg tap ke-10 — rahasia kecil pengguna setia.
    if (tapCountRef.current === 10) {
      toast.success('Rahasia kecil: pohon ini tumbuh dari XP-mu 🌱 terus siram!');
      setCelebrating(true);
      window.setTimeout(() => setCelebrating(false), 2200);
      return;
    }
    // Bisik-bisik tiap sapaan ke-4 — rotasi pesan, anti-spam toast.
    if (tapCountRef.current % 4 === 0) {
      toast(TREE_WHISPERS[whisperIdxRef.current % TREE_WHISPERS.length], {
        icon: '🌿',
        duration: 2600,
      });
      whisperIdxRef.current += 1;
    }
  }, []);

  const handleWater = useCallback(() => {
    if (watering) return;
    setWatering(true);
    window.setTimeout(() => {
      setWatering(false);
      if (todayTotal === 0) {
        toast('Belum ada rutinitas untuk disiram hari ini', {
          description: 'Buat rutinitas pertamamu — biji pohon menunggu ditanam.',
          action: {
            label: 'Buat Rutinitas',
            onClick: () => {
              setSettingsSection('habits');
              setActiveTab('settings');
            },
          },
        });
      } else if (allWatered) {
        setCelebrating(true);
        window.setTimeout(() => setCelebrating(false), 2400);
        toast.success('Pohonmu minum hari ini! 🌟 Pertumbuhan terjaga.', {
          description: `${todayDone} rutinitas selesai — tetesan jatuh sempurna.`,
        });
      } else {
        toast(`Baru ${todayDone} dari ${todayTotal} tetes hari ini`, {
          description: 'Setiap rutinitas yang kamu selesai meneteskan air untuk pohonmu.',
          action: {
            label: 'Lihat Rutinitas',
            onClick: () => openTrackerDate(todayStr),
          },
        });
      }
    }, 1150);
  }, [watering, todayTotal, todayDone, allWatered, openTrackerDate, todayStr, setSettingsSection, setActiveTab]);

  const wisdom = useMemo(() => todayWisdom(new Date()), []);
  const narrative = tree ? treeGrowthNarrative(tree) : '';
  const pct = tree ? Math.round(tree.stageProgress) : 0;

  // ── Loading ───────────────────────────────────────────────────────────
  if (isLoading && !dash) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        {/* TASK 56: TreeMark — artwork pohon botanical (sama dgn splash).
            Dulu TreeGrow vektor lama. */}
        <TreeMark size={72} variant="inline" />
      </div>
    );
  }

  return (
    <div className="app-ambience space-y-5">
      <PageHeader
        eyebrow="Rutina"
        title="Pohonmu"
        subtitle="Cermin pertumbuhan seumur hidupmu — sapa, siram, dan panen."
        icon={TreePine}
      />

      {/* ══ ① PANGGUNG INTERAKTIF ══════════════════════════════════════ */}
      <ScrollReveal>
        <section
          aria-label={`Panggung pohon — tahap ${tree?.stage.label ?? '…'}`}
          className="relative overflow-hidden rounded-3xl border border-teal-900/60 shadow-[0_18px_44px_-18px_rgba(2,20,17,0.55)]"
          style={{ background: 'linear-gradient(160deg,#071715 0%,#05110F 60%,#04100D 100%)' }}
        >
          {/* Cahaya lingkungan — teal lembut; malam → bulan emas */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 right-[-60px] h-56 w-56 rounded-full blur-3xl"
            style={{ background: isNight ? 'rgba(237,188,63,0.16)' : 'rgba(52,217,163,0.14)' }}
          />

          {/* Badge tahap + musim */}
          <div className="pointer-events-none absolute left-3 top-3 z-20 flex max-w-[70%] flex-col items-start gap-2">
            <span className="rounded-full border border-[#63E6BE]/30 bg-[#071715]/70 px-3 py-1.5 text-[11px] font-bold text-[#9AF4CC] backdrop-blur-sm">
              {tree?.stage.label ?? '—'} · Level {dash?.currentLevel ?? '…'}
            </span>
            {tree?.blooming && (
              <span className="rounded-full border border-[#F1A2C5]/35 bg-[#F1A2C5]/15 px-3 py-1.5 text-[11px] font-semibold text-[#F1C9D9] backdrop-blur-sm">
                Sedang berbunga
              </span>
            )}
            {tree?.dorman && (
              <span className="rounded-full border border-[#9BC1B7]/30 bg-white/[0.07] px-3 py-1.5 text-[11px] font-semibold text-[#C6DAD3] backdrop-blur-sm">
                Sebagian dorman 😴
              </span>
            )}
            {tree?.care && (
              <span className="rounded-full border border-[#E7B64B]/35 bg-[#E7B64B]/15 px-3 py-1.5 text-[11px] font-semibold text-[#F1D9A0] backdrop-blur-sm">
                Daun menguning
              </span>
            )}
          </div>

          {/* Pohon — area tap besar (sentuh = sapamu pohon) */}
          <button
            type="button"
            onClick={handleTapTree}
            aria-label={`Sapa pohonmu — tahap ${tree?.stage.label ?? 'memuat'}, Level ${dash?.currentLevel ?? '…'}. Ketuk untuk membuatnya bergoyang.`}
            className="group relative block w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63E6BE]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.995]"
          >
            <div key={swayKey} className="anim-pohon-sway">
              {/* Artwork aset pengguna (1024²) — pas penuh, bg menyatu */}
              <img
                src={artwork}
                alt=""
                width={640}
                height={640}
                loading="eager"
                decoding="async"
                className="mx-auto block aspect-square w-full max-w-[440px] select-none object-contain"
                draggable={false}
              />
            </div>

            {/* Daun ambient (selalu ada, halus) */}
            <span aria-hidden="true" className="anim-pohon-drift pointer-events-none absolute left-[16%] top-[26%] hidden text-[#63E6BE]/50 sm:block" style={{ ['--pohon-dur' as string]: '7s' }}>
              <Leaf className="h-4 w-4" />
            </span>
            <span aria-hidden="true" className="anim-pohon-drift pointer-events-none absolute right-[18%] top-[38%] hidden text-[#9AF4CC]/40 sm:block" style={{ ['--pohon-dur' as string]: '8.5s', ['--pohon-delay' as string]: '1.2s' }}>
              <Leaf className="h-3.5 w-3.5" />
            </span>

            {/* Kunang-kunang — hanya malam Jakarta */}
            {isNight && (
              <>
                <span aria-hidden="true" className="anim-pohon-firefly pointer-events-none absolute left-[24%] top-[30%] h-1.5 w-1.5 rounded-full bg-[#9AF4CC] shadow-[0_0_8px_2px_rgba(154,244,204,0.6)]" />
                <span aria-hidden="true" className="anim-pohon-firefly pointer-events-none absolute right-[28%] top-[46%] h-1 w-1 rounded-full bg-[#EDBC3F] shadow-[0_0_6px_2px_rgba(237,188,63,0.55)]" style={{ ['--pohon-dur' as string]: '6s', ['--pohon-delay' as string]: '0.8s' }} />
              </>
            )}

            {/* Partikel daun gugur (sapaan) */}
            {leaves.map((l) => (
              <span
                key={l.id}
                aria-hidden="true"
                className="anim-pohon-leaf pointer-events-none absolute top-[38%]"
                style={{
                  left: `${l.leftPct}%`,
                  ['--pohon-dx' as string]: `${l.dx}px`,
                  ['--pohon-dur' as string]: `${l.durMs}ms`,
                  ['--pohon-delay' as string]: `${l.delayMs}ms`,
                }}
              >
                <Leaf className={cn('h-4 w-4', l.amber ? 'text-[#EDBC3F]' : 'text-[#63E6BE]')} />
              </span>
            ))}

            {/* Tetesan penyiraman */}
            {watering &&
              Array.from({ length: 5 }, (_, i) => (
                <span
                  key={`drop-${i}`}
                  aria-hidden="true"
                  className="anim-pohon-drop pointer-events-none absolute top-[30%]"
                  style={{
                    left: `${36 + i * 7}%`,
                    ['--pohon-delay' as string]: `${i * 110}ms`,
                  }}
                >
                  <Droplet className="h-3.5 w-3.5 text-[#7DD3C8] drop-shadow-[0_2px_4px_rgba(125,211,200,0.5)]" />
                </span>
              ))}

            {/* Perayaan sparkle emas */}
            {celebrating &&
              Array.from({ length: 9 }, (_, i) => (
                <span
                  key={`spark-${i}`}
                  aria-hidden="true"
                  className="anim-pohon-sparkle pointer-events-none absolute"
                  style={{
                    left: `${18 + (i * 67) % 66}%`,
                    top: `${20 + ((i * 37) % 46)}%`,
                    ['--pohon-dur' as string]: `${1300 + (i % 4) * 260}ms`,
                    ['--pohon-delay' as string]: `${(i % 5) * 130}ms`,
                  }}
                >
                  <Sparkles className={cn('h-5 w-5', i % 3 === 0 ? 'text-[#FFE99A]' : 'text-[#63E6BE]')} />
                </span>
              ))}

            {/* Petunjuk halus — "ini bisa disentuh" */}
            <span className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
              <span className="rounded-full bg-[#071715]/60 px-3 py-1 text-[10.5px] font-semibold tracking-wide text-[#9BC1B7] backdrop-blur-sm transition-opacity group-hover:opacity-100 sm:opacity-70">
                ketuk pohonmu 👆
              </span>
            </span>
          </button>
        </section>
      </ScrollReveal>

      {/* ══ ② PROGRES PERTUMBUHAN ═════════════════════════════════════ */}
      <ScrollReveal>
        <section className="rounded-2xl border border-teal-900/50 bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-foreground">Pertumbuhan</h2>
            <p className="text-[11px] font-bold tabular-nums text-[#63E6BE]">{pct}%</p>
          </div>
          <div
            className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#10362E]"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progres menuju tahap ${tree?.nextStage ? tree.nextStage.label : 'puncak pertumbuhan'} — ${pct}%`}
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
            <p className="text-[11px] text-muted-foreground">
              {dash ? `${(dash.totalXP ?? 0).toLocaleString('id-ID')} XP · streak ${dash.currentStreak ?? 0} hari` : '…'}
            </p>
            <button
              type="button"
              onClick={openProgressTree}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg text-[11.5px] font-semibold text-[#63E6BE] transition-colors hover:text-[#9AF4CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63E6BE]/60"
            >
              <LineChart className="h-3.5 w-3.5" aria-hidden="true" />
              Jalan Pertumbuhan
            </button>
          </div>
        </section>
      </ScrollReveal>

      {/* ══ ③ PENYIRAMAN ═══════════════════════════════════════════════ */}
      <ScrollReveal>
        <section className="rounded-2xl border border-teal-900/50 bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-foreground">Siram Pohonmu</h2>
            {allWatered && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#63E6BE]/30 bg-[#63E6BE]/10 px-2.5 py-1 text-[11px] font-semibold text-[#7DD3C8]">
                <Droplets className="h-3 w-3" aria-hidden="true" />
                Kenyang hari ini ✓
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            Setiap rutinitas yang selesai hari ini = satu tetes air untuk pohonmu.
          </p>

          {/* Tetes hari ini — x/y (maks tampil 10, sisanya angka) */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-hidden="true">
            {Array.from({ length: Math.min(todayTotal, MAX_DROPLETS) }, (_, i) => (
              <Droplet
                key={i}
                className={cn(
                  'h-4.5 w-4.5 transition-colors',
                  i < todayDone
                    ? 'fill-[#63E6BE]/30 text-[#63E6BE]'
                    : 'text-muted-foreground/35',
                )}
                strokeWidth={2}
              />
            ))}
            {todayTotal > MAX_DROPLETS && (
              <span className="text-[11px] font-bold tabular-nums text-[#63E6BE]">
                {todayDone}/{todayTotal}
              </span>
            )}
          </div>
          <p className="sr-only">
            {todayTotal === 0
              ? 'Belum ada rutinitas hari ini.'
              : `${todayDone} dari ${todayTotal} rutinitas hari ini selesai.`}
          </p>

          <div className="mt-3.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleWater}
              disabled={watering}
              className={cn(
                'inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all',
                'bg-gradient-to-r from-[#63E6BE] to-[#1E9B72] text-[#04120E]',
                'shadow-[0_10px_24px_-10px_rgba(30,155,114,0.55)] hover:brightness-110',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63E6BE]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                'active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none',
              )}
            >
              <Droplets className="h-4 w-4" aria-hidden="true" />
              {watering ? 'Menyiram…' : 'Siram Sekarang'}
            </button>
            <button
              type="button"
              onClick={() => openTrackerDate(todayStr)}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-teal-900/50 px-4 py-2.5 text-[13px] font-semibold text-[#63E6BE] transition-colors hover:bg-[#63E6BE]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63E6BE]/60"
            >
              Rutinitas
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </section>
      </ScrollReveal>

      {/* ══ ④ STATISTIK POHON ═════════════════════════════════════════ */}
      <ScrollReveal>
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="rounded-2xl border border-teal-900/50 bg-card p-3 text-center shadow-sm sm:p-4">
            <TreePine className="mx-auto h-4.5 w-4.5 text-[#63E6BE]" aria-hidden="true" />
            <p className="mt-1.5 text-sm font-bold tabular-nums text-foreground">{tree?.stage.label ?? '—'}</p>
            <p className="text-[10.5px] font-medium text-muted-foreground">{tree?.stage.levelLabel ?? 'Level 1'}</p>
          </div>
          <div className="rounded-2xl border border-teal-900/50 bg-card p-3 text-center shadow-sm sm:p-4">
            <Flame className={cn('mx-auto h-4.5 w-4.5', tree?.blooming ? 'text-[#F1A2C5]' : 'text-[#E7B64B]')} aria-hidden="true" />
            <p className="mt-1.5 text-sm font-bold tabular-nums text-foreground">{dash?.currentStreak ?? 0} hari</p>
            <p className="text-[10.5px] font-medium text-muted-foreground">
              {tree?.blooming ? `bunga mulai ${TREE_BLOOM_STREAK}🔥` : 'streak berjalan'}
            </p>
          </div>
          <div className="rounded-2xl border border-teal-900/50 bg-card p-3 text-center shadow-sm sm:p-4">
            <Apple className="mx-auto h-4.5 w-4.5 text-[#EDBC3F]" aria-hidden="true" />
            <p className="mt-1.5 text-sm font-bold tabular-nums text-foreground">{fruits.length}</p>
            <p className="text-[10.5px] font-medium text-muted-foreground">buah emas</p>
          </div>
        </div>
      </ScrollReveal>

      {/* ══ ⑤ BUAH EMAS — PANEN NYATA ═════════════════════════════════ */}
      <ScrollReveal>
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
                Selesaikan sebuah <strong className="text-foreground">tujuan</strong> atau luluskan sebuah{' '}
                <strong className="text-foreground">habit</strong> — kemenangan pertamamu akan menggantung di
                sini sebagai buah emas.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('goals')}
                className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#EDBC3F] to-[#C1830F] px-4 py-2.5 text-[13px] font-semibold text-[#241703] shadow-[0_10px_24px_-10px_rgba(193,131,15,0.5)] transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EDBC3F]/70 active:scale-[0.98]"
              >
                Buka Tujuan
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1" aria-label="Daftar buah emas">
              {fruits.map((f) => {
                const label = shortDateLabel(f.date);
                return (
                  <li key={`${f.kind}-${f.id}`}>
                    <button
                      type="button"
                      onClick={() => (f.kind === 'goal' ? openGoalFocus(f.id) : openHabitFocus(f.id))}
                      aria-label={`Buah emas ${f.title} — ${f.kind === 'goal' ? 'tujuan selesai' : 'habit lulus'}${label ? ` sejak ${label}` : ''}. Buka konteksnya.`}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-[#E7B64B]/20 bg-[#E7B64B]/[0.05] p-3 text-left transition-colors hover:bg-[#E7B64B]/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E7B64B]/60"
                    >
                      <span
                        aria-hidden="true"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#FFE99A] to-[#D89A2B] text-[#241703] shadow-[0_4px_10px_-2px_rgba(216,154,43,0.5)]"
                      >
                        {f.emoji ? <span className="text-base leading-none">{f.emoji}</span> : <Apple className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-foreground">{f.title}</span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {f.kind === 'goal' ? 'Tujuan tercapai' : 'Habit lulus'}
                          {label ? ` · ${label}` : ''}
                        </span>
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#E7B64B]" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </ScrollReveal>

      {/* ══ ⑥ SINYAL MUSIM (kompak, ber-aksi) ══════════════════════════ */}
      <ScrollReveal>
        <section className="rounded-2xl border border-teal-900/50 bg-card p-4 shadow-sm sm:p-5">
          <h2 className="font-display text-base font-semibold text-foreground">Musim Pohonmu</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {tree?.blooming && (
              <button
                type="button"
                onClick={() => openTrackerHistory(todayStr.slice(0, 7))}
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
                onClick={() => {
                  setSettingsSection('habits');
                  setActiveTab('settings');
                }}
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
                onClick={() => openHabitFocus(tree.care!.habitId)}
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
      </ScrollReveal>

      {/* ══ ⑦ KEBIJAKSAAN POHON ═══════════════════════════════════════ */}
      <ScrollReveal>
        <section
          className="relative overflow-hidden rounded-2xl border border-[#E7B64B]/25 p-4 sm:p-5"
          style={{ background: 'linear-gradient(135deg,#101408,#0D0F07)' }}
          aria-label="Kebijaksanaan pohon hari ini"
        >
          <Quote className="h-5 w-5 text-[#EDBC3F]/80" aria-hidden="true" />
          <p className="font-display mt-2 text-[15px] font-medium leading-relaxed text-[#F4E9C8]">
            “{wisdom}”
          </p>
          <p className="mt-2 text-[11px] font-medium text-[#EDBC3F]/70">
            Kebijaksanaan Pohon · berganti tiap hari
          </p>
        </section>
      </ScrollReveal>
    </div>
  );
}
