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
  // BUGFIX MOBILE-CLIP-1 (Task 29): was `h-full` — the wrapper was pinned to
  // exactly the scroll container's content-box height (viewport − header −
  // bottom padding), so taller tab content OVERFLOWED the wrapper. In that
  // state the browser buries the container's pb-[calc(88px+safe-area)] under
  // the overflowing content (scrollable overflow = content edge, padding is
  // NOT appended after it) — at max scroll the last card ended up ~55px
  // behind the floating bottom dock ("terpotong" on mobile, Riwayat view).
  // `min-h-full` keeps the full-height baseline for tabs that fit while
  // letting the wrapper GROW with the content, so the 88px dock-clearing
  // padding always sits after the last card on every tab.
  return (
    <div key={tabId} className="anim-tab-fade-up min-h-full">
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

    // BUGHUNT-54 (3-d #7): pasca BUGFIX SCROLL-2 dokumen TIDAK pernah
    // scroll (layout h-dvh + overflow-hidden) — scroll sebenarnya terjadi
    // di elemen konten [data-slot="app-scroller"] (PullToRefresh, page.tsx).
    // Dulu listener dipasang di window → window.scrollY selalu 0 → parallax
    // mati total. Pasang listener ke elemen scroller itu (fallback ke
    // window bila tak ketemu) dan baca scrollTop dari elemen yang sama.
    const scroller: HTMLElement | Window =
      document.querySelector<HTMLElement>('[data-slot="app-scroller"]') ?? window;

    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      rafRef.current = requestAnimationFrame(() => {
        // Parallax halus: 6% dari scroll, di-clamp supaya subtle.
        const top = scroller instanceof HTMLElement ? scroller.scrollTop : window.scrollY;
        setOffset(Math.min(40, Math.max(0, top * 0.06)));
        queued = false;
      });
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
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
