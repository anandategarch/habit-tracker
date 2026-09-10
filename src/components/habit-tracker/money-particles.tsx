'use client';

// components/habit-tracker/money-particles.tsx — burst partikel 💰 melayang
// saat transaksi pemasukan ditambahkan (ANIM-2 / Feature 3).
// Fixed-position overlay full viewport, pointer-events-none, aria-hidden,
// auto-bersih 2,6 detik. triggerKey 0 (initial) diabaikan.

import { useEffect, useState } from 'react';

const PARTICLE_COUNT = 14;
const EMOJIS = ['💰', '🪙', '💵', '✨'];
const CLEANUP_MS = 2_600;

interface Burst {
  key: number;
  particles: Array<{ left: number; delay: number; size: number; emoji: string }>;
}

export function MoneyParticles({ triggerKey }: { triggerKey: number }) {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    if (!triggerKey) return; // abaikan nilai awal
    const burst: Burst = {
      key: triggerKey,
      particles: Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        left: 8 + Math.random() * 84,
        delay: Math.random() * 0.45,
        size: 14 + Math.random() * 14,
        emoji: EMOJIS[(triggerKey + i) % EMOJIS.length],
      })),
    };
    // Defer penambahan burst 1 frame (rAF) supaya bukan sync-setState
    // dalam body effect (aturan react-hooks/set-state-in-effect).
    const add = requestAnimationFrame(() => {
      setBursts(prev => [...prev, burst]);
    });
    const timer = setTimeout(() => {
      setBursts(prev => prev.filter(b => b.key !== burst.key));
    }, CLEANUP_MS);
    return () => {
      cancelAnimationFrame(add);
      clearTimeout(timer);
    };
  }, [triggerKey]);

  if (bursts.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[60]" aria-hidden="true">
      {bursts.map(burst =>
        burst.particles.map((p, i) => (
          <span
            key={`${burst.key}-${i}`}
            className="anim-money-particle absolute"
            style={{
              left: `${p.left}%`,
              bottom: '16%',
              animationDelay: `${p.delay}s`,
              fontSize: `${p.size}px`,
              lineHeight: 1,
            }}
          >
            {p.emoji}
          </span>
        ))
      )}
    </div>
  );
}
