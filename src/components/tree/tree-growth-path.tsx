'use client';

// components/tree/tree-growth-path.tsx — POHON RUTINA (Task 53): seksi
// "Jalan Pertumbuhan" di tab Progres.
//
// Roadmap 4 tahap botanical (aset pengguna) + 3 sinyal musiman. Status
// tiap kartu diturunkan dari data ASLI (level/XP user) — artwork yang
// sama bisa tampil "terkunci" bagi pemula dan "tercapai" bagi veteran.
//
// TASK 62 (Opsi B): roadmap ini JALUR SEUMUR HIDUP (level/XP all-time
// — tidak pernah direset), kini diberi label eksplisit supaya tidak
// tertukar dengan pohon MUSIM MINGGUAN di Beranda/tab Pohon yang reset
// tiap awal minggu (Senin).
//
// CONNECTED-APP: sinyal musiman SELALU beraksi saat aktif (brief #11:
// observation + context + action) — berbunga → riwayat streak, dorman →
// Habit Master, daun kuning → fokus habit yang melemah.

import { useEffect } from 'react';
import { Check, Lock, Flame, Palmtree, Leaf, ArrowUpRight } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import {
  TREE_STAGES,
  TREE_STATE_ART,
  TREE_BLOOM_STREAK,
  TREE_CARE_RATE,
  type TreeGrowthState,
} from '@/lib/tree-growth';
import { xpForLevel } from '@/lib/dashboard-helpers';

interface TreeGrowthPathProps {
  tree: TreeGrowthState;
  currentStreak: number;
  vacationCount: number;
  /** BUGHUNT-54 (3-c #4): label jendela waktu rate worstHabit — sumber rate
   *  mengikuti periode query aktif tab Progres ('7 hari' / '30 hari' /
   *  '90 hari' / 'sejak awal'), bukan hardcode "(30 hari)". */
  ratePeriodLabel: string;
}

type StageStatus = 'achieved' | 'current' | 'locked';

export function TreeGrowthPath({ tree, currentStreak, vacationCount, ratePeriodLabel }: TreeGrowthPathProps) {
  // Anchor deep-link: kartu "Pohonmu" Beranda mendarat di seksi ini
  // (pola consume-and-clear seperti trackerFocusNotes).
  const progressFocusTree = useAppStore((s) => s.progressFocusTree);
  const clearProgressTreeFocus = useAppStore((s) => s.clearProgressTreeFocus);

  useEffect(() => {
    if (!progressFocusTree) return;
    const el = document.getElementById('jalan-pertumbuhan');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    clearProgressTreeFocus();
  }, [progressFocusTree, clearProgressTreeFocus]);

  const statusFor = (minLevel: number): StageStatus => {
    const level = tree.stage.minLevel;
    if (minLevel < level) return 'achieved';
    if (minLevel === level) return 'current';
    return 'locked';
  };

  return (
    <section id="jalan-pertumbuhan" aria-label="Jalan Pertumbuhan" className="scroll-mt-24">
      <div className="premium-card-quiet rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="premium-label">Jalan Pertumbuhan</h3>
          <p className="text-xs text-muted-foreground">
            Tahap {tree.stageIndex + 1} dari {TREE_STAGES.length} · {tree.stage.label}
          </p>
        </div>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Pohonmu tumbuh dari XP yang kamu kumpulkan — {currentStreak > 0 ? `${currentStreak} hari beruntun saat ini` : 'mulai hari ini, sedikit demi sedikit'}.
        </p>
        {/* Task 62: penanda dua lapis — jalur ini seumur hidup, pohon musim
            mingguan (Beranda/tab Pohon) reset tiap awal minggu. */}
        <p className="mt-1.5 text-[11.5px] font-medium text-muted-foreground/85">
          Jalur seumur hidup — Level &amp; XP tidak pernah direset. Pohon musim mingguan (Beranda &amp; tab Pohon) reset setiap awal minggu.
        </p>

        {/* Roadmap tahap — scroll-snap mobile, grid desktop */}
        <div className="mt-4 -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {TREE_STAGES.map((stage) => {
            const status = statusFor(stage.minLevel);
            const isCurrent = status === 'current';
            const xpNeeded = xpForLevel(stage.minLevel);
            return (
              <div
                key={stage.id}
                className={
                  'relative w-[172px] shrink-0 snap-start overflow-hidden rounded-xl sm:w-auto ' +
                  (isCurrent
                    ? 'ring-2 ring-primary/70 shadow-[0_10px_30px_-12px_rgba(20,184,166,0.45)]'
                    : '')
                }
                style={{ background: 'linear-gradient(135deg,#071715,#05110F)' }}
                aria-current={isCurrent ? 'true' : undefined}
              >
                { }
                <img
                  src={stage.artwork}
                  alt={`Ilustrasi tahap ${stage.label}`}
                  width={344}
                  height={344}
                  loading="lazy"
                  decoding="async"
                  className={
                    'aspect-square w-full object-cover ' +
                    (status === 'locked' ? 'opacity-40 grayscale-[60%]' : status === 'achieved' ? 'opacity-75' : '')
                  }
                />
                {/* Badge status */}
                <span
                  className={
                    'absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ' +
                    (status === 'current'
                      ? 'bg-[#63E6BE] text-[#04211F]'
                      : status === 'achieved'
                        ? 'bg-white/12 text-[#BFE3D8]'
                        : 'bg-white/10 text-[#8FB0A6]')
                  }
                >
                  {status === 'current' ? (
                    'Sedang tumbuh'
                  ) : status === 'achieved' ? (
                    <>
                      <Check className="h-3 w-3" aria-hidden="true" /> Tercapai
                    </>
                  ) : (
                    <>
                      <Lock className="h-3 w-3" aria-hidden="true" /> Level {stage.minLevel}
                    </>
                  )}
                </span>
                <div className="px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#63E6BE]">
                    {stage.levelLabel}
                  </p>
                  <h4 className="font-display mt-0.5 text-[15px] font-semibold text-[#F4F9F7]">
                    {stage.label}
                  </h4>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#9BC1B7]">
                    {status === 'locked'
                      ? `Terbuka di Level ${stage.minLevel} — ${xpNeeded.toLocaleString('id-ID')} XP.`
                      : stage.tagline}
                  </p>
                  {isCurrent && (
                    <div className="mt-2">
                      <div className="h-1 overflow-hidden rounded-full bg-[#10362E]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#9AF4CC] to-[#1E9B72]"
                          style={{ width: `${Math.min(100, Math.max(0, Math.round(tree.stageProgress)))}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] font-semibold tabular-nums text-[#63E6BE]">
                        {tree.xpToNextStage != null && tree.nextStage
                          ? `${tree.xpToNextStage.toLocaleString('id-ID')} XP lagi`
                          : 'Tahap tertinggi'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sinyal musiman — pohon bicara tentang kondisimu, bukan menghukum */}
        <SignalCards
          tree={tree}
          currentStreak={currentStreak}
          vacationCount={vacationCount}
          ratePeriodLabel={ratePeriodLabel}
        />
      </div>
    </section>
  );
}

// ── Sinyal musiman ─────────────────────────────────────────────────────────

function SignalCards({
  tree,
  currentStreak,
  vacationCount,
  ratePeriodLabel,
}: {
  tree: TreeGrowthState;
  currentStreak: number;
  vacationCount: number;
  ratePeriodLabel: string;
}) {
  const openTrackerHistory = useAppStore((s) => s.openTrackerHistory);
  const openHabitFocus = useAppStore((s) => s.openHabitFocus);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const setSettingsSection = useAppStore((s) => s.setSettingsSection);
  const currentMonth = useAppStore((s) => s.trackerMonth);

  const signals: {
    id: string;
    art: string;
    icon: React.ReactNode;
    title: string;
    active: boolean;
    activeText: string;
    idleText: string;
    actionLabel: string | null;
    onAction: (() => void) | null;
    tone: string;
  }[] = [
    {
      id: 'berbunga',
      art: TREE_STATE_ART.berbunga,
      icon: <Flame className="h-4 w-4" aria-hidden="true" />,
      title: 'Berbunga',
      active: tree.blooming,
      activeText: `Streak ${currentStreak} hari — bunga bermekaran. Hasil = proses yang diulang.`,
      idleText: `Mekar saat streak mencapai ${TREE_BLOOM_STREAK} hari beruntun.`,
      actionLabel: tree.blooming ? 'Lihat riwayat streak' : null,
      onAction: tree.blooming ? () => openTrackerHistory(currentMonth) : null,
      tone: 'text-[#F1C9D9]',
    },
    {
      id: 'dorman',
      art: TREE_STATE_ART.dorman,
      icon: <Palmtree className="h-4 w-4" aria-hidden="true" />,
      title: 'Dorman',
      active: vacationCount > 0,
      activeText:
        vacationCount > 0
          ? `${vacationCount} habit sedang beristirahat terencana — akar tetap bekerja.`
          : '',
      idleText: 'Mode libur habit — istirahat terencana, bukan berhenti tumbuh.',
      actionLabel: vacationCount > 0 ? 'Kelola mode libur' : null,
      onAction:
        vacationCount > 0
          ? () => {
              setSettingsSection('habits');
              setActiveTab('settings');
            }
          : null,
      tone: 'text-[#C6DAD3]',
    },
    {
      id: 'daun-kuning',
      art: TREE_STATE_ART['daun-kuning'],
      icon: <Leaf className="h-4 w-4" aria-hidden="true" />,
      title: 'Daun Menguning',
      active: !!tree.care,
      // BUGHUNT-54 (3-c #4): label jendela rate mengikuti `ratePeriodLabel`
      // (periode query aktif Progres) — dulu hardcode "(30 hari)" sehingga
      // angka "Rawat" bisa bohong saat periode 7 hari / semua waktu.
      activeText: tree.care
        ? `"${tree.care.habitName}" selesai ${tree.care.rate}% (${ratePeriodLabel}) — ayo kembali dirawat.`
        : '',
      idleText: `Sinyal lembut saat habit terlemah turun di bawah ${TREE_CARE_RATE}%.`,
      actionLabel: tree.care ? `Rawat ${tree.care.habitName}` : null,
      onAction: tree.care ? () => openHabitFocus(tree.care!.habitId) : null,
      tone: 'text-[#F1D9A0]',
    },
  ];

  return (
    <div className="mt-5">
      <h4 className="premium-label">Sinyal Musim</h4>
      <p className="mt-1 text-xs text-muted-foreground">
        Pohon tidak menghukum — ia hanya berbisik apa yang sedang terjadi.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {signals.map((s) => (
          <div
            key={s.id}
            className={
              'flex items-start gap-3 rounded-xl border p-3 ' +
              (s.active
                ? 'border-primary/35 bg-primary/[0.06]'
                : 'border-border/70 bg-muted/30')
            }
          >
            { }
            <img
              src={s.art}
              alt=""
              width={80}
              height={80}
              loading="lazy"
              decoding="async"
              className={
                'h-16 w-16 shrink-0 rounded-lg object-cover object-[50%_62%] ' +
                (s.active ? '' : 'opacity-50 grayscale-[55%]')
              }
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={s.active ? '' : 'text-muted-foreground'}>{s.icon}</span>
                <p className={'text-[13px] font-bold ' + (s.active ? s.tone : 'text-muted-foreground')}>
                  {s.title}
                </p>
                <span
                  className={
                    'ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ' +
                    (s.active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')
                  }
                >
                  {s.active ? 'Aktif' : 'Diam'}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                {s.active ? s.activeText : s.idleText}
              </p>
              {s.active && s.actionLabel && s.onAction && (
                <button
                  type="button"
                  onClick={s.onAction}
                  className="mt-1.5 inline-flex cursor-pointer items-center gap-1 text-[11.5px] font-bold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 rounded-sm"
                >
                  {s.actionLabel}
                  <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
