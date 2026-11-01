'use client';

// ── Splash screen (Task 71-a, split dari src/app/page.tsx) ────────────────
// Launch splash: identitas pohon tetap dipertahankan, tetapi urutan
// dipadatkan agar pembukaan terasa responsif: tunas → muda → dewasa →
// berbunga, lalu brand copy masuk dan layar membuka dashboard dengan reveal.
// Durasi normal 1.64s sebelum exit 460ms; reduced-motion hanya menahan layar
// sebentar lalu melepasnya tanpa memaksa pengguna menunggu seluruh sekuens.

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TreeGrowSplash } from '@/components/ui/loaders';

/** State mesin splash: tampil 2.0s → exit animasi 400ms → unmount.
 * `splashExiting` juga dipakai shell untuk kelas `anim-content-reveal`
 * (entrance konten) saat overlay mulai fade-out. */
const SPLASH_REVEAL_DELAY_MS = 1640;
const SPLASH_EXIT_DURATION_MS = 460;
const REDUCED_MOTION_HOLD_MS = 140;

/** State mesin splash: sekuens tumbuh → exit reveal → unmount.
 * Durasi exit disamakan dengan CSS agar overlay tidak terpotong di tengah
 * animasi. Preferensi reduced-motion tidak dipaksa menunggu sekuens penuh. */
export function useAppSplash() {
  const [showSplash, setShowSplash] = useState(true);
  const [splashExiting, setSplashExiting] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const revealDelay = prefersReducedMotion
      ? REDUCED_MOTION_HOLD_MS
      : SPLASH_REVEAL_DELAY_MS;
    const exitDuration = prefersReducedMotion ? 0 : SPLASH_EXIT_DURATION_MS;

    let unmountTimer: ReturnType<typeof setTimeout> | undefined;
    const exitTimer = setTimeout(() => {
      setSplashExiting(true);
      unmountTimer = setTimeout(() => setShowSplash(false), exitDuration);
    }, revealDelay);

    return () => {
      clearTimeout(exitTimer);
      if (unmountTimer) clearTimeout(unmountTimer);
    };
  }, []);

  return { showSplash, splashExiting };
}

/** Overlay splash penuh (fixed z-[100]) — dirender selama `showSplash`.
 * TreeGrowSplash (artwork botanical pengguna, mark transparan — fix kotak
 * Task 57 dipertahankan) + halo bernapas + progress ring mengakselerasi
 * (riset CMU: terasa lebih cepat). FEAT-SPLASH-REVEAL: exit animation
 * (fade + scale + slide up) instead of hard cut. */
export function SplashOverlay({ exiting }: { exiting: boolean }) {
  return (
    <div
      className={cn(
        'rutina-launch-screen fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background app-ambience gap-6',
        exiting ? 'anim-splash-exit' : 'anim-splash-enter'
      )}
      key="splash"
    >
      <TreeGrowSplash size={180} ring />
      <div className="rutina-launch-copy text-center">
        <p className="rutina-launch-wordmark text-lg font-semibold tracking-tight">Rutina</p>
        <p className="rutina-launch-tagline mt-1 text-xs text-muted-foreground">Menumbuhkan habit harian</p>
      </div>
    </div>
  );
}
