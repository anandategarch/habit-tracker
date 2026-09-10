'use client';

import { cn } from '@/lib/utils';

/** Loader "sprout" legacy — dipertahankan untuk kompatibilitas (tidak dipakai
 *  di page.tsx sejak Task 28; TreeGrow menggantikannya). */
export function SproutGrow({ className, size = 64 }: { className?: string; size?: number }) {
  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Memuat"
    >
      <div className="absolute inset-0 animate-ping rounded-full bg-primary/10" />
      <svg viewBox="0 0 24 24" className="text-primary" style={{ width: size * 0.62, height: size * 0.62 }} aria-hidden="true">
        <path
          d="M12 22V12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M12 12c0-4-3-6-7-6 0 4 3 6 7 6z"
          className="origin-bottom animate-pulse"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          fill="currentColor"
          fillOpacity="0.15"
        />
        <path
          d="M12 10c0-3.5 2.6-5 6-5 0 3.5-2.6 5-6 5z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          fill="currentColor"
          fillOpacity="0.15"
        />
      </svg>
    </div>
  );
}

/** Path daun — basis di (0,0), ujung di (0,-13). Dipakai kipas daun di
 *  ujung ranting dan daun melayang. */
const TREE_LEAF_D = 'M0 0 C4.5 -3.5 4.5 -9 0 -13 C-4.5 -9 -4.5 -3.5 0 0 Z';

/** Kipas 3 daun yang mekar dari ujung ranting (scale 0→1, spring).
 *  Struktur 2 lapis <g>: outer = translate/scale statis (SVG transform
 *  attribute), inner = kelas animasi (CSS transform). Kenapa dipisah?
 *  CSS property `transform` MENIMPA transform attribute SVG pada elemen
 *  yang sama — kalau digabung, animasi scale akan menghapus translate/scale
 *  statisnya (pelajaran desain Task 28 v2). */
function LeafFan({ x, y, scale = 1, cls }: { x: number; y: number; scale?: number; cls: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g className={`tree-leaves ${cls}`}>
        <path className="tree-leafp tree-leafp-a" transform="rotate(-40)" d={TREE_LEAF_D} />
        <path className="tree-leafp tree-leafp-b" d={TREE_LEAF_D} />
        <path className="tree-leafp tree-leafp-c" transform="rotate(40)" d={TREE_LEAF_D} />
      </g>
    </g>
  );
}

/** Daun tunggal kecil di tengah ranting — mengisi siluet supaya pohon
 *  terlihat rimbun tanpa menutupi struktur cabang. */
function StemLeaf({ x, y, rotate = 0, scale = 1, cls }: { x: number; y: number; rotate?: number; scale?: number; cls: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g className={`tree-leaves ${cls}`}>
        <path className="tree-leafp tree-leafp-b" transform={`rotate(${rotate})`} d={TREE_LEAF_D} />
      </g>
    </g>
  );
}

/**
 * TreeGrow v2 — Opsi A "Root-to-Leaf Growth" (Task 28, revisi user).
 *
 * Pohon organic yang benar-benar TUMBUH berurutan, seperti ilustrasi
 * professional: garis tanah → AKAR menggaris ke bawah → batang naik →
 * 5 ranting bercabang → 7 kipas daun mekar di ujung ranting + glow
 * bernapas + daun melayang. Struktur cabang terlihat (bukan blob tajuk).
 *
 * Prinsip riset UX Task 27 yang dipertahankan:
 * - Progress ring MENGAKSELERASI (ease-in) — terasa lebih cepat (riset CMU).
 * - Sway lembut ±1.5° dari pangkal — akar TIDAK ikut goyang (realistis).
 * - Total sekuens ~1.5s — sinkron dengan splash exit 1.6s.
 *
 * Varian:
 * - 'splash' : sekuens tumbuh sekali jalan (ground → akar → batang →
 *   ranting → daun) + progress ring. Untuk layar pembuka.
 * - 'inline' : pohon langsung tampil UTUH (tanpa sekuens tumbuh, tanpa
 *   ring) + sway. Untuk tab-loading yang bisa selesai dalam ~300ms —
 *   sekuens tumbuh yang terpotong di tengah justru terlihat rusak.
 *
 * Warna lewat kelas CSS (globals.css) supaya adaptif light/dark mode.
 * Semua animasi dimatikan oleh prefers-reduced-motion (rule global).
 */
export function TreeGrow({
  className,
  size = 84,
  variant = 'inline',
  ring = false,
}: {
  className?: string;
  size?: number;
  variant?: 'splash' | 'inline';
  /** Tampilkan progress ring yang mengakselerasi (hanya bermakna di varian splash). */
  ring?: boolean;
}) {
  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Memuat"
    >
      <svg
        viewBox="0 0 200 200"
        className={cn('css-tree-svg h-full w-full', variant === 'inline' && 'tree-instant')}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="tree-glow-grad" cx="50%" cy="50%" r="50%">
            {/* TASK-28 FIX: stop-color harus via CSS class — presentation
                attribute tidak mendukung var(), dan var(--primary) di app ini
                adalah warna oklch() penuh (bukan triplet HSL) sehingga
                hsl(var(--primary)) invalid → warna jatuh ke hitam. */}
            <stop className="tree-glow-stop-a" offset="0%" />
            <stop className="tree-glow-stop-b" offset="100%" />
          </radialGradient>
        </defs>

        {/* Progress ring — mulai dari pukul 12, arc mengakselerasi penuh 1 putaran */}
        {ring && (
          <g transform="rotate(-90 100 100)">
            <circle className="tree-ring-track" cx="100" cy="100" r="88" fill="none" strokeWidth="3" />
            <circle
              className="tree-ring-arc"
              cx="100"
              cy="100"
              r="88"
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Glow lembut di belakang tajuk — "bernapas" */}
        <circle className="tree-glow" cx="100" cy="88" r="62" fill="url(#tree-glow-grad)" />

        {/* Garis tanah — panggung sebelum tumbuh (akar tumbuh DI BAWAHNYA) */}
        <path className="tree-ground" d="M36 150 H164" pathLength={1} />

        {/* Gundukan tanah di pangkal */}
        <ellipse className="tree-mound" cx="100" cy="150" rx="32" ry="7" />

        {/* Akar — 4 garis menggaris ke bawah tanah (stagger kiri→kanan→dalam) */}
        <g>
          <path className="tree-root tree-root-1" d="M100 150 C92 156 80 160 64 159" pathLength={1} />
          <path className="tree-root tree-root-2" d="M100 150 C108 156 120 160 136 159" pathLength={1} />
          <path className="tree-root tree-root-3" d="M100 150 C97 161 96 169 95 178" pathLength={1} />
          <path className="tree-root tree-root-4" d="M100 150 C104 162 110 168 119 175" pathLength={1} />
        </g>

        {/* Grup sway: batang + ranting + daun bergoyang dari pangkal
            (akar & tanah DI LUAR grup — akar tidak ikut goyang). */}
        <g className="tree-sway">
          {/* Batang */}
          <path className="tree-trunk" d="M100 150 C99.5 135 99 122 100 108" pathLength={1} />
          {/* Ranting: leader tengah + 2 cabang samping panjang + 2 diagonal */}
          <path className="tree-branch tree-branch-c" d="M100 108 C99 98 101 90 100 79" pathLength={1} />
          <path className="tree-branch tree-branch-l1" d="M100 108 C91 101 79 99 66 97" pathLength={1} />
          <path className="tree-branch tree-branch-r1" d="M100 108 C109 101 121 99 134 97" pathLength={1} />
          <path className="tree-branch tree-branch-l2" d="M100 108 C96 100 89 94 82 86" pathLength={1} />
          <path className="tree-branch tree-branch-r2" d="M100 108 C104 100 111 94 118 86" pathLength={1} />

          {/* Kipas daun di ujung ranting — mekar tengah→luar */}
          <LeafFan x={100} y={79} scale={1.05} cls="tree-leaves-c" />
          <LeafFan x={82} y={86} scale={0.82} cls="tree-leaves-l2" />
          <LeafFan x={118} y={86} scale={0.82} cls="tree-leaves-r2" />
          <LeafFan x={66} y={97} scale={0.88} cls="tree-leaves-l1" />
          <LeafFan x={134} y={97} scale={0.88} cls="tree-leaves-r1" />
          {/* Daun pengisi di tengah cabang */}
          <StemLeaf x={92} y={98} rotate={-18} scale={0.6} cls="tree-leaves-m1" />
          <StemLeaf x={108} y={98} rotate={18} scale={0.6} cls="tree-leaves-m2" />
        </g>

        {/* Daun melayang — tiap daun diposisikan lewat translate statis parent,
            animasi drift jalan di path anak (transform lokal di sekitar 0,0). */}
        <g transform="translate(24 92)">
          <path className="tree-leaf tree-leaf-f1" d={TREE_LEAF_D} />
        </g>
        <g transform="translate(176 82)">
          <path className="tree-leaf tree-leaf-f2" d={TREE_LEAF_D} />
        </g>
        <g transform="translate(146 24)">
          <path className="tree-leaf tree-leaf-f3" d={TREE_LEAF_D} />
        </g>
      </svg>
    </div>
  );
}

/** Baris skeleton generik. */
export function SkeletonRow({ className }: { className?: string }) {
  return <div className={cn('h-14 animate-pulse rounded-xl bg-muted/60', className)} />;
}
