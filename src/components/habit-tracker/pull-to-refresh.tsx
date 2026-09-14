'use client';

// components/habit-tracker/pull-to-refresh.tsx
// Pull-to-refresh native-feel untuk area konten (mobile).
//
// Guard ganda scrollTop (scrollTop <= 0 DAN kontainer scroll parent tidak
// sedang scroll) supaya gesture hanya aktif saat benar-benar di atas.
// Listener React synthetic (pasif). Threshold 70px; indikator sprout
// berputar mengikuti progres tarikan.

import { useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const THRESHOLD = 70;
const MAX_PULL = 110;

interface PullToRefreshProps {
  className?: string;
  /** BUGHUNT-47: penanda scroll container untuk virtualizer daftar
   *  transaksi (finance-transactions) — dipakai query
   *  [data-slot="app-scroller"], jangan direname. */
  'data-slot'?: string;
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
}

export function PullToRefresh({ className, onRefresh, children, ...rest }: PullToRefreshProps) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (refreshing) return;
    // Guard scrollTop ganda: elemen ini DAN document sama-sama di atas.
    const el = e.currentTarget;
    if (el.scrollTop > 0 || (typeof document !== 'undefined' && document.documentElement.scrollTop > 0)) {
      startYRef.current = null;
      return;
    }
    startYRef.current = e.touches[0]?.clientY ?? null;
    pullingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const startY = startYRef.current;
    if (startY === null || refreshing) return;
    const currentY = e.touches[0]?.clientY ?? startY;
    const delta = currentY - startY;
    if (delta <= 0) {
      if (pull !== 0) setPull(0);
      return;
    }
    // Faktor redaman 0.55 agar tidak "lari" saat ditarik cepat.
    const damped = Math.min(MAX_PULL, delta * 0.55);
    setPull(damped);
    pullingRef.current = damped >= THRESHOLD;
  };

  const handleTouchEnd = async () => {
    const wasPulling = pullingRef.current;
    startYRef.current = null;
    pullingRef.current = false;
    if (wasPulling && !refreshing) {
      setRefreshing(true);
      setPull(0);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    } else {
      setPull(0);
    }
  };

  const progress = pull / THRESHOLD;
  const showIndicator = pull > 4 || refreshing;

  return (
    <div
      className={cn('relative touch-pan-y', className)}
      {...rest}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => void handleTouchEnd()}
      onTouchCancel={() => {
        startYRef.current = null;
        pullingRef.current = false;
        setPull(0);
      }}
    >
      {/* Indikator tarik — sprout kecil yang berputar sesuai progres */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 transition-opacity',
          showIndicator ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          top: refreshing ? 8 : -28 + Math.min(pull, MAX_PULL) * 0.24,
          transform: `translateX(-50%) rotate(${refreshing ? 360 : progress * 300}deg)`,
          transition: refreshing ? 'transform 0.8s linear infinite' : undefined,
        }}
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-background/90 text-primary shadow-md backdrop-blur">
          🌱
        </span>
      </div>
      {children}
    </div>
  );
}
