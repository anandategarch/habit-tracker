'use client';

// components/habit-tracker/goals-skeleton.tsx — skeleton tab Tujuan.
// Meniru layout final (pola worklog 2-c): div polong premium-card (BUKAN
// <Card> + premium-class — anti-pattern cascade flat-shadow) dengan slot
// chip 36px + label+angka untuk stat, serta avatar 40px + baris judul +
// bar progress + chip footer untuk kartu tujuan.

import { Skeleton } from '@/components/ui/skeleton';

export function GoalsSkeleton() {
  return (
    <div className="max-w-4xl space-y-4 sm:space-y-6" aria-busy="true" aria-label="Memuat tujuan">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="premium-card premium-card-sheen rounded-2xl p-3 sm:p-4 space-y-2.5"
          >
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-7 w-10" />
            <Skeleton className="h-3.5 w-full max-w-[88px]" />
          </div>
        ))}
      </div>

      {/* Goal cards */}
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="premium-card rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-3.5">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-5 w-14 rounded-md" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
