'use client';

import {
  type ReactNode,
  useState,
  useEffect,
  useRef,
} from 'react';
// FIX-TIER2 / Fix 4: Converted all components in this file from framer-motion
// to pure CSS keyframes / native browser APIs. The framer-motion core
// runtime (~109KB decoded) is no longer in the First Load bundle.
//
// - PageTransition: plain `<div key={tabId}>` with `.css-tab-enter` CSS
//   animation. Loses AnimatePresence's exit animation but the new tab
//   fades in immediately on mount — feels snappy.
// - ParallaxBackground: native `scroll` listener (passive) + rAF
//   coalescing + CSS transform. Replaces `useScroll` + `useTransform`.
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

/**
 * PageTransition — wraps tab content with a smooth enter transition.
 *
 * ANIM-2 / Feature 4: Page Transitions.
 *
 * Animation: subtle slide-in from the right (4px) + fade, 0.1s. Replaces
 * framer-motion's AnimatePresence with a plain `<div key={tabId}>` that
 * re-mounts when the tab changes — the new div runs the `.css-tab-enter`
 * CSS animation on mount. The exit animation is dropped (the previous tab
 * is unmounted instantly). This is intentional: with `keepPreviousData`
 * + the loading fallback in page.tsx, an exit animation isn't needed for
 * the tab-switch UX to feel smooth.
 *
 * FIX-TRANSITION-1 history: the original 0.25s framer-motion duration
 * combined with `mode="wait"` produced a ~318ms perceptible blank window
 * ("transisi antar tab hanya putih aja"). The loading fallback fixed the
 * blank window; this CSS version keeps the duration at 0.1s for snappy
 * feedback.
 *
 * Accessibility: respects `prefers-reduced-motion` — the `.css-tab-enter`
 * class is disabled under reduced-motion (animation: none), so the new
 * tab appears instantly without movement.
 *
 * Performance: `will-change: transform, opacity` is set on the CSS class
 * so the animation runs on the GPU compositor thread.
 *
 * @param children  Tab content to animate.
 * @param tabId     Key for React — change this to trigger the re-mount +
 *                  enter animation. Typically the active tab string.
 */
export function PageTransition({ children, tabId }: { children: ReactNode; tabId: string }) {
  return (
    <div key={tabId} className="css-tab-enter">
      {children}
    </div>
  );
}

/**
 * ParallaxBackground — subtle background layer that shifts opposite to
 * scroll direction. Decorative only (pointer-events-none, behind content).
 *
 * ANIM-2 / Feature 4: Page Transitions Parallax.
 *
 * FIX-TIER2 / Fix 4: Replaced framer-motion's `useScroll` + `useTransform`
 * with a native `scroll` listener (passive: true) + `requestAnimationFrame`
 * coalescing + a CSS `transform: translate3d(0, y, 0)`. The transform is
 * applied as an inline style; the listener updates a ref + schedules a
 * single rAF callback per frame (no React re-render per scroll event).
 *
 * Maps scroll 0→1000px → translateY 0→-24px (background drifts up slower
 * than content, giving a parallax depth effect). Values beyond 1000px
 * clamp at -24px (matches framer-motion's default no-extrapolation).
 *
 * Accessibility: when `prefers-reduced-motion` is set, the layer is rendered
 * statically (no parallax).
 *
 * Performance: `position: fixed` keeps the layer out of the document flow.
 * The transform runs on the GPU compositor (no layout/paint). The scroll
 * listener is `passive: true` so it never blocks the main thread.
 *
 * Mobile: disabled (touch devices) — continuous transform updates during
 * touch scroll cause jank on mobile Chrome/Safari. Desktop keeps the
 * effect (mouse wheel scroll is smoother and less frequent).
 *
 * @param className Optional className for the layer (e.g. gradient background).
 */
export function ParallaxBackground({ className = '' }: { className?: string }) {
  return <ParallaxBackgroundInner className={className} />;
}

function ParallaxBackgroundInner({ className = '' }: { className?: string }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isMobile, setIsMobile] = useState(false);
  const layerRef = useRef<HTMLDivElement>(null);

  // Detect mobile (touch or narrow viewport) — same heuristic as the old
  // framer-motion version. Lazy setState in rAF to avoid render cascade.
  useEffect(() => {
    const check = () =>
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches ||
        window.innerWidth < 768);
    const id = requestAnimationFrame(() => setIsMobile(check()));
    return () => cancelAnimationFrame(id);
  }, []);

  // Native scroll listener → rAF → CSS transform. No React state update
  // per scroll event (avoids re-rendering this subtree on every scroll).
  useEffect(() => {
    if (prefersReducedMotion || isMobile) return;
    const el = layerRef.current;
    if (!el) return;

    let rafId = 0;
    const update = () => {
      rafId = 0;
      const y = window.scrollY;
      // Map 0→1000 → 0→-24, clamp at -24 (matches framer-motion default).
      const clamped = Math.min(y, 1000);
      const translate = -24 * (clamped / 1000);
      el.style.transform = `translate3d(0, ${translate}px, 0)`;
    };

    const onScroll = () => {
      if (rafId === 0) rafId = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // Set initial position.
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId !== 0) cancelAnimationFrame(rafId);
    };
  }, [prefersReducedMotion, isMobile]);

  if (prefersReducedMotion || isMobile) {
    // Static layer — no parallax (mobile + reduced motion).
    return (
      <div
        ref={layerRef}
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 -z-10 ${className}`}
      />
    );
  }

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-10 ${className}`}
      style={{ willChange: 'transform' }}
    />
  );
}
