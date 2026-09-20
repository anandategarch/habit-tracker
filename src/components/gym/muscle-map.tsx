'use client';

// ---------------------------------------------------------------------------
// src/components/gym/muscle-map.tsx — siluet tubuh Peta Otot.
//
// Task 64: inline SVG buatan tangan (ditracing dari aset desain user,
// upload/peta-otot/ panel 01/02) supaya TIAP zona bisa dianimasikan
// sendiri (pump/napas/balanced) — hal yang mustahil pada gambar statis.
// Task 68: redraw anatomis (proporti atletis + line-work definisi otot +
// teknik mirror simetri x=50).
// Task 69: GAYA OPSI A "GymWP/Fitness Point" (dipilih user dari 3 konsep
// design-concepts/): badan render gelap charcoal + zona aktif MENYALA
// merah-oranye terang (STATUS_BASE_OPACITY lib dinaikkan drastis) +
// glow. Semantik referensi: otot yang dilatih menyala, sisanya gelap.
//
// Teknik yang membuat ini mungkin TANPA file potongan per-otot:
//   1. Simetri tubuh → sisi kiri digambar sekali, sisi kanan = mirror
//      transform="matrix(-1 0 0 1 100 0)" (x → 100−x) — jaminan simetri.
//   2. Semua bagian tubuh ber-isian gradien kulit yang sama → tumpang
//      tindih antar-bagian tak terlihat, sambungan justru jadi "cut"
//      anatomi (stroke tepi per bagian).
//   3. Zona makro tetap <g> terpisah → klik/keyboard/pump/heatmap/status
//      warna (logika lib/muscle-map.ts) 100% tidak tersentuh.
//
// Konvensi repo: animasi CSS keyframes murni + transform-box: fill-box
// (pola .tree-leaves), 2 lapis <g> (attribute statis ≠ .mm-anim CSS).
//
// Zona makro (6 + Full Body preset) dipetakan ke tampilan DEPAN/BELAKANG:
//   Depan    : Dada · Bahu · Lengan · Perut · Kaki (quad+betis)
//   Belakang : Punggung (trapezius+latissimus+lower) · Bahu · Lengan · Kaki
// "Kaki" tampil di dua sisi (quad depan, hamstring/betis belakang) — zona
// makro tetap SATU habit; siluet hanya jendela pandang yang berbeda.
// ---------------------------------------------------------------------------

import { cn } from '@/lib/utils';
import {
  ZONE_STATUS_META,
  type GymZonePayload,
  type MuscleZoneKey,
  type MuscleZoneStatus,
} from '@/lib/muscle-map';

export interface MuscleZoneVisual {
  zone: GymZonePayload;
  status: MuscleZoneStatus;
  /** Warna isian (status → warna zona / tint idle-terabaikan). */
  fill: string;
  /** Opasitas "samar" (status + bonus definisi seumur hidup). */
  opacity: number;
  /** Puncak pump per intensitas (1.04/1.06). */
  peak: number;
}

export interface MuscleMapProps {
  view: 'front' | 'back';
  visuals: MuscleZoneVisual[];
  /** Urutan zona yang sedang pump (stagger 0.2s per index — Full Body). */
  pumpOrder: MuscleZoneKey[];
  /** Naik tiap trigger supaya animasi diputar ulang (key remount). */
  pumpNonce: number;
  onSelectZone?: (key: MuscleZoneKey) => void;
  /** false = dekoratif (kartu Beranda) — zona tidak interaktif. */
  interactive?: boolean;
  className?: string;
  /** Label a11y untuk seluruh peta. */
  ariaLabel?: string;
}

// ── Bentuk tubuh — ruang 100×185 (viewBox 10 8 80 184) ──────────────────────

type Shape =
  | { kind: 'path'; d: string; mirror?: boolean }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; mirror?: boolean };

const shape = (d: string, mirror = false): Shape => ({ kind: 'path', d, mirror });

/** Transform mirror sumbu x=50 (x → 100−x). */
const MIRROR = 'matrix(-1 0 0 1 100 0)';

// ── Tubuh dasar "render anatomis" (siluet kulit) ────────────────────────────
// Proporsi atletis ala referensi: bahu lebar (x24–76), pinggang ramping
// (x36–64), V-taper. Kepala + leher + torso = bidang tengah; lengan & kaki
// digambar sisi kiri lalu di-mirror.

const HEAD_RX = 10.2;
const HEAD_RY = 11.2;
const HEAD_CY = 25.5;

const HAIR_PATH =
  'M40.6 23.5 C40.9 18.6 44.9 14.4 50 14.4 C55.1 14.4 59.1 18.6 59.4 23.5 C58.5 21.8 57.4 20.5 56 19.6 C53.5 21 46.5 21 44 19.6 C42.6 20.5 41.5 21.8 40.6 23.5 Z';

const NECK_PATH =
  'M44.8 34.5 C44.5 38 43.8 41 42.6 43.8 L57.4 43.8 C56.2 41 55.5 38 55.2 34.5 C53.4 33.4 46.6 33.4 44.8 34.5 Z';

const TORSO_PATH =
  'M42.6 43.8 C38 46.2 32 47.8 28.5 50.5 C25 53 23.2 56.5 23.8 60.5 ' +
  'C24.3 63.5 25.8 66 27.5 68.5 C29.5 74 31.5 80.5 33.5 87 ' +
  'C34.8 91 35.8 95.5 36.4 99.5 C37 104 38.2 108.5 40 111.5 ' +
  'C42.8 114.6 46.5 116.4 50 116.4 C53.5 116.4 57.2 114.6 60 111.5 ' +
  'C61.8 108.5 63 104 63.6 99.5 C64.2 95.5 65.2 91 66.5 87 ' +
  'C68.5 80.5 70.5 74 72.5 68.5 C74.2 66 75.7 63.5 76.2 60.5 ' +
  'C76.8 56.5 75 53 71.5 50.5 C68 47.8 62 46.2 57.4 43.8 Z';

/** Lengan kiri (pose A ±30°): deltoid → bisep → siku → lengan bawah → tangan. */
const ARM_L_PATH =
  'M28.5 51.5 C24.5 53.5 21.8 57.5 20.5 62 C19.2 66.5 18.5 71 18.6 75.5 ' +
  'C18.7 78.5 19.8 81 18.9 84.5 C17.8 87.5 16.2 91 15 94.5 ' +
  'C14.2 97 13.8 99.5 14.3 101.8 C14.6 104 15.8 105.8 17.2 105.6 ' +
  'C18.4 105.4 18.9 103.8 18.6 101.5 C18.2 99.5 18.4 97.5 19.2 95 ' +
  'C20.6 91 22.4 87 23.4 83 C24.2 80 24.4 76.5 24.9 73 ' +
  'C25.8 68.5 27.2 64 28.8 60.5 C29.6 57.5 29.4 54.5 28.5 51.5 Z';

/** Kaki kiri: sweep quad luar → lutut → betis → pergelangan → kaki → adduktor. */
const LEG_L_PATH =
  'M40 111.5 C37.2 113.5 35.2 117.8 34.8 123.5 C34.4 129.5 35.2 135.5 36 140 ' +
  'C36.5 143.5 37.5 146.2 38.2 149 C38.8 152.5 39.6 156.5 39.8 161 ' +
  'C40 165 39.6 168.5 39.2 171.5 C39 173.5 39 175 39.4 176.5 ' +
  'C40.4 179.5 42.6 181.2 44.6 181.2 C45.8 181.2 46.6 180.2 46.6 178.8 ' +
  'L46.2 175.5 C46 172.5 46.2 169.5 46.4 166 C46.6 161.5 46.4 156.5 45.8 152 ' +
  'C45.2 148.5 44.8 145 45 141 C45.4 134 45.6 126 44.8 120 ' +
  'C44.2 116 43.4 113.5 42.5 112 C41.6 111.2 40.8 111 40 111.5 Z';

// ── Line-work definisi otot (goresan di atas kulit, di bawah zona) ──────────

type Line = { d: string; mirror?: boolean };
const line = (d: string, mirror = false): Line => ({ d, mirror });

const FRONT_LINES: Line[] = [
  // Kemiringan leher-trapezius & tulang selangka.
  line('M46.5 45.5 C43 46.8 39.2 48.4 35.8 50.4', true),
  line('M49.2 49.8 C44.2 49.4 38.4 50.6 34 52.8', true),
  // Sternum + garis bawah pektoral.
  line('M50 53.2 C50.1 58 50.1 63 50 67.6'),
  line('M34.2 56.2 C36.6 60.6 40.4 64.2 45.2 66.2 C47.4 67 49 67.4 50 67.6', true),
  // Perut: garis tengah + 3 sayatan six-pack + garis pinggang.
  line('M50 71.5 C49.9 82 49.9 93 50 105.2'),
  line('M42 76.6 C45.5 77.4 54.5 77.4 58 76.6'),
  line('M41 84.6 C45.5 85.5 54.5 85.5 59 84.6'),
  line('M41.4 92.6 C45.5 93.5 54.5 93.5 58.6 92.6'),
  line('M43 100 C45.8 100.8 54.2 100.8 57 100'),
  // Obliques + seratus.
  line('M39.4 78 C39.8 85.5 41 94.5 43.8 102.2', true),
  line('M37 76.2 L39.4 79.6 M36.4 80.6 L38.8 83.6', true),
  // Lengan: puncak bisep + lipatan siku + garis lengan bawah.
  line('M24 61.8 C25.6 65.8 26.3 69.8 26.1 73.8', true),
  line('M22.6 80.2 C23.8 81.4 25.4 81.6 26.6 80.8', true),
  line('M20.4 87.2 C19.4 90.8 18 94.4 16.6 97.6', true),
  // Kaki: sweep vastus luar + teardrop dalam + tutup lutut + split betis.
  line('M36.3 113.8 C35.2 121.2 35.2 129 36.3 136.6', true),
  line('M44.7 119.8 C44.1 126 44.1 132 43.7 138.6', true),
  line('M39.6 144.2 C40.8 145.6 42.6 145.9 44.2 145.1', true),
  line('M38.7 150.8 C39.9 155.2 40.6 160.2 40.3 166.6', true),
  line('M43.5 151.8 C43.1 156.2 42.9 161.2 42.7 166.6', true),
];

const BACK_LINES: Line[] = [
  // Spine + belah ketupat trapezius (atas/tengah/bawah).
  line('M50 44.6 C50 65 50 86 50 106'),
  line('M45.4 44.6 C42 45.8 38.6 47.8 35.9 50.6', true),
  line('M50 61.8 C45.6 60 41.2 56.6 37.6 52.6', true),
  line('M48.6 62 C46.8 67 45.6 71.2 45.2 75.4', true),
  // Sayap latissimus + ujung skapula + dimple pinggang.
  line('M30.6 66.8 C32.6 74.2 34.9 82.6 38.2 90.6 C40.2 95.2 42.6 98.8 45.2 101.4', true),
  line('M37.6 57.8 C40.6 58.8 43 60.2 44.4 62.2', true),
  line('M46.9 104.6 L45.3 107.6', true),
  // Garis bokong + split hamstring ganda.
  line('M39.6 113.6 C43 119 46.6 121.6 50 121.6 C53.4 121.6 57 119 60.4 113.6'),
  line('M39.6 129.6 C39 135 39.2 140 40.2 144.6', true),
  line('M44.7 128.8 C44.4 134 44.4 139.6 44.8 144.6', true),
  // Betis belakang (dua kepala) + garis trisep.
  line('M38.7 150.8 C39.9 155.2 40.6 160.2 40.3 166.6', true),
  line('M43.5 151.8 C43.1 156.2 42.9 161.2 42.7 166.6', true),
  line('M23.2 62 C21.9 66.6 21.3 71.2 21.5 75.8', true),
];

// ── Zona otot interaktif (overlay status di atas kulit) ─────────────────────
// Sisi kiri + mirror; bidang tengah (abs/traps/erector) digambar penuh.

const PEC_L = 'M49.7 51.2 C46 51.2 42.2 52.4 38.8 54.8 C35.6 57.2 33.6 60.4 33.4 63.6 ' +
  'C33.3 66.2 35.2 68.6 38.2 69.4 C41.6 70.3 45.6 69.6 49.7 67.8 Z';
const DELT_L = 'M31 51.4 C26.6 52.8 24 56 23.4 60 C22.9 63.6 24.6 66.6 27.6 67.4 ' +
  'C30.6 68.1 33.4 66.4 34.6 63.2 C35.6 60.2 35.4 55.8 33.6 53.2 C32.7 52 31.9 51.4 31 51.4 Z';
const UPPER_ARM_L = 'M28.2 57.2 C25.2 58.4 22.8 62 21.8 66.8 C21 70.8 20.9 74.4 21.9 77.8 ' +
  'C24.3 78.6 26.6 77.2 27.6 73.8 C28.6 69.6 28.9 63.8 28.5 60 Z';
const FOREARM_L = 'M21.2 82.2 C19.7 85.4 17.7 89.4 16.2 93.4 C15.2 96.2 14.8 99.2 15.8 101.4 ' +
  'C18.2 101.8 19.6 99.4 20.5 95.4 C21.5 91.2 22.5 86.6 23 83.4 Z';
const ABS_REGION = 'M41.2 71 C44.2 68.6 47.2 67.9 50 67.9 C52.8 67.9 55.8 68.6 58.8 71 ' +
  'C60.3 73.9 60.8 77 60.8 80 C60.8 86 59.8 92 58.3 96.9 ' +
  'C56.3 101.9 53.4 104.9 50 104.9 C46.6 104.9 43.7 101.9 41.7 96.9 ' +
  'C40.2 92 39.2 86 39.2 80 C39.2 77 39.7 73.9 41.2 71 Z';
const QUAD_L = 'M36 112.2 C34.6 117.2 33.9 123 34.4 128.8 C34.9 134.8 36 139 36.6 142.6 ' +
  'C39.6 144 43 143.6 45.4 142.2 C46.2 135.8 46.2 127.8 45.4 121 ' +
  'C44.9 116.2 44 112.6 43 110.8 C40.2 110.4 37.6 110.6 36 112.2 Z';
const CALF_L = 'M37.6 147.2 C36.9 152 37.6 157.8 38.6 162.6 C39.4 166.2 40.4 169 41.6 170 ' +
  'C42.9 169.4 43.9 166.4 44.4 162.6 C45.1 157 45.1 151 44.4 147.6 ' +
  'C42 146.8 39.6 146.8 37.6 147.2 Z';

const TRAPS_REGION = 'M50 44.2 C46.4 44.7 42.4 46.6 39 49.6 C36.5 51.9 34.8 54.2 34 56.6 ' +
  'C38 58.6 43 59.9 47.4 60.6 L50 61 L52.6 60.6 C57 59.9 62 58.6 66 56.6 ' +
  'C65.2 54.2 63.5 51.9 61 49.6 C57.6 46.6 53.6 44.7 50 44.2 Z';
const LAT_L = 'M35 60.2 C33.2 66.2 31.8 73.4 32.2 80.4 C32.6 87.2 34.8 92.6 38.2 96.2 ' +
  'C40.6 98.2 43.6 99 46.6 98.6 C48 94 48.8 88 48.5 82 ' +
  'C48.2 76 47.2 70.2 45.6 65.8 C42.2 62.8 38.2 61 35 60.2 Z';
const ERECTOR_REGION = 'M44.2 98.8 C42.8 102.2 42.2 105.6 42.9 109 C44.9 111 47.6 111.9 50 111.9 ' +
  'C52.4 111.9 55.1 111 57.1 109 C57.8 105.6 57.2 102.2 55.8 98.8 ' +
  'C53.8 97.4 51.9 96.8 50 96.8 C48.1 96.8 46.2 97.4 44.2 98.8 Z';
const GLUTE_L = 'M38.6 110.2 C36.6 112.6 35.7 116 36.2 119.8 C37 123.8 39.5 126.6 42.6 126.9 ' +
  'C45.6 127.1 48 125.2 48.5 121.8 C49 117.8 48.3 113.4 46.6 110.8 ' +
  'C44.2 109.5 40.9 109.2 38.6 110.2 Z';
const HAM_L = 'M38.2 128 C36.7 133 36.2 139 37.2 144 C38.7 148.4 41.6 150.4 44.6 149.4 ' +
  'C46.6 148.4 47.3 145 47 140.6 C46.7 136.2 45.7 131.8 44.5 128.8 ' +
  'C42.5 127.7 40 127.7 38.2 128 Z';

const FRONT_ZONES: Partial<Record<MuscleZoneKey, Shape[]>> = {
  // Dada: dua pektoral dengan lekuk sternum (kiri + mirror kanan).
  dada: [shape(PEC_L), shape(PEC_L, true)],
  // Bahu: topi deltoid depan.
  bahu: [shape(DELT_L), shape(DELT_L, true)],
  // Lengan: bisep + lengan bawah (depan).
  lengan: [shape(UPPER_ARM_L), shape(UPPER_ARM_L, true), shape(FOREARM_L), shape(FOREARM_L, true)],
  // Perut: blok six-pack + obliques.
  perut: [shape(ABS_REGION)],
  // Kaki: quad + betis.
  kaki: [shape(QUAD_L), shape(QUAD_L, true), shape(CALF_L), shape(CALF_L, true)],
};

const BACK_ZONES: Partial<Record<MuscleZoneKey, Shape[]>> = {
  // Punggung: trapezius (tengah) + sayap latissimus (kiri + mirror) + erector lumbal.
  punggung: [shape(TRAPS_REGION), shape(LAT_L), shape(LAT_L, true), shape(ERECTOR_REGION)],
  // Bahu: deltoid belakang.
  bahu: [shape(DELT_L), shape(DELT_L, true)],
  // Lengan: trisep (area lengan atas belakang) + lengan bawah.
  lengan: [shape(UPPER_ARM_L), shape(UPPER_ARM_L, true), shape(FOREARM_L), shape(FOREARM_L, true)],
  // Kaki: bokong + hamstring + betis.
  kaki: [shape(GLUTE_L), shape(GLUTE_L, true), shape(HAM_L), shape(HAM_L, true), shape(CALF_L), shape(CALF_L, true)],
};

function ShapeNode({ s, i }: { s: Shape; i: number }) {
  if (s.kind === 'ellipse') {
    const cx = s.mirror ? 100 - s.cx : s.cx;
    return <ellipse key={i} cx={cx} cy={s.cy} rx={s.rx} ry={s.ry} className="mm-shape" />;
  }
  return <path key={i} d={s.d} transform={s.mirror ? MIRROR : undefined} className="mm-shape" />;
}

export function MuscleMap({
  view,
  visuals,
  pumpOrder,
  pumpNonce,
  onSelectZone,
  interactive = true,
  className,
  ariaLabel,
}: MuscleMapProps) {
  const zoneShapes = view === 'front' ? FRONT_ZONES : BACK_ZONES;
  const lines = view === 'front' ? FRONT_LINES : BACK_LINES;
  const pumpIndex = new Map<MuscleZoneKey, number>();
  pumpOrder.forEach((k, i) => pumpIndex.set(k, i));

  return (
    <svg
      viewBox="10 8 80 184"
      className={cn('h-auto w-full select-none', className)}
      role="img"
      aria-label={ariaLabel ?? 'Peta otot — siluet tubuh dengan status zona'}
    >
      <defs>
        {/* Badan "render" gelap ala GymWP: charcoal ber-gradasi (cahaya
            studio atas, makin gelap ke bawah) — zona warna menyala
            kontras di atasnya (Opsi A). */}
        <linearGradient id="mmSkinTorso" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5a636c" />
          <stop offset="45%" stopColor="#3d444c" />
          <stop offset="100%" stopColor="#272c31" />
        </linearGradient>
        <linearGradient id="mmSkinLimb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#525a62" />
          <stop offset="100%" stopColor="#23272b" />
        </linearGradient>
        {/* Kepala: radial dengan highlight dahi kiri-atas. */}
        <radialGradient id="mmHead" cx="0.38" cy="0.32" r="0.9">
          <stop offset="0%" stopColor="#666f78" />
          <stop offset="100%" stopColor="#3d444c" />
        </radialGradient>
        {/* Sheen studio dingin: rim-light atas-biru, bayangan bawah —
            memberi kesan "3D render" pada badan gelap. */}
        <linearGradient id="mmSheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(185,212,240,0.22)" />
          <stop offset="28%" stopColor="rgba(185,212,240,0.07)" />
          <stop offset="55%" stopColor="rgba(185,212,240,0.02)" />
          <stop offset="82%" stopColor="rgba(8,12,16,0.14)" />
          <stop offset="100%" stopColor="rgba(8,12,16,0.26)" />
        </linearGradient>
        <clipPath id="mmBodyClip">
          <ellipse cx={50} cy={HEAD_CY} rx={HEAD_RX} ry={HEAD_RY} />
          <path d={TORSO_PATH} />
          <path d={ARM_L_PATH} />
          <path d={ARM_L_PATH} transform={MIRROR} />
          <path d={LEG_L_PATH} />
          <path d={LEG_L_PATH} transform={MIRROR} />
        </clipPath>
      </defs>

      {/* Bayangan lantai — figure "berdiri" (grounding 3D). */}
      <ellipse cx={50} cy={183.5} rx={25} ry={2.8} fill="rgba(0,0,0,0.38)" aria-hidden="true" />

      {/* Tubuh dasar: siluet gelap "render" charcoal (Task 69 — Opsi A). */}
      <g className="mm-base" aria-hidden="true">
        <ellipse cx={50} cy={HEAD_CY} rx={HEAD_RX} ry={HEAD_RY} fill="url(#mmHead)" />
        <path d={HAIR_PATH} fill="#1c2024" stroke="none" />
        <ellipse cx={40.3} cy={27} rx={1.5} ry={2.1} fill="#454c53" stroke="none" />
        <ellipse cx={59.7} cy={27} rx={1.5} ry={2.1} fill="#454c53" stroke="none" />
        <path d={NECK_PATH} fill="url(#mmSkinTorso)" />
        <path d={TORSO_PATH} fill="url(#mmSkinTorso)" />
        <path d={ARM_L_PATH} fill="url(#mmSkinLimb)" />
        <path d={LEG_L_PATH} fill="url(#mmSkinLimb)" />
        <g transform={MIRROR}>
          <path d={ARM_L_PATH} fill="url(#mmSkinLimb)" />
          <path d={LEG_L_PATH} fill="url(#mmSkinLimb)" />
        </g>
        {/* Sheen volumetrik di atas tubuh (klip siluet). */}
        <rect x={10} y={8} width={80} height={184} fill="url(#mmSheen)" clipPath="url(#mmBodyClip)" stroke="none" />
      </g>

      {/* Line-work definisi otot per pandangan. */}
      <g className="mm-lines" aria-hidden="true">
        {lines.map((l, i) => (
          <path key={i} d={l.d} transform={l.mirror ? MIRROR : undefined} />
        ))}
      </g>

      {/* Zona aktif sesuai pandangan (overlay warna status di atas kulit). */}
      {visuals.map(({ zone, status, fill, opacity, peak }) => {
        const shapes = zoneShapes[zone.key];
        if (!shapes || shapes.length === 0) return null;
        const pumping = pumpIndex.has(zone.key);
        const meta = ZONE_STATUS_META[status];
        const glowColor =
          status === 'balanced' ? 'rgba(100,229,155,0.6)' : `rgba(28,152,255,0.65)`;
        const aria = interactive
          ? `Zona ${zone.label}: ${meta.label.toLowerCase()}, ${zone.sessionsThisWeek} dari ${zone.weeklyTarget} sesi minggu ini`
          : `Zona ${zone.label}: ${meta.label.toLowerCase()}`;
        return (
          <g
            key={zone.key}
            className={cn(
              'mm-zone',
              status === 'pump' && 'mm-zone-breathe mm-zone-fresh',
              status === 'active' && 'mm-zone-hot',
              status === 'recovery' && 'mm-zone-hot mm-zone-hot-soft',
              status === 'balanced' && 'mm-zone-balanced',
              pumping && 'mm-zone-pump',
              !interactive && 'pointer-events-none',
            )}
            style={{
              '--mm-fill': fill,
              '--mm-opacity': opacity,
              '--mm-peak': peak,
              '--mm-stagger': `${(pumpIndex.get(zone.key) ?? 0) * 0.2}s`,
              '--mm-glow': glowColor,
            } as React.CSSProperties}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={aria}
            onClick={interactive ? () => onSelectZone?.(zone.key) : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectZone?.(zone.key);
                    }
                  }
                : undefined
            }
          >
            {/* key remount → animasi pump diputar ulang tiap nonce. */}
            <g key={`${zone.key}-${pumping ? pumpNonce : 'static'}`} className="mm-anim">
              {shapes.map((s, i) => (
                <ShapeNode key={i} s={s} i={i} />
              ))}
            </g>
          </g>
        );
      })}
    </svg>
  );
}
