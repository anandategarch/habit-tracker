'use client';

// SproutGrow — Premium animated sprout loader (Opsi B: Sprout + Leaf Detail)
//
// Match dengan logo Rutina:
// - Single S-curved stem (match logo "S" curve)
// - 2 oval leaves (left wider, right narrower — match logo)
// - Subtle vein lines on leaves (detail for visual interest)
// - Small bud at stem peak (bonus delight)
// - Rounded rectangle soil base (match logo)
// - 2-tone green (#22c55e leaves + #16a34a stem/veins for depth)
// - No flowers (logo tidak punya bunga)
//
// Animation (smooth, match flat logo style):
// - Stem grow dari base ke atas (S-curve draw)
// - 2 daun bloom sequential (scale 0 → 1, bounce easeOutBack)
// - Vein lines draw di daun (stroke-dashoffset)
// - Small bud pop di puncak (scale 0 → 1)
// - Gentle sway loop (±1.5deg, wind effect)
// - Soil glow pulse (opacity)
//
// Accessibility:
// - role=status + aria-label
// - prefers-reduced-motion: static fully-drawn sprout + opacity pulse
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
    // Static fallback: fully-drawn sprout with subtle opacity pulse.
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
          {/* Soil base — rounded rectangle (match logo) */}
          <rect x="28" y="88" width="44" height="8" rx="4" fill="#22c55e" opacity="0.2" />
          <rect x="28" y="88" width="44" height="6" rx="3" fill="#16a34a" opacity="0.4" />
          {/* S-curved stem (match logo "S" shape) */}
          <path
            d="M 50 88 C 46 75, 54 62, 50 48 C 46 35, 52 25, 50 18"
            stroke="#16a34a"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Left leaf (wider, oval) */}
          <ellipse cx="38" cy="42" rx="14" ry="8" fill="#22c55e" stroke="#16a34a" strokeWidth="1.5" transform="rotate(-15 38 42)" />
          {/* Vein line left */}
          <path d="M 26 42 Q 38 40, 50 44" stroke="#16a34a" strokeWidth="1" opacity="0.5" />
          {/* Right leaf (narrower, oval) */}
          <ellipse cx="60" cy="30" rx="11" ry="7" fill="#22c55e" stroke="#16a34a" strokeWidth="1.5" transform="rotate(20 60 30)" />
          {/* Vein line right */}
          <path d="M 50 30 Q 60 28, 70 32" stroke="#16a34a" strokeWidth="1" opacity="0.5" />
          {/* Small bud at stem peak */}
          <circle cx="50" cy="14" r="4" fill="#22c55e" stroke="#16a34a" strokeWidth="1.5" />
        </svg>
        <span className="sr-only">Memuat Rutina</span>
      </div>
    );
  }

  // Animated version: sequential draw + sway + glow pulse
  // Timeline (4s loop):
  // 0.0s - 0.6s:  stem draws (S-curve grow)
  // 0.5s - 1.0s:  left leaf blooms (scale 0 → 1.1 → 1, bounce)
  // 0.7s - 1.2s:  right leaf blooms (stagger 0.2s)
  // 1.0s - 1.4s:  vein lines draw di daun
  // 1.2s - 1.6s:  bud pop at peak (scale 0 → 1.2 → 1)
  // 1.6s - 4.0s:  gentle sway loop (±1.5deg, wind)
  // 0.0s - ∞:     soil glow pulse
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
        {/* Soil base — rounded rectangle (match logo) */}
        <rect
          x="28"
          y="88"
          width="44"
          height="8"
          rx="4"
          fill="#22c55e"
          opacity="0.15"
          className="css-sprout-glow"
        />
        <rect x="28" y="88" width="44" height="6" rx="3" fill="#16a34a" opacity="0.4" />

        {/* Sway group — stem + leaves + bud all sway together via CSS
            transform-origin at base (50, 88). */}
        <g className="css-sprout-sway">
          {/* S-curved stem (match logo "S" shape) — drawn first */}
          <path
            d="M 50 88 C 46 75, 54 62, 50 48 C 46 35, 52 25, 50 18"
            stroke="#16a34a"
            strokeWidth="3.5"
            strokeLinecap="round"
            pathLength={1}
            className="css-sprout-stem"
          />
          {/* Left leaf (wider, oval) — blooms after stem */}
          <g className="css-sprout-leaf-l">
            <ellipse
              cx="38"
              cy="42"
              rx="14"
              ry="8"
              fill="#22c55e"
              stroke="#16a34a"
              strokeWidth="1.5"
              transform="rotate(-15 38 42)"
            />
            {/* Vein line left — draws after leaf blooms */}
            <path
              d="M 26 42 Q 38 40, 50 44"
              stroke="#16a34a"
              strokeWidth="1"
              opacity="0.5"
              pathLength={1}
              className="css-sprout-vein-l"
            />
          </g>
          {/* Right leaf (narrower, oval) — blooms after left (stagger) */}
          <g className="css-sprout-leaf-r">
            <ellipse
              cx="60"
              cy="30"
              rx="11"
              ry="7"
              fill="#22c55e"
              stroke="#16a34a"
              strokeWidth="1.5"
              transform="rotate(20 60 30)"
            />
            {/* Vein line right */}
            <path
              d="M 50 30 Q 60 28, 70 32"
              stroke="#16a34a"
              strokeWidth="1"
              opacity="0.5"
              pathLength={1}
              className="css-sprout-vein-r"
            />
          </g>
          {/* Small bud at stem peak — pops last (bonus delight) */}
          <circle
            cx="50"
            cy="14"
            r="4"
            fill="#22c55e"
            stroke="#16a34a"
            strokeWidth="1.5"
            className="css-sprout-bud"
          />
        </g>
      </svg>
      <span className="sr-only">Memuat Rutina</span>
    </div>
  );
}
