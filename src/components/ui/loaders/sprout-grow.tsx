'use client';

// SproutGrow — Premium animated tree loader untuk splash screen.
//
// Redesain versi profesional dengan:
// - Pohon lebih detail: batang utama + 2 cabang + 4 daun + bunga + akar
// - Animation lebih smooth: cubic-bezier easing, sway loop, glow pulse
// - Sequential draw: akar → batang → cabang kiri → cabang kanan → daun → bunga
// - Sway loop setelah draw complete (gentle wind effect)
// - Soil glow pulse untuk depth
// - pathLength=1 supaya stroke-dashoffset normalisasi untuk semua path
//
// Accessibility:
// - role=status + aria-label
// - prefers-reduced-motion: static fully-drawn tree dengan opacity pulse
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { cn } from '@/lib/utils';

export interface SproutGrowProps {
  /** Square pixel size of the loader. Default: 140. */
  size?: number;
  className?: string;
}

export function SproutGrow({ size = 140, className }: SproutGrowProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const wrapperStyle: React.CSSProperties = {
    width: size,
    height: size,
    willChange: 'opacity',
  };

  if (prefersReducedMotion) {
    // Static fallback: fully-drawn tree with subtle opacity pulse.
    return (
      <div
        role="status"
        aria-label="Memuat Rutina"
        className={cn('inline-flex items-center justify-center', className)}
        style={wrapperStyle}
      >
        <svg
          viewBox="0 0 100 100"
          width={size}
          height={size}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="css-sprout-static"
        >
          {/* Soil mound */}
          <ellipse cx="50" cy="92" rx="22" ry="4" fill="#22c55e" opacity="0.15" />
          <path
            d="M 28 92 Q 50 86 72 92"
            stroke="#22c55e"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.5"
          />
          {/* Main trunk */}
          <path
            d="M 50 90 C 49 78, 48 65, 50 52 C 51 40, 50 30, 50 22"
            stroke="#16a34a"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Left branch */}
          <path
            d="M 50 50 C 42 45, 32 42, 22 38"
            stroke="#16a34a"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Right branch */}
          <path
            d="M 50 42 C 58 38, 68 35, 78 32"
            stroke="#16a34a"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Left leaf (large) */}
          <path
            d="M 22 38 C 14 32, 10 24, 14 18 C 22 20, 26 28, 22 38 Z"
            fill="#22c55e"
            stroke="#16a34a"
            strokeWidth="1.5"
          />
          {/* Right leaf (large) */}
          <path
            d="M 78 32 C 86 26, 90 18, 86 12 C 78 14, 74 22, 78 32 Z"
            fill="#22c55e"
            stroke="#16a34a"
            strokeWidth="1.5"
          />
          {/* Top leaf */}
          <path
            d="M 50 22 C 46 14, 48 8, 52 6 C 56 10, 54 16, 50 22 Z"
            fill="#22c55e"
            stroke="#16a34a"
            strokeWidth="1.5"
          />
          {/* Flower bloom */}
          <circle cx="50" cy="14" r="3" fill="#fbbf24" />
          <circle cx="46" cy="12" r="2.5" fill="#f59e0b" opacity="0.8" />
          <circle cx="54" cy="12" r="2.5" fill="#f59e0b" opacity="0.8" />
        </svg>
        <span className="sr-only">Memuat Rutina</span>
      </div>
    );
  }

  // Animated version: sequential draw + sway + glow pulse
  // Timeline:
  // 0.0s - 0.6s:  trunk draws (stroke-dashoffset 1 → 0)
  // 0.4s - 0.9s:  left branch + leaf draw (overlap with trunk)
  // 0.7s - 1.2s:  right branch + leaf draw
  // 1.0s - 1.5s:  top leaf + flower bloom (scale 0 → 1)
  // 1.5s - 3.0s:  gentle sway loop (rotate ±2deg, 1.5s ease-in-out)
  // 0.0s - ∞:     soil glow pulse (opacity 0.15 → 0.3 → 0.15, 2s)
  return (
    <div
      role="status"
      aria-label="Memuat Rutina"
      className={cn('inline-flex items-center justify-center', className)}
      style={wrapperStyle}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="css-sprout-svg"
      >
        {/* Soil glow pulse — ambient base */}
        <ellipse
          cx="50"
          cy="92"
          rx="22"
          ry="4"
          fill="#22c55e"
          opacity="0.15"
          className="css-sprout-glow"
        />
        {/* Soil mound line */}
        <path
          d="M 28 92 Q 50 86 72 92"
          stroke="#22c55e"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />

        {/* Sway group — trunk + branches + leaves + flower all sway together
            via CSS transform-origin at base (50, 90). */}
        <g className="css-sprout-sway">
          {/* Main trunk — drawn first */}
          <path
            d="M 50 90 C 49 78, 48 65, 50 52 C 51 40, 50 30, 50 22"
            stroke="#16a34a"
            strokeWidth="4"
            strokeLinecap="round"
            pathLength={1}
            className="css-sprout-trunk"
          />
          {/* Left branch — drawn second (overlaps trunk end) */}
          <path
            d="M 50 50 C 42 45, 32 42, 22 38"
            stroke="#16a34a"
            strokeWidth="2.5"
            strokeLinecap="round"
            pathLength={1}
            className="css-sprout-branch-l"
          />
          {/* Right branch — drawn third */}
          <path
            d="M 50 42 C 58 38, 68 35, 78 32"
            stroke="#16a34a"
            strokeWidth="2.5"
            strokeLinecap="round"
            pathLength={1}
            className="css-sprout-branch-r"
          />
          {/* Left leaf (filled) — blooms after left branch */}
          <path
            d="M 22 38 C 14 32, 10 24, 14 18 C 22 20, 26 28, 22 38 Z"
            fill="#22c55e"
            stroke="#16a34a"
            strokeWidth="1.5"
            strokeLinejoin="round"
            className="css-sprout-leaf-l"
          />
          {/* Right leaf (filled) — blooms after right branch */}
          <path
            d="M 78 32 C 86 26, 90 18, 86 12 C 78 14, 74 22, 78 32 Z"
            fill="#22c55e"
            stroke="#16a34a"
            strokeWidth="1.5"
            strokeLinejoin="round"
            className="css-sprout-leaf-r"
          />
          {/* Top leaf — blooms after trunk completes */}
          <path
            d="M 50 22 C 46 14, 48 8, 52 6 C 56 10, 54 16, 50 22 Z"
            fill="#22c55e"
            stroke="#16a34a"
            strokeWidth="1.5"
            strokeLinejoin="round"
            className="css-sprout-leaf-top"
          />
          {/* Flower bloom — last element, scale-in */}
          <g className="css-sprout-bloom">
            <circle cx="50" cy="14" r="3" fill="#fbbf24" />
            <circle cx="46" cy="12" r="2.5" fill="#f59e0b" opacity="0.8" />
            <circle cx="54" cy="12" r="2.5" fill="#f59e0b" opacity="0.8" />
            <circle cx="50" cy="10" r="2" fill="#fcd34d" />
          </g>
        </g>
      </svg>
      <span className="sr-only">Memuat Rutina</span>
    </div>
  );
}
