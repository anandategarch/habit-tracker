'use client';

// ── Splash screen (Task 71-a, split dari src/app/page.tsx) ────────────────
// TASK 58: TreeGrowSplash — pohon TUMBUH dari Tunas → Pohon Muda → Pohon
// Dewasa → Berbunga (4 artwork botanical pengguna, crossfade bertumpuk dari
// tanah yang sama) + halo teal bernapas + progress ring mengakselerasi,
// selama 2.0s while dynamic imports + React Query fetch data. Makes first
// load feel premium + branded — pengganti TreeMark statis (Task 56/57).
// TASK-58 timing: 1.6s → 2.0s — narasi 4 tahap butuh ruang (tahap terakhir
// penuh di 1.76s); masih dalam rentang riset Task 27 (ideal 1.5-2s, exit
// reveal 400ms). Ring 1.62s selesai ~saat berbunga penuh.
// FEAT-SPLASH-REVEAL: Exit animation (fade + scale + slide up, 400ms)
// instead of hard cut. Uses splashExiting state to delay unmount until
// animation completes.

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TreeGrowSplash } from '@/components/ui/loaders';

/** State mesin splash: tampil 2.0s → exit animasi 400ms → unmount.
 * `splashExiting` juga dipakai shell untuk kelas `anim-content-reveal`
 * (entrance konten) saat overlay mulai fade-out. */
export function useAppSplash() {
  const [showSplash, setShowSplash] = useState(true);
  const [splashExiting, setSplashExiting] = useState(false);
  useEffect(() => {
    // BUGFIX POST-2 #2: Hoist unmountTimer ke outer scope supaya outer
    // cleanup bisa clear both timers. Sebelumnya inner return adalah dead
    // code (setTimeout ignores callback return values) → timer leak +
    // setState-after-unmount risk.
    let unmountTimer: ReturnType<typeof setTimeout>;
    const exitTimer = setTimeout(() => {
      setSplashExiting(true);
      // Unmount after exit animation completes (400ms)
      unmountTimer = setTimeout(() => setShowSplash(false), 400);
    }, 2000);
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
        'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background app-ambience gap-6',
        exiting ? 'anim-splash-exit' : 'anim-splash-enter'
      )}
      key="splash"
    >
      <TreeGrowSplash size={180} ring />
      <div className="text-center">
        <p className="text-lg font-semibold text-primary tracking-tight">Rutina</p>
        <p className="text-xs text-muted-foreground mt-1">Menumbuhkan habit harian</p>
      </div>
    </div>
  );
}
