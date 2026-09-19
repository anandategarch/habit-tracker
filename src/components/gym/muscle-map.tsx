'use client';

// ---------------------------------------------------------------------------
// src/components/gym/muscle-map.tsx — siluet tubuh Peta Otot (Task 64).
//
// Inline SVG buatan tangan (bentuk diambil dari aset desain user,
// upload/peta-otot/ panel 01/02) supaya TIAP zona bisa dianimasikan
// sendiri (pump/napas/balanced) — hal yang mustahil pada gambar statis.
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

// ── Bentuk tubuh (koordinat aset user, ruang 100×185) ───────────────────────

type Shape =
  | { kind: 'path'; d: string }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number };

const shape = (kind: 'path', d: string): Shape => ({ kind, d });
const ell = (cx: number, cy: number, rx: number, ry: number): Shape => ({ kind: 'ellipse', cx, cy, rx, ry });

/** Siluet dasar (kepala + batang + tangan + kaki) — aset panel 01. */
const BODY_PATH =
  'M41 45 Q50 41 59 45 L63 58 L82 66 Q86 68 84 77 L72 101 L68 96 L61 78 L61 118 L75 150 L69 161 L57 126 L50 132 L43 126 L31 161 L25 150 L39 118 L39 78 L32 96 L28 101 L16 77 Q14 68 18 66 L37 58 Z';

const FRONT_ZONES: Partial<Record<MuscleZoneKey, Shape[]>> = {
  // Dada: dua pektoral (aset 01).
  dada: [ell(42, 67, 11, 8), ell(58, 67, 11, 8)],
  // Bahu: deltoid depan.
  bahu: [ell(30, 68, 6.5, 5.5), ell(70, 68, 6.5, 5.5)],
  // Lengan: lengan atas depan (aset 01, path samping).
  lengan: [
    shape('path', 'M29 66 Q22 70 18 80 L27 90 L35 76 Z'),
    shape('path', 'M71 66 Q78 70 82 80 L73 90 L65 76 Z'),
  ],
  // Perut: abs (aset 01).
  perut: [shape('path', 'M45 77 Q50 71 55 77 L58 96 Q50 103 42 96 Z')],
  // Kaki: quad + betis (aset 01).
  kaki: [
    shape('path', 'M38 103 L49 108 L45 148 L37 149 L33 118 Z'),
    shape('path', 'M62 103 L51 108 L55 148 L63 149 L67 118 Z'),
    shape('path', 'M42 148 L37 171 L31 179 L36 183 L44 173 L49 151 Z'),
    shape('path', 'M58 148 L63 171 L69 179 L64 183 L56 173 L51 151 Z'),
  ],
};

const BACK_ZONES: Partial<Record<MuscleZoneKey, Shape[]>> = {
  // Punggung: trapezius + latissimus (2 sisi) + lower back (aset 02).
  punggung: [
    shape('path', 'M38 61 Q50 54 62 61 L69 75 L58 85 L50 76 L42 85 L31 75 Z'),
    shape('path', 'M31 76 L18 68 L27 93 L40 98 L44 84 Z'),
    shape('path', 'M69 76 L82 68 L73 93 L60 98 L56 84 Z'),
    shape('path', 'M43 95 L50 88 L57 95 L60 118 L50 125 L40 118 Z'),
  ],
  bahu: [ell(30, 68, 6.5, 5.5), ell(70, 68, 6.5, 5.5)],
  lengan: [
    shape('path', 'M29 66 Q22 70 18 80 L27 90 L35 76 Z'),
    shape('path', 'M71 66 Q78 70 82 80 L73 90 L65 76 Z'),
  ],
  // Kaki: hamstring (bayangan quad) + betis.
  kaki: [
    shape('path', 'M38 103 L49 108 L45 148 L37 149 L33 118 Z'),
    shape('path', 'M62 103 L51 108 L55 148 L63 149 L67 118 Z'),
    shape('path', 'M42 148 L37 171 L31 179 L36 183 L44 173 L49 151 Z'),
    shape('path', 'M58 148 L63 171 L69 179 L64 183 L56 173 L51 151 Z'),
  ],
};

function ShapeNode({ s, i }: { s: Shape; i: number }) {
  if (s.kind === 'ellipse') {
    return <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} className="mm-shape" />;
  }
  return <path key={i} d={s.d} className="mm-shape" />;
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
  const pumpIndex = new Map<MuscleZoneKey, number>();
  pumpOrder.forEach((k, i) => pumpIndex.set(k, i));

  return (
    <svg
      viewBox="10 8 80 184"
      className={cn('h-auto w-full select-none', className)}
      role="img"
      aria-label={ariaLabel ?? 'Peta otot — siluet tubuh dengan status zona'}
    >
      {/* Siluet dasar (samar, abu-abu aset). */}
      <circle cx={50} cy={30} r={13} fill="#9aa5af" opacity={0.92} />
      <path d={BODY_PATH} fill="#697581" opacity={0.96} />

      {/* Zona aktif sesuai pandangan. */}
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
