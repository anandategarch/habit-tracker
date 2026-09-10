'use client';

// components/habit-tracker/count-up-rupiah.tsx — nominal rupiah dengan animasi
// count-up (formatRupiah + tabular-nums).
//
// File terpisah dari count-up.tsx (CountUpNumber milik area dashboard) supaya
// tidak bertabrakan dengan agent lain — komponen finance (overview, rekap,
// explorer kategori) mengimpor CountUpRupiah dari sini.
//
// - Guard NaN/±Infinity → 0 (COUNTUP-NAN-1).
// - prefers-reduced-motion → langsung nilai akhir.

import { useEffect, useRef, useState } from 'react';
import { formatRupiah } from '@/lib/money';
import { cn } from '@/lib/utils';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function CountUpRupiah({
  amount,
  className,
  duration = 650,
}: {
  amount: number;
  className?: string;
  duration?: number;
}) {
  const safeTarget = Number.isFinite(amount) ? amount : 0;
  const [display, setDisplay] = useState(safeTarget);
  const fromRef = useRef(safeTarget);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === safeTarget) return;
    if (prefersReducedMotion()) {
      // Defer 1 frame supaya bukan sync-setState dalam body effect
      // (aturan react-hooks/set-state-in-effect).
      const id = requestAnimationFrame(() => {
        fromRef.current = safeTarget;
        setDisplay(safeTarget);
      });
      rafRef.current = id;
      return () => cancelAnimationFrame(id);
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (safeTarget - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = safeTarget;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      fromRef.current = safeTarget;
    };
  }, [safeTarget, duration]);

  return <span className={cn('tabular-nums', className)}>{formatRupiah(display)}</span>;
}
