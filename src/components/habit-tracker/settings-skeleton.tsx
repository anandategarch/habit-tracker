'use client';

// components/habit-tracker/settings-skeleton.tsx — skeleton halaman Settings.
// Meniru layout final (header + premium-segment + section card) dengan div
// polong premium-card.

import { Skeleton } from '@/components/ui/skeleton';

export function LoadingSkeleton() {
  return (
    <div className="max-w-4xl space-y-6" aria-busy="true" aria-label="Memuat pengaturan">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Segment bagian */}
      <Skeleton className="h-10 w-72 rounded-full" />

      {/* Section card stub */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="premium-card rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
