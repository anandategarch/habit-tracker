'use client';

import confetti from 'canvas-confetti';

/**
 * Confetti utility — lightweight celebration effects.
 * All respect prefers-reduced-motion (no-op if reduced motion is set).
 */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Burst confetti from a specific DOM element's position.
 * Use for habit completion, milestone reach, etc.
 */
export function burstFromElement(el: HTMLElement | null, opts?: {
  emojis?: string[];
  count?: number;
}) {
  if (!el || prefersReducedMotion()) return;

  const rect = el.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;
  const count = opts?.count ?? 30;

  // Particle burst
  confetti({
    particleCount: count,
    spread: 70,
    origin: { x, y },
    scalar: 0.9,
    ticks: 120,
    colors: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
  });

  // Emoji burst (optional) — fires slightly after particle burst.
  // Uses shapeFromText() — the correct API for emoji/text confetti shapes.
  if (opts?.emojis && opts.emojis.length > 0) {
    const emojis = opts.emojis;
    setTimeout(() => {
      confetti({
        particleCount: emojis.length * 2,
        spread: 60,
        origin: { x, y },
        scalar: 1.6,
        ticks: 100,
        shapes: emojis.map((e) => confetti.shapeFromText({ text: e, scalar: 1.6 })),
      });
    }, 120);
  }
}

/**
 * Full-screen celebration — for big milestones (30-day streak, budget under target).
 */
export function celebrate(opts?: { emojis?: string[] }) {
  if (prefersReducedMotion()) return;

  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

  // Left side cannon
  confetti({
    particleCount: 60,
    spread: 100,
    origin: { x: 0.2, y: 0.7 },
    angle: 60,
    colors,
    scalar: 1.1,
  });

  // Right side cannon
  confetti({
    particleCount: 60,
    spread: 100,
    origin: { x: 0.8, y: 0.7 },
    angle: 120,
    colors,
    scalar: 1.1,
  });

  // Center emoji burst (optional)
  if (opts?.emojis && opts.emojis.length > 0) {
    const emojis = opts.emojis;
    setTimeout(() => {
      confetti({
        particleCount: emojis.length * 3,
        spread: 80,
        origin: { x: 0.5, y: 0.5 },
        scalar: 1.8,
        ticks: 140,
        shapes: emojis.map((e) => confetti.shapeFromText({ text: e, scalar: 1.8 })),
      });
    }, 200);
  }
}

/**
 * Quick small pop — for minor achievements (transaction added, small streak).
 */
export function smallPop(el?: HTMLElement | null) {
  if (prefersReducedMotion()) return;

  let origin = { x: 0.5, y: 0.5 };
  if (el) {
    // Call getBoundingClientRect once to avoid 4 synchronous layout reflows.
    const rect = el.getBoundingClientRect();
    origin = {
      x: (rect.left + rect.width / 2) / window.innerWidth,
      y: (rect.top + rect.height / 2) / window.innerHeight,
    };
  }

  confetti({
    particleCount: 12,
    spread: 45,
    startVelocity: 20,
    origin,
    scalar: 0.7,
    ticks: 60,
    colors: ['#6366f1', '#10b981', '#f59e0b'],
  });
}
