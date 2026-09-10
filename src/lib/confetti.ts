// lib/confetti.ts — burst confetti ringan berbasis DOM (tanpa dep canvas-confetti).
// API: burstFromElement(el, milestone), milestoneForStreak(n), smallPop(el).

interface ConfettiOptions {
  count?: number;
  spread?: number;
  colors?: string[];
}

const DEFAULT_COLORS = [
  '#14b8a6', // teal
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#8b5cf6', // violet
  '#84cc16', // lime
  // rainbow celebration dipakai penuh untuk milestone besar (full-spectrum
  // sengaja — bukan chrome UI, lihat catatan worklog 6-d)
];

const MILESTONE_RAINBOW = [...DEFAULT_COLORS, '#3b82f6', '#ec4899', '#f97316'];

/** Milestone streak yang dirayakan. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 180, 365];

export function milestoneForStreak(streak: number): number | null {
  if (streak <= 0) return null;
  if (STREAK_MILESTONES.includes(streak)) return streak;
  return null;
}

let layer: HTMLDivElement | null = null;
function ensureLayer(): HTMLDivElement {
  if (layer && layer.isConnected) return layer;
  layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';
  document.body.appendChild(layer);
  return layer;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Burst confetti dari posisi sebuah elemen. */
export function burstFromElement(
  element: HTMLElement | null,
  opts: ConfettiOptions & { rainbow?: boolean } = {},
): void {
  if (!element || typeof window === 'undefined') return;
  if (prefersReducedMotion()) return;
  const rect = element.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const count = Math.min(opts.count ?? 24, 80);
  const colors = opts.rainbow ? MILESTONE_RAINBOW : (opts.colors ?? DEFAULT_COLORS);
  const host = ensureLayer();

  for (let i = 0; i < count; i++) {
    const bit = document.createElement('span');
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = (opts.spread ?? 70) * (0.5 + Math.random() * 0.7);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 30;
    const size = 5 + Math.random() * 5;
    const color = colors[i % colors.length];
    bit.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;width:${size}px;height:${size * 0.6}px;background:${color};border-radius:${Math.random() > 0.5 ? '50%' : '2px'};opacity:1;transform:translate(-50%,-50%);`;
    host.appendChild(bit);
    const duration = 700 + Math.random() * 500;
    bit.animate(
      [
        { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
        {
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 60}px)) rotate(${Math.random() * 540 - 270}deg)`,
          opacity: 0,
        },
      ],
      { duration, easing: 'cubic-bezier(0.16,0.84,0.44,1)' },
    ).addEventListener('finish', () => bit.remove());
  }
}

/** Pop kecil untuk aksi minor (mis. quick-chip tabungan). */
export function smallPop(element: HTMLElement | null): void {
  burstFromElement(element, { count: 10, spread: 46 });
}
