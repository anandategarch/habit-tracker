// lib/tree-season.ts — POHON MUSIM MINGGUAN (Task 62, Opsi B).
//
// Permintaan user: progres pohon RESET setiap minggu — "tiap Senin mulai
// Benih lagi". Dipilih Opsi B: tahap pohon diturunkan dari XP yang
// dikumpulkan SEJAK AWAL MINGGU (Senin–Minggu, Asia/Jakarta) sampai hari
// ini; minggu baru = musim baru = pohon mulai dari Benih.
//
// Prinsip yang dijaga (CONNECTED-APP + kendala read-only):
//   * totalXp / level / streak ALL-TIME TIDAK diubah sama sekali — level
//     tetap "kenangan kemenangan" (komentar route: bukan sewa bulanan).
//     Musim mingguan adalah LAPISAN TURUNAN (derived view) murni dari
//     log habit yang sudah ada — tidak ada state baru, tidak ada kolom
//     DB baru, tidak ada migrasi.
//   * Sinyal musiman lama tetap berlaku di atasnya: berbunga (streak ≥7),
//     dorman (mode liburan), daun-kuning (habit terlemah) — diputuskan
//     komponen, bukan lib ini.
//   * Ambang mingguan diskalakan ulang dari kurva level 20·L² (all-time):
//     1 minggu ideal ≈ 200–420 XP (habit medium 10 XP × 6 × 7), jadi
//     Dewasa (300) benar-benar tercapai dengan konsistensi penuh —
//     "panen akhir pekan", bukan mustahil.
//
// Hari reset mengikuti `seasonStartYmd` dari API (weekStartOf — menghormati
// pengaturan weekStart user, default Senin). Fallback klien: Senin minggu
// berjalan dihitung sendiri dari tanggal Jakarta.

import { TREE_STAGES, type TreeStage } from '@/lib/tree-growth';
import { dateFromYMD } from '@/lib/timezone';
import { eeeeIdFormatter } from '@/lib/date-utils';

/** Ambang XP mingguan: Benih <50 · Tunas 50–149 · Pohon Muda 150–299 · Dewasa ≥300. */
export const TREE_SEASON_THRESHOLDS = [50, 150, 300] as const;

export interface TreeSeasonState {
  /** Tahap musim minggu ini (artwork/label/tagline dari TREE_STAGES). */
  stage: TreeStage;
  stageIndex: number;
  /** Tahap berikutnya musim ini (null = Dewasa — puncak mingguan). */
  nextStage: TreeStage | null;
  /** XP terkumpul sejak awal minggu (Jakarta). */
  weeklyXp: number;
  /** Sisa XP menuju tahap berikutnya (null saat Dewasa). */
  xpToNextStage: number | null;
  /** Progres XP dalam rentang tahap berjalan, 0–100. */
  seasonProgress: number;
  /** Nama hari reset ("Senin" — turunan seasonStartYmd, jujur ke setting). */
  resetLabel: string;
  /** Hari lagi sebelum reset (1–7; 7 saat hari reset itu sendiri). */
  daysLeft: number;
  /** Tahap tertinggi mingguan tercapai. */
  isMax: boolean;
}

const DAY_MS = 86_400_000;

const toYmd = (d: Date): string => d.toISOString().slice(0, 10);

/** Senin minggu berjalan dari sebuah YMD (fallback klien saat API lama). */
export function mondayOfYmd(ymd: string): string {
  const d = dateFromYMD(ymd);
  const offset = (d.getUTCDay() + 6) % 7; // Senin-first
  return toYmd(new Date(d.getTime() - offset * DAY_MS));
}

function seasonIndexForXp(xp: number): number {
  if (xp >= TREE_SEASON_THRESHOLDS[2]) return 3;
  if (xp >= TREE_SEASON_THRESHOLDS[1]) return 2;
  if (xp >= TREE_SEASON_THRESHOLDS[0]) return 1;
  return 0;
}

/**
 * Hitung seluruh state musim mingguan.
 * @param weeklyXp      XP sejak awal minggu (kpi.weeklyXp dari API).
 * @param seasonStartYmd YMD awal minggu dari API (null → fallback Senin lokal).
 * @param todayYmd      YMD hari ini Jakarta (dari state komponen — bukan
 *                      new Date() saat render supaya stabil dalam satu pass).
 */
export function getTreeSeasonState(
  weeklyXp: number,
  seasonStartYmd: string | null | undefined,
  todayYmd: string,
): TreeSeasonState {
  const safeXp = Number.isFinite(weeklyXp) && weeklyXp > 0 ? Math.floor(weeklyXp) : 0;
  const start =
    typeof seasonStartYmd === 'string' && seasonStartYmd.length === 10
      ? seasonStartYmd
      : mondayOfYmd(todayYmd);

  const stageIndex = seasonIndexForXp(safeXp);
  const stage = TREE_STAGES[stageIndex];
  const nextStage = stageIndex < TREE_STAGES.length - 1 ? TREE_STAGES[stageIndex + 1] : null;
  const isMax = nextStage === null;

  const floorXp = stageIndex === 0 ? 0 : TREE_SEASON_THRESHOLDS[stageIndex - 1];
  const ceilXp = isMax ? null : TREE_SEASON_THRESHOLDS[stageIndex];
  const xpToNextStage = ceilXp != null ? Math.max(0, ceilXp - safeXp) : null;
  const seasonProgress =
    ceilXp != null && ceilXp > floorXp
      ? Math.min(100, Math.max(0, ((safeXp - floorXp) / (ceilXp - floorXp)) * 100))
      : 100;

  // Reset berikutnya = awal minggu + 7 hari; di hari reset itu sendiri
  // berarti "baru saja direset" → sisa 7 hari penuh.
  const nextReset = dateFromYMD(start).getTime() + 7 * DAY_MS;
  const daysLeft = Math.max(1, Math.min(7, Math.round((nextReset - dateFromYMD(todayYmd).getTime()) / DAY_MS)));

  return {
    stage,
    stageIndex,
    nextStage,
    weeklyXp: safeXp,
    xpToNextStage,
    seasonProgress,
    resetLabel: eeeeIdFormatter(dateFromYMD(start)),
    daysLeft,
    isMax,
  };
}

/** Narasi musim mingguan untuk kartu Beranda & tab Pohon. */
export function treeSeasonNarrative(state: TreeSeasonState): string {
  if (state.isMax) {
    return `Pohon minggu ini sudah ${state.stage.label} — pertahankan sampai reset ${state.resetLabel}.`;
  }
  if (state.weeklyXp <= 0) {
    return `Musim baru — selesaikan rutinitas pertamamu untuk menumbuhkan tunas. Reset ${state.resetLabel}.`;
  }
  const xp = state.xpToNextStage ?? 0;
  if (xp <= 0) {
    return `Pohonmu siap tumbuh ke tahap ${state.nextStage?.label ?? 'berikutnya'} minggu ini!`;
  }
  return `${xp.toLocaleString('id-ID')} XP lagi menuju ${state.nextStage?.label ?? 'tahap berikutnya'} minggu ini — setiap rutinitas selesai menyiramnya.`;
}
