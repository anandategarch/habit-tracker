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
  // BUGHUNT-54 (3-c #6): nilai display terakhir + penanda mount pertama —
  // animasi interpolasi dari nilai display SEBELUMNYA (bukan dari 0), dan
  // mount pertama langsung menuju target tanpa animasi.
  const displayRef = useRef(safeTarget);
  const mountedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // BUGHUNT-54 (3-c #6): mount pertama → tanpa animasi. State sudah
    // diinisialisasi useState(safeTarget); cukup sinkronkan displayRef.
    // Dulu animasi selalu menghitung dari 0 → tiap pindah tab (remount
    // dengan nilai cache) angka KPI flash "penuh→0→naik" meski nilai tak
    // berubah.
    if (!mountedRef.current) {
      mountedRef.current = true;
      displayRef.current = safeTarget;
      return;
    }
    // prefers-reduced-motion → durasi 0 (nilai final pada frame pertama,
    // setState tetap lewat callback rAF — bukan sync di body effect).
    const from = displayRef.current;
    const dur = prefersReducedMotion() ? 0 : duration;
    const start = performance.now();
    const tick = (now: number) => {
      const t = dur > 0 ? Math.min(1, (now - start) / dur) : 1;
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      // BUGHUNT-54 (3-c #6): interpolasi dari nilai display SEBELUMNYA —
      // perubahan 20→25 naik mulus dari 20, bukan restart dari 0.
      const next = from + (safeTarget - from) * eased;
      displayRef.current = next;
      setDisplay(next);
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
