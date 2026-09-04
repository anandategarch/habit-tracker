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
    colors: ['#f59e0b', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
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

  const colors = ['#f59e0b', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

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
    colors: ['#f59e0b', '#10b981', '#f59e0b'],
  });
}

/* ══════════════════════════════════════════════════════════════════════
   MILESTONE CELEBRATIONS — Full-screen bursts for big achievements
   Each function composes multiple confetti() calls + emoji shapes.
   All respect prefers-reduced-motion (no-op if reduced motion).
   ══════════════════════════════════════════════════════════════════════ */

const GREEN = '#22c55e';
const AMBER = '#f59e0b';
const VIOLET = '#8b5cf6';
const PINK = '#ec4899';
const CYAN = '#06b6d4';

/**
 * Spawn a transient celebration overlay (radial primary glow) on top of the
 * viewport. Auto-removes after the animation completes. Safe to call from
 * any client component — no React lifecycle required.
 */
function showCelebrationOverlay(durationMs = 1500) {
  if (prefersReducedMotion() || typeof document === 'undefined') return;
  const overlay = document.createElement('div');
  overlay.className = 'anim-celebration-overlay';
  document.body.appendChild(overlay);
  // Auto-remove once the glow animation finishes.
  window.setTimeout(() => {
    overlay.remove();
  }, durationMs + 60);
}

/**
 * 7-day streak — green + amber center burst with 🌱 emoji.
 * Light, friendly, encourages the user to keep going.
 */
export function milestone7() {
  if (prefersReducedMotion()) return;

  showCelebrationOverlay(1500);

  const colors = [GREEN, AMBER, '#84cc16'];
  const sprout = confetti.shapeFromText({ text: '🌱', scalar: 1.8 });

  // Center burst
  confetti({
    particleCount: 60,
    spread: 80,
    origin: { x: 0.5, y: 0.5 },
    scalar: 1,
    ticks: 140,
    colors,
  });

  // Emoji shower — slightly delayed so it layers above the particles.
  window.setTimeout(() => {
    confetti({
      particleCount: 6,
      spread: 70,
      startVelocity: 35,
      origin: { x: 0.5, y: 0.5 },
      scalar: 1.8,
      ticks: 160,
      shapes: [sprout],
    });
  }, 120);

  // Side cannons for a wider celebration
  window.setTimeout(() => {
    confetti({
      particleCount: 25,
      angle: 60,
      spread: 70,
      origin: { x: 0.15, y: 0.7 },
      colors,
      scalar: 0.9,
    });
    confetti({
      particleCount: 25,
      angle: 120,
      spread: 70,
      origin: { x: 0.85, y: 0.7 },
      colors,
      scalar: 0.9,
    });
  }, 220);
}

/**
 * 30-day streak — bigger multi-color burst with ⚡ + 🔥 emojis.
 * Stronger feedback than milestone7 — sustained for ~1.2s.
 */
export function milestone30() {
  if (prefersReducedMotion()) return;

  showCelebrationOverlay(1800);

  const colors = [GREEN, AMBER, VIOLET, PINK, CYAN];
  const bolt = confetti.shapeFromText({ text: '⚡', scalar: 2 });
  const fire = confetti.shapeFromText({ text: '🔥', scalar: 2 });

  // Triple center burst, staggered for a sustained effect.
  confetti({
    particleCount: 90,
    spread: 100,
    origin: { x: 0.5, y: 0.5 },
    scalar: 1.1,
    ticks: 160,
    colors,
  });
  window.setTimeout(() => {
    confetti({
      particleCount: 70,
      spread: 120,
      startVelocity: 45,
      origin: { x: 0.5, y: 0.5 },
      scalar: 1.2,
      ticks: 180,
      colors,
    });
  }, 200);
  window.setTimeout(() => {
    confetti({
      particleCount: 6,
      spread: 100,
      startVelocity: 40,
      origin: { x: 0.5, y: 0.5 },
      scalar: 2,
      ticks: 200,
      shapes: [bolt, fire],
    });
  }, 400);

  // Side cannons
  window.setTimeout(() => {
    confetti({
      particleCount: 40,
      angle: 60,
      spread: 80,
      origin: { x: 0.1, y: 0.7 },
      colors,
      scalar: 1.1,
    });
    confetti({
      particleCount: 40,
      angle: 120,
      spread: 80,
      origin: { x: 0.9, y: 0.7 },
      colors,
      scalar: 1.1,
    });
  }, 300);
}

/**
 * 100-day streak — full-screen rainbow shimmer with 💯 emoji.
 * Three waves of confetti + top/bottom bursts.
 */
export function milestone100() {
  if (prefersReducedMotion()) return;

  showCelebrationOverlay(2200);

  const rainbow = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16',
    '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  ];
  const hundred = confetti.shapeFromText({ text: '💯', scalar: 2.2 });
  const fire = confetti.shapeFromText({ text: '🔥', scalar: 2.2 });

  // Wave 1 — full-screen wide spread from center
  confetti({
    particleCount: 120,
    spread: 360,
    startVelocity: 50,
    origin: { x: 0.5, y: 0.5 },
    scalar: 1.3,
    ticks: 220,
    colors: rainbow,
  });

  // Wave 2 — top cannons (rain falls down)
  window.setTimeout(() => {
    confetti({
      particleCount: 80,
      spread: 120,
      angle: 270,
      startVelocity: 35,
      origin: { x: 0.2, y: 0 },
      colors: rainbow,
      scalar: 1.2,
      ticks: 240,
    });
    confetti({
      particleCount: 80,
      spread: 120,
      angle: 270,
      startVelocity: 35,
      origin: { x: 0.8, y: 0 },
      colors: rainbow,
      scalar: 1.2,
      ticks: 240,
    });
  }, 300);

  // Wave 3 — emoji shower 💯🔥
  window.setTimeout(() => {
    confetti({
      particleCount: 8,
      spread: 120,
      startVelocity: 45,
      origin: { x: 0.5, y: 0.5 },
      scalar: 2.2,
      ticks: 260,
      shapes: [hundred, fire],
    });
  }, 600);

  // Wave 4 — bottom corners
  window.setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 90,
      origin: { x: 0.05, y: 1 },
      colors: rainbow,
      scalar: 1.1,
    });
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 90,
      origin: { x: 0.95, y: 1 },
      colors: rainbow,
      scalar: 1.1,
    });
  }, 500);
}

/**
 * 365-day streak — epic celebration. 3 sustained bursts over ~2s,
 * rainbow + 🏆 emoji + side cannons. The granddaddy of all confetti.
 */
export function milestone365() {
  if (prefersReducedMotion()) return;

  showCelebrationOverlay(2500);

  const rainbow = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16',
    '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  ];
  const trophy = confetti.shapeFromText({ text: '🏆', scalar: 2.4 });
  const star = confetti.shapeFromText({ text: '⭐', scalar: 2.2 });
  const fire = confetti.shapeFromText({ text: '🔥', scalar: 2.2 });

  // Burst 1 — center, full spread
  confetti({
    particleCount: 150,
    spread: 360,
    startVelocity: 55,
    origin: { x: 0.5, y: 0.5 },
    scalar: 1.4,
    ticks: 260,
    colors: rainbow,
  });

  // Burst 2 — side cannons (sustained, fires 700ms later)
  window.setTimeout(() => {
    confetti({
      particleCount: 100,
      angle: 60,
      spread: 100,
      origin: { x: 0.05, y: 0.7 },
      colors: rainbow,
      scalar: 1.3,
      ticks: 280,
    });
    confetti({
      particleCount: 100,
      angle: 120,
      spread: 100,
      origin: { x: 0.95, y: 0.7 },
      colors: rainbow,
      scalar: 1.3,
      ticks: 280,
    });
  }, 700);

  // Burst 3 — top-down rain + emojis
  window.setTimeout(() => {
    confetti({
      particleCount: 100,
      spread: 180,
      angle: 270,
      startVelocity: 40,
      origin: { x: 0.5, y: 0 },
      colors: rainbow,
      scalar: 1.2,
      ticks: 300,
    });
    confetti({
      particleCount: 10,
      spread: 140,
      startVelocity: 45,
      origin: { x: 0.5, y: 0.5 },
      scalar: 2.4,
      ticks: 320,
      shapes: [trophy, star, fire],
    });
  }, 1400);
}

/**
 * Dispatch the correct milestone celebration based on streak count.
 * Falls back to a regular `celebrate()` for non-milestone streaks.
 */
export function milestoneForStreak(streak: number) {
  if (streak >= 365) return milestone365();
  if (streak >= 100) return milestone100();
  if (streak >= 30) return milestone30();
  if (streak >= 7) return milestone7();
  // Below 7-day threshold — keep the existing small celebration.
  return celebrate({ emojis: ['🔥'] });
}
