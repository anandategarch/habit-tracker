// lib/tree-growth.ts — POHON RUTINA (Task 53): logika pertumbuhan murni.
//
// Prinsip CONNECTED-APP #14 "Tree sebagai umpan balik sistem, bukan
// dekorasi": tahap pohon diturunkan SEPENUHNYA dari data yang sudah ada
// (XP → level via calcLevel di dashboard-helpers; streak; goal lulus;
// mode liburan). Tidak ada state pohon tersimpan — pohon selalu jujur
// mencerminkan ekosistem.
//
// Ambang tahap mengikuti label aset milik pengguna:
//   benih "LEVEL 01" · tunas "LEVEL 02–03" · pohon-muda "LEVEL 04–06"
//   · pohon-dewasa "LEVEL 07–12" — konsisten dengan xpForLevel
//   (20·L²) yang sudah dipakai aplikasi.
//
// Tiga STATE MUSIMAN di atas tahap (bukan penghukuman — sinyal):
//   berbunga   — streak ≥ 7: "hasil = proses yang diulang"
//   dorman     — ada habit mode liburan aktif: istirahat terencana
//   daun-kuning — habit terlemah selesai < 50%: ayo dirawat

import { xpForLevel } from '@/lib/dashboard-helpers';

export type TreeStageId = 'benih' | 'tunas' | 'pohon-muda' | 'pohon-dewasa';

export interface TreeStage {
  id: TreeStageId;
  /** Path artwork botanical (aset pengguna, teks poster sudah dibersihkan
   *  supaya level/XP ASLI yang dirender UI). */
  artwork: string;
  label: string;
  /** Rentang level tahap ini (label tampilan). */
  levelLabel: string;
  /** Level minimum tahap (eksklusif-min: stage.minLevel ≤ level user). */
  minLevel: number;
  /** Level maksimum tahap (inklusif; tahap terakhir tak berbatas). */
  maxLevel: number | null;
  tagline: string;
  /** Deskripsi panjang untuk kartu roadmap Progres. */
  description: string;
}

export const TREE_STAGES: readonly TreeStage[] = [
  {
    id: 'benih',
    artwork: '/tree/benih.svg',
    label: 'Benih',
    levelLabel: 'Level 1',
    minLevel: 1,
    maxLevel: 1,
    tagline: 'Satu keputusan kecil bisa menjadi awal dari perubahan besar.',
    description:
      'Biji bercahaya baru ditanam. Semua orang mulai dari sini — keputusan kecil hari ini adalah akar pertamamu.',
  },
  {
    id: 'tunas',
    artwork: '/tree/tunas.svg',
    label: 'Tunas',
    levelLabel: 'Level 2–3',
    minLevel: 2,
    maxLevel: 3,
    tagline: 'Konsistensi mulai terlihat. Kebiasaan mulai punya bentuk.',
    description:
      'Kecambah dua daun dengan kunang-kunang. Ritme harianmu mulai terbentuk — pertahankan, jangan buru-buru.',
  },
  {
    id: 'pohon-muda',
    artwork: '/tree/pohon-muda.svg',
    label: 'Pohon Muda',
    levelLabel: 'Level 4–6',
    minLevel: 4,
    maxLevel: 6,
    tagline: 'Rutinitas mulai berakar dan memberi hasil yang lebih stabil.',
    description:
      'Batang dan dua lapis tajuk mulai berkembang, akar makin dalam. Konsistensimu sudah terlihat dari luar.',
  },
  {
    id: 'pohon-dewasa',
    artwork: '/tree/pohon-dewasa.svg',
    label: 'Pohon Dewasa',
    levelLabel: 'Level 7+',
    minLevel: 7,
    maxLevel: null,
    tagline: 'Konsistensi berubah menjadi sistem yang bisa diandalkan.',
    description:
      'Tajuk tiga lapis dengan buah emas — buahmu adalah goal yang sudah lulus. Panen dari kebiasaan yang dijaga bertahun-tahun.',
  },
] as const;

/** State musiman (overlay di atas tahap) — artwork khusus dari aset pengguna. */
export const TREE_STATE_ART = {
  berbunga: '/tree/berbunga.svg',
  dorman: '/tree/dorman.svg',
  'daun-kuning': '/tree/daun-kuning.svg',
} as const;

/** Ambang "sedang berbunga" — selaras tree-heat/loader (streak ≥ 7). */
export const TREE_BLOOM_STREAK = 7;
/** Ambang sinyal "perlu dirawat" — habit terlemah selesai di bawah ini. */
export const TREE_CARE_RATE = 50;

export interface TreeCareSignal {
  habitId: string;
  habitName: string;
  rate: number;
}

export interface TreeGrowthInput {
  level: number;
  totalXp: number;
  /** Progres XP menuju level berikutnya, 0–100. */
  levelProgress: number;
  currentStreak: number;
  /** Jumlah goal/habit yang sudah lulus (buah emas pohon dewasa). */
  graduatedCount: number;
  /** Habit terlemah (rate 0–100) untuk sinyal daun menguning. */
  worstHabit?: { id?: string; name: string; rate: number } | null;
  /** Jumlah habit dengan mode liburan aktif. */
  vacationCount: number;
}

export interface TreeGrowthState {
  stage: TreeStage;
  stageIndex: number;
  /** Tahap berikutnya (null saat tahap terakhir — "puncak pertumbuhan"). */
  nextStage: TreeStage | null;
  /** XP minimum untuk mencapai tahap berikutnya. */
  nextStageXp: number | null;
  /** Sisa XP menuju tahap berikutnya. */
  xpToNextStage: number | null;
  /** Progres XP menuju tahap berikutnya, 0–100 (untuk bar kartu Beranda). */
  stageProgress: number;
  /** Progres XP menuju LEVEL berikutnya, 0–100 (identik TodayHero). */
  levelProgress: number;
  /** State musiman aktif. */
  blooming: boolean;
  dorman: boolean;
  care: TreeCareSignal | null;
}

/** Tahap untuk level tertentu — murni fungsi, mudah diuji. */
export function stageForLevel(level: number): TreeStage {
  for (let i = TREE_STAGES.length - 1; i >= 0; i--) {
    if (level >= TREE_STAGES[i].minLevel) return TREE_STAGES[i];
  }
  return TREE_STAGES[0];
}

/** Hitung seluruh state pohon dari data dashboard + habits. */
export function getTreeGrowthState(input: TreeGrowthInput): TreeGrowthState {
  const stage = stageForLevel(input.level);
  const stageIndex = TREE_STAGES.findIndex((s) => s.id === stage.id);
  const nextStage = stageIndex < TREE_STAGES.length - 1 ? TREE_STAGES[stageIndex + 1] : null;

  let nextStageXp: number | null = null;
  let xpToNextStage: number | null = null;
  let stageProgress = 100;
  if (nextStage) {
    nextStageXp = xpForLevel(nextStage.minLevel);
    xpToNextStage = Math.max(0, nextStageXp - input.totalXp);
    // Lantai XP tahap: Level 1 mulai dari 0 (xpForLevel(1)=20 adalah
    // salah untuk lantai — ambang "level 2" yang benar 80, tapi level 1
    // berlaku sejak XP 0).
    const stageFloorXp = stage.minLevel <= 1 ? 0 : xpForLevel(stage.minLevel);
    const span = nextStageXp - stageFloorXp;
    stageProgress =
      span > 0 ? Math.min(100, Math.max(0, ((input.totalXp - stageFloorXp) / span) * 100)) : 100;
  }

  const care: TreeCareSignal | null =
    input.worstHabit && input.worstHabit.id && input.worstHabit.rate < TREE_CARE_RATE
      ? {
          habitId: input.worstHabit.id,
          habitName: input.worstHabit.name,
          rate: Math.round(input.worstHabit.rate),
        }
      : null;

  return {
    stage,
    stageIndex,
    nextStage,
    nextStageXp,
    xpToNextStage,
    stageProgress,
    levelProgress: input.levelProgress,
    blooming: input.currentStreak >= TREE_BLOOM_STREAK,
    dorman: input.vacationCount > 0,
    care,
  };
}

/** Narasi pertumbuhan untuk kartu Beranda — emosional, bukan angka mentah. */
export function treeGrowthNarrative(state: TreeGrowthState): string {
  if (!state.nextStage) {
    return `Pohon dewasamu terus tumbuh — ${state.blooming ? 'dan sedang berbunga' : 'rawat terus ritmenya'}.`;
  }
  const xp = state.xpToNextStage ?? 0;
  if (xp <= 0) {
    return `Pohonmu siap tumbuh ke tahap ${state.nextStage.label}!`;
  }
  return `${xp} XP lagi menuju ${state.nextStage.label} — setiap rutinitas selesai menyiramnya.`;
}
