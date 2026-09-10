'use client';

// components/habit-tracker/count-up.tsx — angka KPI dengan animasi count-up.
//
// - Guard NaN / ±Infinity: agregasi API yang undefined tidak boleh merembes
//   ke UI sebagai "NaN" (pola fix COUNTUP-NAN-1 di worklog lama).
// - Animasi rAF ease-out cubic; prefers-reduced-motion → nilai final langsung.
// - Format angka Indonesia (id-ID: ribuan titik, desimal koma).

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface CountUpNumberProps {
  value: number;
  suffix?: string;
  prefix?: string;
  /** Durasi animasi (ms). */
  duration?: number;
  /** Digit desimal; default otomatis: bulat → 0, desimal → 1. */
  decimals?: number;
  className?: string;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function formatNumber(n: number, decimals: number): string {
  return n.toLocaleString('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function CountUpNumber({
  value,
  suffix = '',
  prefix = '',
  duration = 700,
  decimals,
  className,
}: CountUpNumberProps) {
  // Guard NaN / ±Infinity → 0. Initial = target supaya mount pertama
  // tidak berkedip "0" (animasi hanya untuk perubahan nilai berikutnya).
  const safeTarget = Number.isFinite(value) ? value : 0;
  const autoDecimals = decimals ?? (Number.isInteger(safeTarget) ? 0 : 1);
  const [display, setDisplay] = useState(safeTarget);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // prefers-reduced-motion → durasi 0 (nilai final pada frame pertama,
    // setState tetap lewat callback rAF — bukan sync di body effect).
    const dur = prefersReducedMotion() ? 0 : duration;
    const start = performance.now();
    const tick = (now: number) => {
      const t = dur > 0 ? Math.min(1, (now - start) / dur) : 1;
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(safeTarget * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [safeTarget, duration]);

  return (
    <span className={cn('tabular-nums', className)}>
      {prefix}
      {formatNumber(display, autoDecimals)}
      {suffix}
    </span>
  );
}
