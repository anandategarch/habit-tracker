'use client';

// components/habit-tracker/page-transition.tsx
// Transisi antar tab + latar parallax ambient.
//
// PageTransition: CSS-keyframe + key remount (pola FIX-TIER2 — AnimatePresence
// framer-motion sudah diganti keyframes native supaya lebih ringan). Setiap
// pergantian tabId me-remount konten dengan animasi fade+slide.
// ParallaxBackground: layer ambient gradien (kelas dari parent, mis.
// "app-ambience") dengan micro-parallax mengikuti scroll.

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  tabId: string;
  children: React.ReactNode;
}

export function PageTransition({ tabId, children }: PageTransitionProps) {
  return (
    <div key={tabId} className="anim-tab-fade-up h-full">
      {children}
    </div>
  );
}

interface ParallaxBackgroundProps {
  className?: string;
}

export function ParallaxBackground({ className }: ParallaxBackgroundProps) {
  const [offset, setOffset] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      rafRef.current = requestAnimationFrame(() => {
        // Parallax halus: 6% dari scroll, di-clamp supaya subtle.
        setOffset(Math.min(40, Math.max(0, window.scrollY * 0.06)));
        queued = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none fixed inset-0 -z-10', className)}
      style={{ transform: `translate3d(0, ${offset}px, 0)` }}
    />
  );
}
