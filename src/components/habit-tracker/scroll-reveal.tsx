'use client';

// components/habit-tracker/scroll-reveal.tsx — wrapper reveal-on-scroll.
//
// - IntersectionObserver: opacity 0 + translate-y-4 → tampil saat masuk
//   viewport (sekali saja, lalu observer di-disconnect).
// - prefers-reduced-motion / IO tidak tersedia → konten langsung tampil
//   tanpa transisi (guard setState di effect memakai functional update).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ScrollRevealProps {
  children: ReactNode;
  /** Delay transisi (ms) setelah elemen terlihat. */
  delay?: number;
  className?: string;
}

export function ScrollReveal({ children, delay = 0, className }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Lazy initializer (bukan setState di effect): bila reduced-motion atau
  // IntersectionObserver tidak tersedia, konten langsung tampil sejak
  // render pertama — tidak perlu transisi sama sekali.
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (typeof IntersectionObserver === 'undefined') return true;
    if (typeof window.matchMedia !== 'function') return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -40px 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        'transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}
