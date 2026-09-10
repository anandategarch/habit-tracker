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

/**
 * TreeGrow — Opsi A "Pohon Ilustrasi Premium" (Task 28).
 *
 * Pohon flat-vector 3 lapis tajuk (gradien teal→emerald) + batang + gundukan
 * tanah + glow bernapas + daun melayang. Desain mengikuti riset UX Task 27:
 * - Durasi animasi moderat (siklus 4-5 detik) — "sweet spot" riset Stanford.
 * - Progress ring MENGAKSELERASI (ease-in) — terasa lebih cepat (riset CMU).
 * - Sway lembut ±1.5° — sinyal "hidup" tanpa mengganggu.
 *
 * Varian:
 * - 'splash' : sekuens tumbuh sekali jalan (mound → batang → 3 tajuk mekar
 *   bertahap → daun melayang) + progress ring. Untuk layar pembuka.
 * - 'inline' : pohon langsung tampil UTUH (tanpa sekuens tumbuh, tanpa ring)
 *   + sway. Untuk tab-loading yang bisa selesai dalam ~300ms — sekuens tumbuh
 *   yang terpotong di tengah justru terlihat rusak.
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

        {/* Glow lembut di belakang pohon — "bernapas" */}
        <circle className="tree-glow" cx="100" cy="95" r="80" fill="url(#tree-glow-grad)" />

        {/* Gundukan tanah + rumput */}
        <g className="tree-mound">
          <ellipse className="tree-mound-fill" cx="100" cy="171" rx="50" ry="11" />
          <path className="tree-grass" d="M64 167 C63 162 61 160 58 158" />
          <path className="tree-grass" d="M136 167 C137 162 139 160 142 158" />
        </g>

        {/* Grup sway: batang + tajuk bergoyang bersama dari pangkal */}
        <g className="tree-sway">
          <path
            className="tree-trunk"
            d="M100 169 C 97.5 146, 96.5 132, 100.5 117"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Tajuk lapis 1 (paling bawah, paling gelap) */}
          <path
            className="tree-blob-btm"
            d="M50 116 C50 92 66 74 92 74 C96 74 104 74 108 74 C134 74 150 92 150 116 C150 122 145 126 139 126 L61 126 C55 126 50 122 50 116 Z"
          />
          {/* Tajuk lapis 2 */}
          <path
            className="tree-blob-mid"
            d="M63 96 C63 76 76 60 98 60 C101 60 107 60 110 60 C132 60 141 78 141 96 C141 102 136 106 130 106 L74 106 C68 106 63 102 63 96 Z"
          />
          {/* Tajuk lapis 3 (puncak, paling terang) + titik highlight */}
          <g className="tree-top">
            <path
              className="tree-blob-top"
              d="M72 64 C72 48 82 36 100 36 C118 36 128 48 128 64 C128 70 124 74 118 74 L82 74 C76 74 72 70 72 64 Z"
            />
            <circle className="tree-dot" cx="88" cy="52" r="3" />
            <circle className="tree-dot" cx="106" cy="60" r="2.5" />
            <circle className="tree-dot" cx="96" cy="44" r="2" />
          </g>
        </g>

        {/* Daun melayang — tiap daun di posisikan lewat translate statis parent,
            animasi drift jalan di path anak (transform lokal di sekitar 0,0). */}
        <g transform="translate(30 84)">
          <path className="tree-leaf tree-leaf-f1" d="M0 6 C5 2 5 -4 0 -7 C-5 -4 -5 2 0 6 Z" />
        </g>
        <g transform="translate(166 70)">
          <path className="tree-leaf tree-leaf-f2" d="M0 6 C5 2 5 -4 0 -7 C-5 -4 -5 2 0 6 Z" />
        </g>
        <g transform="translate(140 26)">
          <path className="tree-leaf tree-leaf-f3" d="M0 6 C5 2 5 -4 0 -7 C-5 -4 -5 2 0 6 Z" />
        </g>
      </svg>
    </div>
  );
}

/** Baris skeleton generik. */
export function SkeletonRow({ className }: { className?: string }) {
  return <div className={cn('h-14 animate-pulse rounded-xl bg-muted/60', className)} />;
}
