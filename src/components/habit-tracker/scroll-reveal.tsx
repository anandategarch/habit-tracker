'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * ScrollReveal — wraps children in a fade-up animation when they scroll
 * into the viewport. Uses IntersectionObserver (lint-safe: setState is
 * called from the observer callback, not directly in the effect body).
 *
 * Features:
 * - Respects prefers-reduced-motion (shows content immediately).
 * - Only animates once (content stays visible after reveal).
 * - Configurable delay for staggered reveals.
 *
 * @example
 * <ScrollReveal>
 *   <Card>...</Card>
 * </ScrollReveal>
 */
export function ScrollReveal({
  children,
  className,
  delay = 0,
  threshold = 0.1,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  threshold?: number;
}) {
  // Check reduced-motion synchronously during render.
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // If reduced motion, start visible — no animation needed.
  const [visible, setVisible] = useState(reducedMotion);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If reduced motion or already visible, skip observer.
    if (reducedMotion || visible) return;

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect(); // only reveal once
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion, visible, threshold]);

  return (
    <div
      ref={ref}
      className={cn(
        visible ? 'anim-scroll-reveal' : 'opacity-0',
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
