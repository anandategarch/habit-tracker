'use client';

import { cn } from '@/lib/utils';

/** Loader "sprout" untuk splash screen & transisi tab. */
export function SproutGrow({ className, size = 64 }: { className?: string; size?: number }) {
  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Memuat"
    >
      <div className="absolute inset-0 animate-ping rounded-full bg-primary/10" />
      <svg viewBox="0 0 24 24" className="text-primary" style={{ width: size * 0.62, height: size * 0.62 }} aria-hidden="true">
        <path
          d="M12 22V12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M12 12c0-4-3-6-7-6 0 4 3 6 7 6z"
          className="origin-bottom animate-pulse"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          fill="currentColor"
          fillOpacity="0.15"
        />
        <path
          d="M12 10c0-3.5 2.6-5 6-5 0 3.5-2.6 5-6 5z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          fill="currentColor"
          fillOpacity="0.15"
        />
      </svg>
    </div>
  );
}

/** Baris skeleton generik. */
export function SkeletonRow({ className }: { className?: string }) {
  return <div className={cn('h-14 animate-pulse rounded-xl bg-muted/60', className)} />;
}
