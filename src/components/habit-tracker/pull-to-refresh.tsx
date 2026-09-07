'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Sprout } from 'lucide-react';
import { BreathingSeed } from '@/components/ui/loaders';
import { cn } from '@/lib/utils';

/**
 * PullToRefresh — mobile-only pull-to-refresh wrapper.
 *
 * Behaviour:
 * - Enabled only on touch (pointer: coarse) devices. On desktop, the
 *   component is a pass-through wrapper that does nothing — existing
 *   mouse/scroll behaviour is unchanged.
 * - Respects `prefers-reduced-motion: reduce` — disables the gesture.
 * - When the user pulls down at the top of the scroll container, a 🌱 sprout
 *   icon grows from 30% → 100% scale. At ≥80px pull distance the sprout is
 *   "ready" (slight rotation). On release:
 *     • past threshold → call `onRefresh`, show a spinning Loader2 while
 *       the promise resolves, then snap back.
 *     • below threshold → snap back without refreshing.
 * - Uses `transform: translateY()` on the content for GPU-accelerated
 *   movement (no layout thrash). The sprout indicator is absolutely
 *   positioned above the content, inside the scroll container.
 *
 * The component becomes the scroll container (overflow-auto) — pass the
 * existing scroll container's className (flex-1, p-4, overflow-auto, etc.)
 * via the `className` prop.
 *
 * @example
 * <PullToRefresh
 *   className="flex-1 p-4 md:p-6 overflow-auto pb-28 md:pb-6"
 *   onRefresh={async () => { await queryClient.invalidateQueries(); }}
 * >
 *   {children}
 * </PullToRefresh>
 */
interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void> | void;
  className?: string;
  style?: React.CSSProperties;
}

const PULL_THRESHOLD = 80; // px — sprout fully grown at this distance

export function PullToRefresh({ children, onRefresh, className, style }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startYRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const refreshingRef = useRef(false);

  // Touch-device detection — only enable on `pointer: coarse` (touch).
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => setEnabled(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Reduced-motion detection — skip the gesture entirely when set.
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Keep a ref of refreshing state so the async touchend handler reads the
  // current value without re-subscribing listeners.
  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  const active = enabled && !reducedMotion;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!active || refreshingRef.current) return;
    // BUGFIX SCROLL-1 (original): The document (html) is the actual scroller on
    // mobile — PullToRefresh's own scrollTop is always 0 because its height
    // grew to fit content. Using el.scrollTop > 0 meant the "only-at-top"
    // guard NEVER triggered, so every downward swipe set startYRef, and every
    // touchmove frame then called setPullDistance() — re-rendering the entire
    // active tab subtree at 60fps + fighting document scroll with translateY.
    // Fix (SCROLL-1): use window.scrollY to detect "at top" so the guard
    // actually works.
    //
    // BUG-FIX-COMP-HIGH #3: After BUGFIX SCROLL-2 bounded the layout
    // (h-dvh overflow-hidden on the root, PullToRefresh's own div becomes
    // the scroller with overflow-y-auto), `window.scrollY` is now ALWAYS 0
    // (the document never scrolls). The SCROLL-1 guard therefore never
    // triggers again → every downward swipe activates pull-to-refresh even
    // when the user is scrolled deep inside the list. Check the actual scroll
    // container (`containerRef.current.scrollTop`) first, with the
    // window.scrollY check kept as a fallback for any caller that still
    // uses the legacy unbounded layout.
    const el = containerRef.current;
    if (
      (el?.scrollTop ?? 0) > 0 ||
      (typeof window !== 'undefined' && window.scrollY > 0)
    ) {
      startYRef.current = null;
      return;
    }
    startYRef.current = e.touches[0]?.clientY ?? null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!active || refreshingRef.current) return;
    if (startYRef.current === null) return;
    const currentY = e.touches[0]?.clientY ?? 0;
    const delta = currentY - startYRef.current;
    if (delta <= 0) {
      if (pullDistance !== 0) setPullDistance(0);
      return;
    }
    // Rubber-band resistance: pull becomes harder as you go further.
    // Capped at 1.5× threshold so the sprout doesn't fly off-screen.
    const resisted = Math.min(delta * 0.5, PULL_THRESHOLD * 1.5);
    setPullDistance(resisted);
  };

  const handleTouchEnd = async () => {
    if (!active) return;
    startYRef.current = null;
    if (pullDistance >= PULL_THRESHOLD) {
      setRefreshing(true);
      // Hold the sprout at the threshold while refreshing.
      setPullDistance(PULL_THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  // Pull progress 0..1 (clamped). Drives sprout scale + rotation.
  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const sproutScale = refreshing ? 1 : 0.3 + progress * 0.7; // 0.3 → 1.0
  const sproutRotate = refreshing ? 0 : progress * 25; // subtle lean when ready
  const ready = progress >= 1;

  // When the content is being dragged (pullDistance > 0) we want NO
  // transition (1:1 with finger). When snapping back (pullDistance === 0)
  // we want a spring-y ease. The same applies to the sprout indicator
  // height.
  const isSnapping = pullDistance === 0;
  const contentTransition = isSnapping
    ? 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
    : 'none';
  const indicatorHeightTransition = isSnapping ? 'height 0.3s ease' : 'none';

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-y-auto overscroll-y-contain', className)}
      style={{ WebkitOverflowScrolling: 'touch', ...style }}
      onTouchStart={active ? handleTouchStart : undefined}
      onTouchMove={active ? handleTouchMove : undefined}
      onTouchEnd={active ? handleTouchEnd : undefined}
      onTouchCancel={active ? handleTouchEnd : undefined}
    >
      {/* Sprout indicator — absolutely positioned at the top-center, only
          visible while pulling or refreshing. height = pullDistance so the
          sprout "grows" out of the top as the user pulls. */}
      {active && (pullDistance > 0 || refreshing) && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 z-10 flex items-start justify-center"
          style={{
            height: pullDistance,
            transition: indicatorHeightTransition,
          }}
        >
          <div className="flex items-center justify-center h-8 w-8 mt-1">
            {refreshing ? (
              <BreathingSeed size={32} />
            ) : (
              <Sprout
                className={cn(
                  'text-primary anim-sprout',
                  ready && 'anim-sprout-ready',
                )}
                style={{
                  transform: `scale(${sproutScale}) rotate(${sproutRotate}deg)`,
                  transformOrigin: 'center bottom',
                  transition: contentTransition,
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Content — translated down by pullDistance. GPU-friendly transform. */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: contentTransition,
        }}
      >
        {children}
      </div>
    </div>
  );
}
