'use client';

import { useEffect, useState } from 'react';

/**
 * MoneyParticles — floating 💰 particles that rise upward and fade.
 *
 * ANIM-2 / Feature 3: Finance Counter Roll-Up.
 * Triggered by incrementing the `triggerKey` prop. Each burst spawns
 * `count` particles with randomized horizontal positions and stagger
 * delays, then auto-cleans after 2.6s.
 *
 * Visual: particles use the `.anim-money-particle` CSS class which runs
 * the `anim-money-rise` keyframe (translateY 0 → -100px, opacity 0→1→0).
 * Respects prefers-reduced-motion — the CSS class is disabled in the
 * reduced-motion media query, and the base `opacity: 0` keeps them
 * invisible without animation.
 *
 * Placement: by default the wrapper is `position: fixed` covering the
 * viewport, so particles are always visible when triggered regardless of
 * scroll position. Set `absolute` prop to render relative to the nearest
 * positioned ancestor (useful for confining particles to a single card).
 *
 * Implementation note: burst creation uses the React "adjusting state when
 * a prop changes" render-phase pattern (not useEffect+setState) to avoid
 * cascading renders and the `react-hooks/set-state-in-effect` lint rule.
 * Cleanup uses a setTimeout-based effect (allowed — no synchronous setState).
 *
 * @param triggerKey Increment this number to fire a burst. The component
 *                   ignores the initial mount value (no burst on first render).
 * @param count      Particles per burst (default 8).
 * @param symbol     Emoji/text to display (default '💰'). Try 'Rp' or '💵'.
 * @param absolute   If true, render position:absolute (relative to nearest
 *                   positioned ancestor) instead of position:fixed (viewport).
 * @param fromTop    Vertical starting position as % of container (default 30).
 * @param className  Optional className for the wrapper.
 */
type Particle = { left: number; delay: number; size: number };
type Burst = { id: number; particles: Particle[]; createdAt: number };

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    // Spread across 10%–90% of container width.
    left: 10 + Math.random() * 80,
    // Stagger 0–500ms so particles don't all rise in lockstep.
    delay: Math.random() * 500,
    // Slight size variation for depth.
    size: 0.9 + Math.random() * 0.5,
  }));
}

export function MoneyParticles({
  triggerKey,
  count = 8,
  symbol = '💰',
  absolute = false,
  fromTop = 30,
  className = '',
}: {
  triggerKey: number;
  count?: number;
  symbol?: string;
  absolute?: boolean;
  fromTop?: number;
  className?: string;
}) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [prevKey, setPrevKey] = useState<number>(0);

  // Render-phase update — when triggerKey changes, push a new burst.
  // This is the React-recommended pattern for "adjusting state when a prop
  // changes" — see:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  // Skips the initial mount value (triggerKey === 0) so we don't fire a
  // burst on first render.
  if (triggerKey !== prevKey) {
    setPrevKey(triggerKey);
    if (triggerKey !== 0) {
      setBursts(prev => [
        ...prev,
        { id: triggerKey, particles: makeParticles(count), createdAt: Date.now() },
      ]);
    }
  }

  // Auto-cleanup — removes bursts older than 2.6s. This effect only sets
  // up a timer (no synchronous setState in the effect body), so it doesn't
  // trigger the `react-hooks/set-state-in-effect` rule. Re-subscribes
  // whenever `bursts` changes (new burst added → reset timer).
  useEffect(() => {
    if (bursts.length === 0) return;
    const timer = setTimeout(() => {
      const cutoff = Date.now() - 2600;
      setBursts(prev => prev.filter(b => b.createdAt > cutoff));
    }, 2700);
    return () => clearTimeout(timer);
  }, [bursts]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none ${absolute ? 'absolute' : 'fixed'} inset-0 overflow-visible z-40 ${className}`}
    >
      {bursts.map(burst => (
        <div key={burst.id} className="absolute inset-0">
          {burst.particles.map((p, i) => (
            <span
              key={i}
              className="anim-money-particle absolute select-none"
              style={{
                left: `${p.left}%`,
                top: `${fromTop}%`,
                fontSize: `calc(1rem * ${p.size})`,
                animationDelay: `${p.delay}ms`,
              }}
            >
              {symbol}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
